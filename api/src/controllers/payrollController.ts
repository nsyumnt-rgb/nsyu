import { Request, Response } from "express";
import { sequelize, Payroll, SalaryPayment, EmployeeAdvance, EmployeeIncentive, Employee, Shop } from "../models";
import { SALARY_PAYMENT_METHODS, SalaryPaymentMethod } from "../models/SalaryPayment";
import {
  getActiveSalaryConfig,
  summarizeAttendance,
  calculatePayroll,
  getPendingIncentiveTotal,
  getTotalOutstandingAdvance,
} from "../utils/payroll";
import { daysBetweenInclusive } from "../utils/attendance";
import { recordEmployeeLedgerEntry } from "../utils/salaryLedger";
import { logAudit } from "../utils/audit";
import { notifyEmployee } from "../utils/notifications";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function actorFromReq(req: Request) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

/**
 * Runs the calculation described in models/Payroll.ts and models/EmployeeIncentive.ts
 * against real attendance/config/incentive/advance data, WITHOUT
 * persisting anything or consuming any incentive/advance rows — lets
 * the owner sanity-check numbers before committing to a real run.
 */
export async function previewPayroll(req: Request, res: Response) {
  const { employeeId, periodStart, periodEnd, otherDeduction, advanceDeduction } = req.query;
  if (!employeeId || !periodStart || !periodEnd) {
    return res.status(400).json({ success: false, message: "employeeId, periodStart and periodEnd are required" });
  }

  try {
    const calc = await computePayrollFigures({
      ownerId: req.auth!.ownerId,
      employeeId: Number(employeeId),
      periodStart: String(periodStart),
      periodEnd: String(periodEnd),
      otherDeductionOverride: otherDeduction !== undefined ? Number(otherDeduction) : undefined,
      advanceDeductionOverride: advanceDeduction !== undefined ? Number(advanceDeduction) : undefined,
    });
    return res.json({ success: true, data: calc });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function computePayrollFigures(params: {
  ownerId: number;
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  otherDeductionOverride?: number;
  advanceDeductionOverride?: number;
}) {
  const { ownerId, employeeId, periodStart, periodEnd, otherDeductionOverride, advanceDeductionOverride } = params;

  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
  if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });

  const config = await getActiveSalaryConfig(employeeId, periodEnd);
  const attendance = await summarizeAttendance(employeeId, periodStart, periodEnd);
  const { rows: pendingIncentiveRows, total: pendingIncentiveTotal } = await getPendingIncentiveTotal(
    employeeId,
    periodStart,
    periodEnd
  );
  const totalDaysInPeriod = daysBetweenInclusive(periodStart, periodEnd);

  const otherDeduction = otherDeductionOverride !== undefined ? otherDeductionOverride : Number(config.deductions);

  const calc = calculatePayroll({
    salaryType: config.salary_type,
    basicSalary: Number(config.basic_salary),
    allowances: Number(config.allowances),
    overtimeRate: Number(config.overtime_rate),
    configIncentive: Number(config.incentive),
    totalDaysInPeriod,
    attendance,
    incentiveAmount: pendingIncentiveTotal,
    otherDeduction,
    advanceDeductionRequested: advanceDeductionOverride ?? 0,
  });

  const { total: outstandingAdvance } = await getTotalOutstandingAdvance(employeeId);
  const advanceDeduction =
    advanceDeductionOverride !== undefined
      ? round2(Math.min(advanceDeductionOverride, outstandingAdvance, calc.netSalaryBeforeAdvance))
      : round2(Math.min(outstandingAdvance, calc.netSalaryBeforeAdvance));

  const netSalary = Math.max(0, round2(calc.netSalaryBeforeAdvance - advanceDeduction));

  return {
    employee: { id: employee.id, name: employee.name },
    config,
    attendance,
    totalDaysInPeriod,
    pendingIncentiveRows,
    salaryBase: round2(calc.basicComponent + calc.allowancesComponent + calc.overtimeAmount),
    ...calc,
    outstandingAdvance,
    advanceDeduction,
    netSalary,
  };
}

