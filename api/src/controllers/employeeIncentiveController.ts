import { Request, Response } from "express";
import { EmployeeIncentive, Employee } from "../models";
import { INCENTIVE_TYPES, INCENTIVE_BASES } from "../models/EmployeeIncentive";
import { logAudit } from "../utils/audit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Owner/manager: record a fixed incentive or a percentage
 * commission. For type="percentage", the caller supplies baseAmount
 * (the relevant sales/profit/product/category total, sourced from
 * the Sales/Reports modules) and percent; computed_amount is derived
 * here. See models/EmployeeIncentive.ts for the full rationale.
 */
export async function createIncentive(req: Request, res: Response) {
  const { employeeId, type, basis, baseAmount, percent, amount, periodStart, periodEnd, description } = req.body;

  if (!employeeId || !type || !periodStart || !periodEnd) {
    return res.status(400).json({ success: false, message: "employeeId, type, periodStart and periodEnd are required" });
  }
  if (!INCENTIVE_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `type must be one of: ${INCENTIVE_TYPES.join(", ")}` });
  }
  if (basis && !INCENTIVE_BASES.includes(basis)) {
    return res.status(400).json({ success: false, message: `basis must be one of: ${INCENTIVE_BASES.join(", ")}` });
  }
  if (type === "fixed" && (!amount || Number(amount) <= 0)) {
    return res.status(400).json({ success: false, message: "amount must be positive for a fixed incentive" });
  }
  if (type === "percentage" && (!baseAmount || Number(baseAmount) <= 0 || !percent || Number(percent) <= 0)) {
    return res.status(400).json({ success: false, message: "baseAmount and percent must be positive for a percentage incentive" });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const actorType = (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  const computedAmount = type === "fixed" ? round2(Number(amount)) : round2((Number(baseAmount) * Number(percent)) / 100);

  const incentive = await EmployeeIncentive.create({
    owner_id: ownerId,
    shop_id: shopId,
    employee_id: employeeId,
    type,
    basis: basis || "other",
    base_amount: type === "percentage" ? Number(baseAmount) : 0,
    percent: type === "percentage" ? Number(percent) : 0,
    amount: type === "fixed" ? Number(amount) : 0,
    computed_amount: computedAmount,
    period_start: periodStart,
    period_end: periodEnd,
    description: description ?? null,
    actor_type: actorType,
    actor_id: actorId,
  });

  await logAudit({ req, module: "payroll", action: "create_incentive", entityType: "EmployeeIncentive", entityId: incentive.id });
  return res.status(201).json({ success: true, data: incentive });
}

export async function listIncentives(req: Request, res: Response) {
  const { employeeId, status } = req.query;
  const where: any = { owner_id: req.auth!.ownerId, shop_id: req.auth!.shopId };
  if (employeeId) where.employee_id = employeeId;
  if (status) where.status = status;

  const incentives = await EmployeeIncentive.findAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["period_start", "DESC"]],
  });
  return res.json({ success: true, data: incentives });
}

export async function cancelIncentive(req: Request, res: Response) {
  const incentive = await EmployeeIncentive.findOne({ where: { id: req.params.incentiveId, owner_id: req.auth!.ownerId } });
  if (!incentive) return res.status(404).json({ success: false, message: "Incentive not found" });
  if (incentive.status !== "pending") {
    return res.status(400).json({ success: false, message: `Cannot cancel an incentive that is already ${incentive.status}` });
  }

  incentive.status = "cancelled";
  await incentive.save();

  await logAudit({ req, module: "payroll", action: "cancel_incentive", entityType: "EmployeeIncentive", entityId: incentive.id });
  return res.json({ success: true, data: incentive });
}
