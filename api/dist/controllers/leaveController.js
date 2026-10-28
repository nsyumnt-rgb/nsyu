"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLeave = requestLeave;
exports.getMyLeaves = getMyLeaves;
exports.listLeaves = listLeaves;
exports.decideLeave = decideLeave;
exports.cancelLeave = cancelLeave;
const models_1 = require("../models");
const attendance_1 = require("../utils/attendance");
const audit_1 = require("../utils/audit");
const notifications_1 = require("../utils/notifications");
function actorFromReq(req) {
    return {
        actorType: (req.auth.isOwner ? "owner" : "employee"),
        actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
/** Self-service (or owner-on-behalf-of, if employeeId given): raise a leave request. */
async function requestLeave(req, res) {
    const { leaveType, startDate, endDate, reason } = req.body;
    const employeeId = req.auth.isOwner ? req.body.employeeId : req.auth.employeeId;
    if (!employeeId)
        return res.status(400).json({ success: false, message: "employeeId is required" });
    if (!leaveType || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: "leaveType, startDate and endDate are required" });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    const employee = await models_1.Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    const days = (0, attendance_1.daysBetweenInclusive)(startDate, endDate);
    const leave = await models_1.LeaveRequest.create({
        owner_id: ownerId,
        shop_id: shopId,
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days,
        reason: reason ?? null,
    });
    await (0, audit_1.logAudit)({ req, module: "leave", action: "request", entityType: "LeaveRequest", entityId: leave.id });
    await (0, notifications_1.notifyOwner)(ownerId, {
        shopId,
        type: "leave_requested",
        title: "New leave request",
        message: `${employee.name} requested ${days} day(s) leave (${startDate} to ${endDate})`,
        referenceType: "LeaveRequest",
        referenceId: leave.id,
    });
    return res.status(201).json({ success: true, data: leave });
}
async function getMyLeaves(req, res) {
    if (!req.auth.employeeId)
        return res.status(400).json({ success: false, message: "This endpoint is for employees" });
    const leaves = await models_1.LeaveRequest.findAll({
        where: { employee_id: req.auth.employeeId },
        order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, data: leaves });
}
/** Owner/manager: list leave requests across employees, filterable by employee/status. */
async function listLeaves(req, res) {
    const { employeeId, status } = req.query;
    const where = { owner_id: req.auth.ownerId, shop_id: req.auth.shopId };
    if (employeeId)
        where.employee_id = employeeId;
    if (status)
        where.status = status;
    const leaves = await models_1.LeaveRequest.findAll({
        where,
        include: [{ model: models_1.Employee, as: "employee", attributes: ["id", "name", "email"] }],
        order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, data: leaves });
}
/**
 * Owner/manager decision. Approving also stamps an Attendance row
 * status="Leave" for every date in the range (creating any missing
 * ones) so attendance and leave records always agree, and payroll's
 * summarizeAttendance can classify each day as paid/unpaid leave.
 */
async function decideLeave(req, res) {
    const { decision, isPaid, note } = req.body; // decision: "approve" | "reject"
    if (!["approve", "reject"].includes(decision)) {
        return res.status(400).json({ success: false, message: "decision must be 'approve' or 'reject'" });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const leave = await models_1.LeaveRequest.findOne({
                where: { id: req.params.leaveId, owner_id: ownerId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!leave)
                throw Object.assign(new Error("Leave request not found"), { status: 404 });
            if (leave.status !== "Pending") {
                throw Object.assign(new Error(`Leave request is already ${leave.status}`), { status: 400 });
            }
            leave.status = decision === "approve" ? "Approved" : "Rejected";
            leave.is_paid = decision === "approve" ? Boolean(isPaid) : false;
            leave.approved_by_actor_type = actorType;
            leave.approved_by_actor_id = actorId;
            leave.decision_note = note ?? null;
            leave.decided_at = new Date();
            await leave.save({ transaction: t });
            if (decision === "approve") {
                for (const date of (0, attendance_1.eachDateInRange)(leave.start_date, leave.end_date)) {
                    const [record] = await models_1.Attendance.findOrCreate({
                        where: { employee_id: leave.employee_id, date },
                        defaults: {
                            owner_id: ownerId,
                            shop_id: shopId,
                            employee_id: leave.employee_id,
                            date,
                            status: "Leave",
                            marked_by_actor_type: actorType,
                            marked_by_actor_id: actorId,
                        },
                        transaction: t,
                    });
                    record.status = "Leave";
                    await record.save({ transaction: t });
                }
            }
            return leave.id;
        });
        await (0, audit_1.logAudit)({ req, module: "leave", action: decision, entityType: "LeaveRequest", entityId: result, details: { isPaid } });
        const leave = await models_1.LeaveRequest.findByPk(result);
        if (leave) {
            await (0, notifications_1.notifyEmployee)(ownerId, leave.employee_id, {
                shopId,
                type: "leave_decided",
                title: `Leave ${leave.status}`,
                message: `Your leave request (${leave.start_date} to ${leave.end_date}) was ${leave.status.toLowerCase()}${note ? `: ${note}` : ""}`,
                referenceType: "LeaveRequest",
                referenceId: leave.id,
            });
        }
        return res.json({ success: true, data: leave });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
/** Self-service or owner: cancel a still-pending leave request. */
async function cancelLeave(req, res) {
    const leave = await models_1.LeaveRequest.findOne({ where: { id: req.params.leaveId, owner_id: req.auth.ownerId } });
    if (!leave)
        return res.status(404).json({ success: false, message: "Leave request not found" });
    if (!req.auth.isOwner && leave.employee_id !== req.auth.employeeId) {
        return res.status(403).json({ success: false, message: "You can only cancel your own leave requests" });
    }
    if (leave.status !== "Pending") {
        return res.status(400).json({ success: false, message: `Cannot cancel a leave request that is already ${leave.status}` });
    }
    leave.status = "Cancelled";
    await leave.save();
    await (0, audit_1.logAudit)({ req, module: "leave", action: "cancel", entityType: "LeaveRequest", entityId: leave.id });
    return res.json({ success: true, data: leave });
}
//# sourceMappingURL=leaveController.js.map