"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIncentive = createIncentive;
exports.listIncentives = listIncentives;
exports.cancelIncentive = cancelIncentive;
const models_1 = require("../models");
const EmployeeIncentive_1 = require("../models/EmployeeIncentive");
const audit_1 = require("../utils/audit");
function round2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * Owner/manager: record a fixed incentive or a percentage
 * commission. For type="percentage", the caller supplies baseAmount
 * (the relevant sales/profit/product/category total, sourced from
 * the Sales/Reports modules) and percent; computed_amount is derived
 * here. See models/EmployeeIncentive.ts for the full rationale.
 */
async function createIncentive(req, res) {
    const { employeeId, type, basis, baseAmount, percent, amount, periodStart, periodEnd, description } = req.body;
    if (!employeeId || !type || !periodStart || !periodEnd) {
        return res.status(400).json({ success: false, message: "employeeId, type, periodStart and periodEnd are required" });
    }
    if (!EmployeeIncentive_1.INCENTIVE_TYPES.includes(type)) {
        return res.status(400).json({ success: false, message: `type must be one of: ${EmployeeIncentive_1.INCENTIVE_TYPES.join(", ")}` });
    }
    if (basis && !EmployeeIncentive_1.INCENTIVE_BASES.includes(basis)) {
        return res.status(400).json({ success: false, message: `basis must be one of: ${EmployeeIncentive_1.INCENTIVE_BASES.join(", ")}` });
    }
    if (type === "fixed" && (!amount || Number(amount) <= 0)) {
        return res.status(400).json({ success: false, message: "amount must be positive for a fixed incentive" });
    }
    if (type === "percentage" && (!baseAmount || Number(baseAmount) <= 0 || !percent || Number(percent) <= 0)) {
        return res.status(400).json({ success: false, message: "baseAmount and percent must be positive for a percentage incentive" });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const actorType = (req.auth.isOwner ? "owner" : "employee");
    const actorId = req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId;
    const employee = await models_1.Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    const computedAmount = type === "fixed" ? round2(Number(amount)) : round2((Number(baseAmount) * Number(percent)) / 100);
    const incentive = await models_1.EmployeeIncentive.create({
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
    await (0, audit_1.logAudit)({ req, module: "payroll", action: "create_incentive", entityType: "EmployeeIncentive", entityId: incentive.id });
    return res.status(201).json({ success: true, data: incentive });
}
async function listIncentives(req, res) {
    const { employeeId, status } = req.query;
    const where = { owner_id: req.auth.ownerId, shop_id: req.auth.shopId };
    if (employeeId)
        where.employee_id = employeeId;
    if (status)
        where.status = status;
    const incentives = await models_1.EmployeeIncentive.findAll({
        where,
        include: [{ model: models_1.Employee, as: "employee", attributes: ["id", "name"] }],
        order: [["period_start", "DESC"]],
    });
    return res.json({ success: true, data: incentives });
}
async function cancelIncentive(req, res) {
    const incentive = await models_1.EmployeeIncentive.findOne({ where: { id: req.params.incentiveId, owner_id: req.auth.ownerId } });
    if (!incentive)
        return res.status(404).json({ success: false, message: "Incentive not found" });
    if (incentive.status !== "pending") {
        return res.status(400).json({ success: false, message: `Cannot cancel an incentive that is already ${incentive.status}` });
    }
    incentive.status = "cancelled";
    await incentive.save();
    await (0, audit_1.logAudit)({ req, module: "payroll", action: "cancel_incentive", entityType: "EmployeeIncentive", entityId: incentive.id });
    return res.json({ success: true, data: incentive });
}
//# sourceMappingURL=employeeIncentiveController.js.map