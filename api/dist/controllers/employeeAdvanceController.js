"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdvance = createAdvance;
exports.listAdvances = listAdvances;
exports.cancelAdvance = cancelAdvance;
const models_1 = require("../models");
const salaryLedger_1 = require("../utils/salaryLedger");
const audit_1 = require("../utils/audit");
function actorFromReq(req) {
    return {
        actorType: (req.auth.isOwner ? "owner" : "employee"),
        actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
/** Owner/manager: disburse a salary advance. Posts an immediate ledger debit (see models/EmployeeAdvance.ts for the accounting rationale). */
async function createAdvance(req, res) {
    const { employeeId, amount, date, reason, method } = req.body;
    if (!employeeId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: "employeeId and a positive amount are required" });
    }
    if (!method)
        return res.status(400).json({ success: false, message: "method is required" });
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const employee = await models_1.Employee.findOne({ where: { id: employeeId, owner_id: ownerId }, transaction: t });
            if (!employee)
                throw Object.assign(new Error("Employee not found"), { status: 404 });
            const advanceAmount = Number(amount);
            const advance = await models_1.EmployeeAdvance.create({
                owner_id: ownerId,
                shop_id: shopId,
                employee_id: employeeId,
                amount: advanceAmount,
                outstanding_amount: advanceAmount,
                date: date ? new Date(date) : new Date(),
                reason: reason ?? null,
                method,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                ownerId,
                shopId,
                employeeId,
                entryType: "debit",
                amount: advanceAmount,
                referenceType: "Advance",
                referenceId: advance.id,
                description: `Salary advance disbursed${reason ? `: ${reason}` : ""}`,
                actorType,
                actorId,
                entryDate: advance.date,
                externalTransaction: t,
            });
            return advance.id;
        });
        await (0, audit_1.logAudit)({ req, module: "payroll", action: "advance", entityType: "EmployeeAdvance", entityId: result, details: { amount } });
        const advance = await models_1.EmployeeAdvance.findByPk(result);
        return res.status(201).json({ success: true, data: advance });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
async function listAdvances(req, res) {
    const { employeeId, status } = req.query;
    const where = { owner_id: req.auth.ownerId, shop_id: req.auth.shopId };
    if (employeeId)
        where.employee_id = employeeId;
    if (status)
        where.status = status;
    const advances = await models_1.EmployeeAdvance.findAll({
        where,
        include: [{ model: models_1.Employee, as: "employee", attributes: ["id", "name"] }],
        order: [["date", "DESC"]],
    });
    return res.json({ success: true, data: advances });
}
/** Owner/manager: cancel an advance that hasn't been (fully) recovered yet — reverses the ledger debit. */
async function cancelAdvance(req, res) {
    const { reason } = req.body;
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        await models_1.sequelize.transaction(async (t) => {
            const advance = await models_1.EmployeeAdvance.findOne({
                where: { id: req.params.advanceId, owner_id: ownerId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!advance)
                throw Object.assign(new Error("Advance not found"), { status: 404 });
            if (advance.status === "cancelled")
                throw Object.assign(new Error("Advance already cancelled"), { status: 400 });
            if (advance.status === "recovered")
                throw Object.assign(new Error("Advance is already fully recovered"), { status: 400 });
            if (Number(advance.outstanding_amount) > 0) {
                await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                    ownerId,
                    shopId,
                    employeeId: advance.employee_id,
                    entryType: "credit",
                    amount: Number(advance.outstanding_amount),
                    referenceType: "AdvanceRecovery",
                    referenceId: advance.id,
                    description: `Cancellation of advance #${advance.id}${reason ? `: ${reason}` : ""}`,
                    actorType,
                    actorId,
                    externalTransaction: t,
                });
            }
            advance.status = "cancelled";
            advance.outstanding_amount = 0;
            await advance.save({ transaction: t });
            await (0, audit_1.logAudit)({ req, module: "payroll", action: "cancel_advance", entityType: "EmployeeAdvance", entityId: advance.id, details: { reason } });
        });
        const advance = await models_1.EmployeeAdvance.findByPk(req.params.advanceId);
        return res.json({ success: true, data: advance });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
//# sourceMappingURL=employeeAdvanceController.js.map