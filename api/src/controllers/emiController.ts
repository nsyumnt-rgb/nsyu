import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize, EMIPlan, EMIInstallment, Sale, Customer, Payment, Shop } from "../models";
import { PAYMENT_METHODS, PaymentMethod } from "../models/Sale";
import { recordLedgerEntry } from "../utils/ledger";
import { computeInstallmentStatus, refreshInstallmentStatuses } from "../utils/emi";
import { logAudit } from "../utils/audit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function actorFromReq(req: Request) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

export async function listEmiPlans(req: Request, res: Response) {
  const { customerId, status, allShops } = req.query;
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
  if (customerId) where.customer_id = customerId;
  if (status) where.status = status;

  const plans = await EMIPlan.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
      { model: Sale, as: "sale", attributes: ["id", "invoice_number"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: EMIInstallment, as: "installments" },
    ],
    order: [["created_at", "DESC"]],
  });

  for (const plan of plans) {
    await refreshInstallmentStatuses((plan as any).installments);
  }

  return res.json({ success: true, data: plans });
}

export async function getEmiPlan(req: Request, res: Response) {
  const param = String(req.params.planId).trim();
  const digitsMatch = param.match(/\d+$/);
  const numericId = digitsMatch ? Number(digitsMatch[0]) : null;

  const where: any = { owner_id: req.auth!.ownerId };
  if (numericId !== null && !isNaN(numericId)) {
    where.id = numericId;
  }

  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  let plan = await EMIPlan.findOne({
    where,
    include: [
      { model: Customer, as: "customer" },
      { model: Sale, as: "sale" },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: EMIInstallment, as: "installments" },
    ],
    order: [[{ model: EMIInstallment, as: "installments" }, "installment_number", "ASC"]],
  });

  // If not found by ID, try searching by sale invoice_number
  if (!plan) {
    const saleMatch = await Sale.findOne({
      where: { owner_id: req.auth!.ownerId, invoice_number: { [Op.iLike]: param } },
      attributes: ["id"],
    });
    if (saleMatch) {
      plan = await EMIPlan.findOne({
        where: { owner_id: req.auth!.ownerId, sale_id: saleMatch.id },
        include: [
          { model: Customer, as: "customer" },
          { model: Sale, as: "sale" },
          { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
          { model: EMIInstallment, as: "installments" },
        ],
        order: [[{ model: EMIInstallment, as: "installments" }, "installment_number", "ASC"]],
      });
    }
  }
  if (!plan) return res.status(404).json({ success: false, message: "EMI plan not found" });

  await refreshInstallmentStatuses((plan as any).installments);
  return res.json({ success: true, data: plan });
}

/** Installments due/overdue across all EMI plans for the current shop — for a collections dashboard. */
export async function listDueInstallments(req: Request, res: Response) {
  let targetShopId: number | undefined;
  if (req.auth!.isOwner) {
    if (req.query.allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId, status: "active" };
  if (targetShopId) where.shop_id = targetShopId;

  const plans = await EMIPlan.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
      { model: Sale, as: "sale", attributes: ["id", "invoice_number"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: EMIInstallment, as: "installments" },
    ],
  });

  const rows: any[] = [];
  for (const plan of plans) {
    const installments = await refreshInstallmentStatuses((plan as any).installments);
    for (const inst of installments) {
      if (["Due", "Overdue", "Partially Paid"].includes(inst.status)) {
        rows.push({
          installment: inst,
          plan: { id: plan.id, saleId: plan.sale_id, shop: (plan as any).shop },
          customer: (plan as any).customer,
          sale: (plan as any).sale,
        });
      }
    }
  }

  rows.sort((a, b) => new Date(a.installment.due_date).getTime() - new Date(b.installment.due_date).getTime());
  return res.json({ success: true, data: rows });
}

/**
 * EMI payment received: Payment record -> EMI installment update ->
 * Customer ledger update -> Outstanding update, all inside one DB
 * transaction. Auto-applies a late fee the first time an overdue
 * installment is paid, if the plan has late_fee_percent configured.
 */
