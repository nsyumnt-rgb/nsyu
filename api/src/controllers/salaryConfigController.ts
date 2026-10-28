import { Request, Response } from "express";
import { Op } from "sequelize";
import { SalaryConfig, Employee } from "../models";
import { SALARY_TYPES, SALARY_CYCLES } from "../models/SalaryConfig";
import { logAudit } from "../utils/audit";

/**
 * Creates a new salary structure effective from `effectiveDate`, and
 * deactivates any prior config whose effective_date is before it —
 * history is preserved (old rows stay, just is_active=false), so
 * past payroll runs remain reproducible against the rules that were
 * actually in force at the time.
 */
export async function setSalaryConfig(req: Request, res: Response) {
  const {
    employeeId,
    salaryType,
    basicSalary,
    allowances,
    overtimeRate,
    incentive,
    commissionPercent,
    deductions,
    salaryCycle,
    effectiveDate,
    notes,
  } = req.body;

  if (!employeeId || !salaryType || basicSalary === undefined || !salaryCycle || !effectiveDate) {
    return res.status(400).json({
      success: false,
      message: "employeeId, salaryType, basicSalary, salaryCycle and effectiveDate are required",
    });
  }
  if (!SALARY_TYPES.includes(salaryType)) {
    return res.status(400).json({ success: false, message: `salaryType must be one of: ${SALARY_TYPES.join(", ")}` });
  }
  if (!SALARY_CYCLES.includes(salaryCycle)) {
    return res.status(400).json({ success: false, message: `salaryCycle must be one of: ${SALARY_CYCLES.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  await SalaryConfig.update(
    { is_active: false },
    { where: { employee_id: employeeId, effective_date: { [Op.lte]: effectiveDate } } }
  );

  const previous = await SalaryConfig.findOne({
    where: { employee_id: employeeId, effective_date: { [Op.lte]: effectiveDate } },
    order: [["effective_date", "DESC"]],
  });

  const config = await SalaryConfig.create({
    owner_id: ownerId,
    employee_id: employeeId,
    salary_type: salaryType,
    basic_salary: Number(basicSalary),
    allowances: Number(allowances) || 0,
    overtime_rate: Number(overtimeRate) || 0,
    incentive: Number(incentive) || 0,
    commission_percent: Number(commissionPercent) || 0,
    deductions: Number(deductions) || 0,
    salary_cycle: salaryCycle,
    effective_date: effectiveDate,
    notes: notes ?? null,
  });

  await logAudit({
    req,
    module: "payroll",
    action: "salary_change",
    entityType: "SalaryConfig",
    entityId: config.id,
    oldValue: previous
      ? { salaryType: previous.salary_type, basicSalary: Number(previous.basic_salary), allowances: Number(previous.allowances) }
      : undefined,
    newValue: { salaryType, basicSalary: Number(basicSalary), allowances: Number(allowances) || 0 },
  });
  return res.status(201).json({ success: true, data: config });
}

export async function listSalaryConfigs(req: Request, res: Response) {
  const employeeId = req.params.employeeId;
  const configs = await SalaryConfig.findAll({
    where: { employee_id: employeeId, owner_id: req.auth!.ownerId },
    order: [["effective_date", "DESC"]],
  });
  return res.json({ success: true, data: configs });
}

export async function getCurrentSalaryConfig(req: Request, res: Response) {
  const employeeId = req.params.employeeId;
  const config = await SalaryConfig.findOne({
    where: {
      employee_id: employeeId,
      owner_id: req.auth!.ownerId,
      is_active: true,
      effective_date: { [Op.lte]: new Date().toISOString().slice(0, 10) },
    },
    order: [["effective_date", "DESC"]],
  });
  if (!config) return res.status(404).json({ success: false, message: "No active salary configuration found" });
  return res.json({ success: true, data: config });
}