/**
 * Finalizes a payroll run for one employee/period: persists the
 * Payroll row, posts Salary / Incentive / Deduction / Advance Recovery
 * ledger lines (see utils/salaryLedger.ts), consumes the pending
 * incentives and reduces outstanding advances — all in one transaction.
 */
export async function runPayroll(req: Request, res: Response) {
  const { employeeId, periodStart, periodEnd, otherDeduction, advanceDeduction, notes } = req.body;
  if (!employeeId || !periodStart || !periodEnd) {
    return res.status(400).json({ success: false, message: "employeeId, periodStart and periodEnd are required" });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const existing = await Payroll.findOne({ where: { employee_id: employeeId, period_start: periodStart, period_end: periodEnd } });
    if (existing && existing.status !== "cancelled") {
      return res.status(400).json({ success: false, message: "Payroll for this employee and period already exists" });
    }

    const figures = await computePayrollFigures({
      ownerId,
      employeeId: Number(employeeId),
      periodStart,
      periodEnd,
      otherDeductionOverride: otherDeduction !== undefined ? Number(otherDeduction) : undefined,
      advanceDeductionOverride: advanceDeduction !== undefined ? Number(advanceDeduction) : undefined,
    });

    const result = await sequelize.transaction(async (t) => {
      const payroll = await Payroll.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          employee_id: employeeId,
          period_start: periodStart,
          period_end: periodEnd,
          salary_type: figures.config.salary_type,
          present_days: figures.attendance.presentDays,
          absent_days: figures.attendance.absentDays,
          half_days: figures.attendance.halfDays,
          paid_leave_days: figures.attendance.paidLeaveDays,
          unpaid_leave_days: figures.attendance.unpaidLeaveDays,
          holiday_days: figures.attendance.holidayDays,
          week_off_days: figures.attendance.weekOffDays,
          payable_days: figures.attendance.payableDays,
          total_days: figures.totalDaysInPeriod,
          overtime_hours: figures.attendance.overtimeHours,
          overtime_amount: figures.overtimeAmount,
          basic_salary: figures.basicComponent,
          allowances: figures.allowancesComponent,
          incentive_amount: figures.incentiveAmount,
          gross_salary: figures.grossSalary,
          other_deduction: figures.otherDeduction,
          advance_deduction: figures.advanceDeduction,
          net_salary: figures.netSalary,
          due_amount: figures.netSalary,
          status: figures.netSalary <= 0 ? "paid" : "finalized",
          notes: notes ?? null,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      const entryDate = new Date(periodEnd);
      const periodLabel = `${periodStart} to ${periodEnd}`;

      if (figures.salaryBase > 0) {
        await recordEmployeeLedgerEntry({
          ownerId,
          shopId,
          employeeId,
          entryType: "credit",
          amount: figures.salaryBase,
          referenceType: "Salary",
          referenceId: payroll.id,
          description: `Salary for ${periodLabel}`,
          actorType,
          actorId,
          entryDate,
          externalTransaction: t,
        });
      }

      if (figures.incentiveAmount > 0) {
        await recordEmployeeLedgerEntry({
          ownerId,
          shopId,
          employeeId,
          entryType: "credit",
          amount: figures.incentiveAmount,
          referenceType: "Incentive",
          referenceId: payroll.id,
          description: `Incentive for ${periodLabel}`,
          actorType,
          actorId,
          entryDate,
          externalTransaction: t,
        });
        // Mark the pending incentive rows that fed this run as consumed
        for (const row of figures.pendingIncentiveRows) {
          row.status = "included_in_payroll";
          row.payroll_id = payroll.id;
          await row.save({ transaction: t });
        }
      }

      if (figures.otherDeduction > 0) {
        await recordEmployeeLedgerEntry({
          ownerId,
          shopId,
          employeeId,
          entryType: "debit",
          amount: figures.otherDeduction,
          referenceType: "Deduction",
          referenceId: payroll.id,
          description: `Deduction for ${periodLabel}`,
          actorType,
          actorId,
          entryDate,
          externalTransaction: t,
        });
      }

      if (figures.advanceDeduction > 0) {
        await recordEmployeeLedgerEntry({
          ownerId,
          shopId,
          employeeId,
          entryType: "debit",
          amount: figures.advanceDeduction,
          referenceType: "AdvanceRecovery",
          referenceId: payroll.id,
          description: `Advance recovery for ${periodLabel}`,
          actorType,
          actorId,
          entryDate,
          externalTransaction: t,
        });

        // Apply recovery to outstanding advances, oldest first (FIFO)
        let remaining = figures.advanceDeduction;
        const advances = await EmployeeAdvance.findAll({
          where: { employee_id: employeeId, status: ["outstanding", "partially_recovered"] },
          order: [["date", "ASC"]],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        for (const adv of advances) {
          if (remaining <= 0) break;
          const applied = round2(Math.min(remaining, Number(adv.outstanding_amount)));
          adv.outstanding_amount = round2(Number(adv.outstanding_amount) - applied);
          adv.status = adv.outstanding_amount <= 0 ? "recovered" : "partially_recovered";
          await adv.save({ transaction: t });
          remaining = round2(remaining - applied);
        }
      }

      return payroll.id;
    });

    await logAudit({
      req,
      module: "payroll",
      action: "run",
      entityType: "Payroll",
      entityId: result,
      details: { employeeId, periodStart, periodEnd, netSalary: figures.netSalary },
    });

    const payroll = await Payroll.findByPk(result, {
      include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }, { model: SalaryPayment, as: "payments" }],
    });

    await notifyEmployee(ownerId, Number(employeeId), {
      shopId,
      type: "payroll_finalized",
      title: "Payroll finalized",
      message: `Your salary for ${periodStart} to ${periodEnd} is ready: net ₹${figures.netSalary.toFixed(2)}`,
      referenceType: "Payroll",
      referenceId: result,
    });

    return res.status(201).json({ success: true, data: payroll });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function listPayrolls(req: Request, res: Response) {
  const { employeeId, status, allShops } = req.query;
  let targetShopId: number | undefined;

  if (req.auth!.isOwner) {
    if (allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId };
  if (targetShopId) where.shop_id = targetShopId;
  if (employeeId) where.employee_id = employeeId;
  if (status) where.status = status;

  const payrolls = await Payroll.findAll({
    where,
    include: [
      { model: Employee, as: "employee", attributes: ["id", "name"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
    ],
    order: [["period_start", "DESC"]],
    limit: Number(req.query.limit) || 200,
  });
  return res.json({ success: true, data: payrolls });
}

export async function getPayroll(req: Request, res: Response) {
  const where: any = { id: req.params.payrollId, owner_id: req.auth!.ownerId };
  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const payroll = await Payroll.findOne({
    where,
    include: [
      { model: Employee, as: "employee" },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: SalaryPayment, as: "payments" },
    ],
  });
  if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found" });
  return res.json({ success: true, data: payroll });
}

/** Owner/manager: record a salary payment against a finalized payroll's due amount. */
export async function paySalary(req: Request, res: Response) {
  const { amount, method, transactionId, paymentDate, notes } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "amount must be positive" });
  if (!method || !SALARY_PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ success: false, message: `method must be one of: ${SALARY_PAYMENT_METHODS.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const result = await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.payrollId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }

      const payroll = await Payroll.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payroll) throw Object.assign(new Error("Payroll not found"), { status: 404 });
      if (payroll.status === "cancelled") throw Object.assign(new Error("Cannot pay a cancelled payroll"), { status: 400 });

      const payAmount = round2(Math.min(Number(amount), Number(payroll.due_amount)));
      if (payAmount <= 0) throw Object.assign(new Error("Payroll has no outstanding due amount"), { status: 400 });

      const payment = await SalaryPayment.create(
        {
          owner_id: ownerId,
          shop_id: payroll.shop_id,
          employee_id: payroll.employee_id,
          payroll_id: payroll.id,
          amount: payAmount,
          method: method as SalaryPaymentMethod,
          transaction_id: transactionId ?? null,
          payment_date: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes ?? null,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      await recordEmployeeLedgerEntry({
        ownerId,
        shopId: payroll.shop_id,
        employeeId: payroll.employee_id,
        entryType: "debit",
        amount: payAmount,
        referenceType: "SalaryPayment",
        referenceId: payment.id,
        description: `Salary payment for ${payroll.period_start} to ${payroll.period_end}`,
        actorType,
        actorId,
        externalTransaction: t,
      });

      payroll.paid_amount = round2(Number(payroll.paid_amount) + payAmount);
      payroll.due_amount = round2(Number(payroll.due_amount) - payAmount);
      payroll.status = payroll.due_amount <= 0 ? "paid" : "partially_paid";
      await payroll.save({ transaction: t });

      await logAudit({ req, module: "payroll", action: "pay", entityType: "Payroll", entityId: payroll.id, details: { amount: payAmount, method } });

      return payment.id;
    });

    const payment = await SalaryPayment.findByPk(result, { include: [{ model: Payroll, as: "payroll" }] });
    return res.status(201).json({ success: true, data: payment });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Cancels a payroll that has NOT had any payment recorded yet (void
 * any SalaryPayment first). Reverses the net ledger effect with a
 * single compensating debit, restores any advances it recovered back
 * to outstanding, and frees up any incentives it consumed so they can
 * be included in a future run. Never deletes the Payroll row.
 */
export async function cancelPayroll(req: Request, res: Response) {
  const { reason } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    await sequelize.transaction(async (t) => {
      const payroll = await Payroll.findOne({
        where: { id: req.params.payrollId, owner_id: ownerId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payroll) throw Object.assign(new Error("Payroll not found"), { status: 404 });
      if (payroll.status === "cancelled") throw Object.assign(new Error("Payroll already cancelled"), { status: 400 });
      if (Number(payroll.paid_amount) > 0) {
        throw Object.assign(new Error("Cannot cancel a payroll with recorded payments — cancel the payment(s) first"), {
          status: 400,
        });
      }

      if (Number(payroll.net_salary) > 0) {
        await recordEmployeeLedgerEntry({
          ownerId,
          shopId,
          employeeId: payroll.employee_id,
          entryType: "debit",
          amount: Number(payroll.net_salary),
          referenceType: "PayrollCancellation",
          referenceId: payroll.id,
          description: `Cancellation of payroll for ${payroll.period_start} to ${payroll.period_end}${reason ? `: ${reason}` : ""}`,
          actorType,
          actorId,
          externalTransaction: t,
        });
      }

      if (Number(payroll.advance_deduction) > 0) {
        let toRestore = Number(payroll.advance_deduction);
        const advances = await EmployeeAdvance.findAll({
          where: { employee_id: payroll.employee_id, status: ["recovered", "partially_recovered"] },
          order: [["date", "DESC"]],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        for (const adv of advances) {
          if (toRestore <= 0) break;
          const recoveredSoFar = round2(Number(adv.amount) - Number(adv.outstanding_amount));
          const restoreHere = round2(Math.min(toRestore, recoveredSoFar));
          if (restoreHere <= 0) continue;
          adv.outstanding_amount = round2(Number(adv.outstanding_amount) + restoreHere);
          adv.status = "outstanding";
          await adv.save({ transaction: t });
          toRestore = round2(toRestore - restoreHere);
        }
      }

      await EmployeeIncentive.update(
        { status: "pending", payroll_id: null },
        { where: { payroll_id: payroll.id }, transaction: t }
      );

      payroll.status = "cancelled";
      payroll.cancel_reason = reason ?? null;
      payroll.due_amount = 0;
      await payroll.save({ transaction: t });

      await logAudit({ req, module: "payroll", action: "cancel", entityType: "Payroll", entityId: payroll.id, details: { reason } });
    });

    const payroll = await Payroll.findByPk(req.params.payrollId);
    return res.json({ success: true, data: payroll });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