export async function payInstallment(req: Request, res: Response) {
  const { amount, method, transactionId, paymentDate, notes } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "amount must be positive" });
  if (!method || !PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ success: false, message: `method must be one of: ${PAYMENT_METHODS.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);
  const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();

  try {
    const result = await sequelize.transaction(async (t) => {
      const installment = await EMIInstallment.findOne({
        where: { id: req.params.installmentId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!installment) throw Object.assign(new Error("Installment not found"), { status: 404 });
      if (installment.status === "Cancelled") throw Object.assign(new Error("Installment is cancelled"), { status: 400 });
      if (installment.status === "Paid") throw Object.assign(new Error("Installment is already fully paid"), { status: 400 });

      const planWhere: any = { id: installment.emi_plan_id, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        planWhere.shop_id = shopId;
      }

      const plan = await EMIPlan.findOne({
        where: planWhere,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!plan) throw Object.assign(new Error("EMI plan not found"), { status: 404 });
      if (plan.status !== "active") throw Object.assign(new Error(`EMI plan is ${plan.status}`), { status: 400 });

      // Auto-apply late fee the first time this installment is paid past due_date
      const dueDate = new Date(installment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const today = new Date(effectivePaymentDate);
      today.setHours(0, 0, 0, 0);
      if (Number(installment.late_fee) === 0 && Number(plan.late_fee_percent) > 0 && today.getTime() > dueDate.getTime()) {
        installment.late_fee = round2((Number(installment.expected_amount) * Number(plan.late_fee_percent)) / 100);
      }

      const owedBefore = round2(Number(installment.expected_amount) + Number(installment.late_fee) - Number(installment.paid_amount));
      const payAmount = round2(Math.min(Number(amount), owedBefore));
      if (payAmount <= 0) throw Object.assign(new Error("Installment has no outstanding balance"), { status: 400 });

      const targetShopId = plan.shop_id;

      const payment = await Payment.create(
        {
          owner_id: ownerId,
          shop_id: targetShopId,
          customer_id: plan.customer_id,
          sale_id: plan.sale_id,
          emi_installment_id: installment.id,
          type: "emi_payment",
          amount: payAmount,
          method: method as PaymentMethod,
          transaction_id: transactionId ?? null,
          payment_date: effectivePaymentDate,
          notes: notes ?? null,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      installment.paid_amount = round2(Number(installment.paid_amount) + payAmount);
      installment.remaining_amount = round2(
        Number(installment.expected_amount) + Number(installment.late_fee) - Number(installment.paid_amount)
      );
      installment.payment_date = effectivePaymentDate;
      installment.payment_method = method as PaymentMethod;
      installment.transaction_id = transactionId ?? installment.transaction_id ?? null;
      installment.status = computeInstallmentStatus(installment);
      await installment.save({ transaction: t });

      const sale = await Sale.findOne({ where: { id: plan.sale_id }, transaction: t, lock: t.LOCK.UPDATE });

      await recordLedgerEntry({
        ownerId,
        shopId: targetShopId,
        customerId: plan.customer_id,
        entryType: "credit",
        amount: payAmount,
        referenceType: "EMIInstallment",
        referenceId: installment.id,
        description: `EMI installment #${installment.installment_number} for ${sale?.invoice_number ?? "sale " + plan.sale_id}`,
        actorType,
        actorId,
        entryDate: effectivePaymentDate,
        externalTransaction: t,
      });

      // Recompute plan outstanding = sum of remaining_amount across all non-cancelled installments
      const allInstallments = await EMIInstallment.findAll({ where: { emi_plan_id: plan.id }, transaction: t });
      const outstanding = round2(
        allInstallments
          .filter((i) => i.status !== "Cancelled")
          .reduce((sum, i) => sum + Number(i.remaining_amount), 0)
      );
      plan.outstanding_amount = outstanding;
      if (outstanding <= 0) plan.status = "completed";
      await plan.save({ transaction: t });

      if (sale) {
        sale.paid_amount = round2(Number(sale.paid_amount) + payAmount);
        sale.due_amount = outstanding;
        sale.status = outstanding <= 0 ? "paid" : "partially_paid";
        await sale.save({ transaction: t });
      }

      await logAudit({
        req,
        module: "emi",
        action: "payment",
        entityType: "EMIInstallment",
        entityId: installment.id,
        details: { amount: payAmount, lateFee: installment.late_fee, planId: plan.id },
      });

      return payment.id;
    });

    const payment = await Payment.findByPk(result, {
      include: [{ model: EMIInstallment, as: "installment" }],
    });
    return res.status(201).json({ success: true, data: payment });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Cancels an entire EMI plan (e.g. the underlying sale was cancelled,
 * or the customer settled the balance out-of-band). Marks all
 * unpaid/partial installments Cancelled and closes the outstanding
 * ledger debit with a credit — never deletes any row.
 */
export async function cancelEmiPlan(req: Request, res: Response) {
  const { reason } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.planId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const plan = await EMIPlan.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!plan) throw Object.assign(new Error("EMI plan not found"), { status: 404 });
      if (plan.status === "cancelled") throw Object.assign(new Error("EMI plan is already cancelled"), { status: 400 });

      const outstanding = Number(plan.outstanding_amount);
      if (outstanding > 0) {
        await recordLedgerEntry({
          ownerId,
          shopId: plan.shop_id,
          customerId: plan.customer_id,
          entryType: "credit",
          amount: outstanding,
          referenceType: "EMIPlanCancellation",
          referenceId: plan.id,
          description: `Cancellation of EMI plan #${plan.id}`,
          actorType,
          actorId,
          externalTransaction: t,
        });
      }

      await EMIInstallment.update(
        { status: "Cancelled" },
        { where: { emi_plan_id: plan.id, status: ["Upcoming", "Due", "Overdue", "Partially Paid"] }, transaction: t }
      );

      plan.status = "cancelled";
      plan.cancel_reason = reason ?? null;
      plan.outstanding_amount = 0;
      await plan.save({ transaction: t });

      const sale = await Sale.findOne({ where: { id: plan.sale_id }, transaction: t, lock: t.LOCK.UPDATE });
      if (sale) {
        sale.due_amount = 0;
        sale.status = "cancelled";
        sale.cancel_reason = reason ?? "EMI plan cancelled";
        await sale.save({ transaction: t });
      }

      await logAudit({ req, module: "emi", action: "cancel", entityType: "EMIPlan", entityId: plan.id, details: { reason } });
    });

    const plan = await EMIPlan.findByPk(req.params.planId, { include: [{ model: EMIInstallment, as: "installments" }] });
    return res.json({ success: true, data: plan });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
