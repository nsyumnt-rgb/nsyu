import { Request, Response } from "express";
import { Employee, EmployeeLedger, Payroll } from "../models";

async function buildLedgerResponse(employee: Employee, shopId?: number) {
  const where: any = { owner_id: employee.owner_id, employee_id: employee.id };
  if (shopId) where.shop_id = shopId;

  const entries = await EmployeeLedger.findAll({
    where,
    order: [
      ["entry_date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const totalCredit = entries
    .filter((e) => e.entry_type === "credit" && e.status === "active")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalDebit = entries
    .filter((e) => e.entry_type === "debit" && e.status === "active")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    employee: { id: employee.id, name: employee.name },
    outstanding: Number(employee.salary_outstanding),
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    entries,
  };
}

/** Owner/manager view of any employee's full salary ledger. */
export async function getEmployeeLedger(req: Request, res: Response) {
  const employee = await Employee.findOne({ where: { id: req.params.employeeId, owner_id: req.auth!.ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  const data = await buildLedgerResponse(employee, req.query.shopId ? Number(req.query.shopId) : undefined);
  return res.json({ success: true, data });
}

/** Self-service: the authenticated employee's own salary ledger. */
export async function getMyLedger(req: Request, res: Response) {
  if (!req.auth!.employeeId) return res.status(400).json({ success: false, message: "This endpoint is for employees" });
  const employee = await Employee.findOne({ where: { id: req.auth!.employeeId, owner_id: req.auth!.ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  const data = await buildLedgerResponse(employee);
  return res.json({ success: true, data });
}

/** Self-service: the authenticated employee's own payroll history. */
export async function getMyPayrolls(req: Request, res: Response) {
  if (!req.auth!.employeeId) return res.status(400).json({ success: false, message: "This endpoint is for employees" });
  const payrolls = await Payroll.findAll({
    where: { employee_id: req.auth!.employeeId },
    order: [["period_start", "DESC"]],
  });
  return res.json({ success: true, data: payrolls });
}

/** Owner: every employee with a non-zero salary_outstanding — for an owner-wide payroll dues overview. */
export async function listOutstandingSalaries(req: Request, res: Response) {
  const employees = await Employee.findAll({
    where: { owner_id: req.auth!.ownerId },
    order: [["salary_outstanding", "DESC"]],
  });
  const outstanding = employees.filter((e) => Number(e.salary_outstanding) !== 0);
  return res.json({ success: true, data: outstanding });
}
