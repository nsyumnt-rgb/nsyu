"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIn = checkIn;
exports.checkOut = checkOut;
exports.getMyAttendance = getMyAttendance;
exports.listAttendance = listAttendance;
exports.markAttendance = markAttendance;
exports.markBulkAttendance = markBulkAttendance;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const Attendance_1 = require("../models/Attendance");
const attendance_1 = require("../utils/attendance");
const audit_1 = require("../utils/audit");
function actorFromReq(req) {
    return {
        actorType: (req.auth.isOwner ? "owner" : "employee"),
        actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
/** Self-service punch-in for the currently authenticated employee. */
async function checkIn(req, res) {
    if (req.auth.isOwner || !req.auth.employeeId) {
        return res.status(400).json({ success: false, message: "Only employees punch attendance" });
    }
    const employeeId = req.auth.employeeId;
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const date = req.body.date || todayStr();
    const existing = await models_1.Attendance.findOne({ where: { employee_id: employeeId, date } });
    if (existing?.check_in) {
        return res.status(400).json({ success: false, message: "Already checked in for this date" });
    }
    const { actorType, actorId } = actorFromReq(req);
    const now = new Date();
    let record;
    if (existing) {
        existing.check_in = now;
        existing.shop_id = shopId;
        existing.status = "Present";
        if (req.body.remarks !== undefined)
            existing.remarks = req.body.remarks;
        await existing.save();
        record = existing;
    }
    else {
        record = await models_1.Attendance.create({
            owner_id: ownerId,
            shop_id: shopId,
            employee_id: employeeId,
            date,
            check_in: now,
            status: "Present",
            remarks: req.body.remarks ?? null,
            marked_by_actor_type: actorType,
            marked_by_actor_id: actorId,
        });
    }
    await (0, audit_1.logAudit)({ req, module: "attendance", action: "check_in", entityType: "Attendance", entityId: record.id });
    return res.status(201).json({ success: true, data: record });
}
/** Self-service punch-out; computes working_hours and splits overtime beyond 8h/day. */
async function checkOut(req, res) {
    if (req.auth.isOwner || !req.auth.employeeId) {
        return res.status(400).json({ success: false, message: "Only employees punch attendance" });
    }
    const employeeId = req.auth.employeeId;
    const date = req.body.date || todayStr();
    const record = await models_1.Attendance.findOne({ where: { employee_id: employeeId, date } });
    if (!record || !record.check_in) {
        return res.status(400).json({ success: false, message: "You have not checked in yet for this date" });
    }
    if (record.check_out) {
        return res.status(400).json({ success: false, message: "Already checked out for this date" });
    }
    const now = new Date();
    const workingHours = (0, attendance_1.computeWorkingHours)(record.check_in, now);
    const { overtimeHours } = (0, attendance_1.splitOvertime)(workingHours);
    record.check_out = now;
    record.working_hours = workingHours;
    record.overtime_hours = overtimeHours;
    if (workingHours > 0 && workingHours < 4)
        record.status = "Half Day";
    if (req.body.remarks !== undefined)
        record.remarks = req.body.remarks;
    await record.save();
    await (0, audit_1.logAudit)({ req, module: "attendance", action: "check_out", entityType: "Attendance", entityId: record.id });
    return res.json({ success: true, data: record });
}
/** The authenticated employee's own attendance history. */
async function getMyAttendance(req, res) {
    if (!req.auth.employeeId) {
        return res.status(400).json({ success: false, message: "This endpoint is for employees" });
    }
    const { from, to } = req.query;
    const where = { employee_id: req.auth.employeeId };
    if (from || to) {
        where.date = {};
        if (from)
            where.date[sequelize_1.Op.gte] = String(from);
        if (to)
            where.date[sequelize_1.Op.lte] = String(to);
    }
    const records = await models_1.Attendance.findAll({ where, order: [["date", "DESC"]] });
    return res.json({ success: true, data: records });
}
/** Owner/manager: list attendance across employees, filterable by employee/shop/date/status. */
async function listAttendance(req, res) {
    const { employeeId, status, from, to, allShops } = req.query;
    let targetShopId;
    if (req.auth.isOwner) {
        if (allShops === "true") {
            targetShopId = undefined;
        }
        else {
            targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth.shopId || undefined;
        }
    }
    else {
        targetShopId = req.auth.shopId || undefined;
    }
    const where = { owner_id: req.auth.ownerId };
    if (targetShopId)
        where.shop_id = targetShopId;
    if (employeeId)
        where.employee_id = employeeId;
    if (status)
        where.status = status;
    if (from || to) {
        where.date = {};
        if (from)
            where.date[sequelize_1.Op.gte] = String(from);
        if (to)
            where.date[sequelize_1.Op.lte] = String(to);
    }
    const records = await models_1.Attendance.findAll({
        where,
        include: [
            { model: models_1.Employee, as: "employee", attributes: ["id", "name", "email"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
        ],
        order: [["date", "DESC"]],
        limit: Number(req.query.limit) || 500,
    });
    return res.json({ success: true, data: records });
}
/**
 * Owner/manager: create or overwrite a specific day's attendance for
 * any employee — bulk holiday marking, correcting a missed punch,
 * marking Week Off, etc. Upserts on (employee_id, date).
 */
async function markAttendance(req, res) {
    const { employeeId, date, status, checkIn, checkOut, remarks } = req.body;
    if (!employeeId || !date)
        return res.status(400).json({ success: false, message: "employeeId and date are required" });
    if (!status || !Attendance_1.ATTENDANCE_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${Attendance_1.ATTENDANCE_STATUSES.join(", ")}` });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    const employee = await models_1.Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    let workingHours = 0;
    let overtimeHours = 0;
    const checkInDate = checkIn ? new Date(checkIn) : null;
    const checkOutDate = checkOut ? new Date(checkOut) : null;
    if (checkInDate && checkOutDate) {
        workingHours = (0, attendance_1.computeWorkingHours)(checkInDate, checkOutDate);
        overtimeHours = (0, attendance_1.splitOvertime)(workingHours).overtimeHours;
    }
    const [record] = await models_1.Attendance.findOrCreate({
        where: { employee_id: employeeId, date },
        defaults: {
            owner_id: ownerId,
            shop_id: shopId,
            employee_id: employeeId,
            date,
            status: status,
            check_in: checkInDate,
            check_out: checkOutDate,
            working_hours: workingHours,
            overtime_hours: overtimeHours,
            remarks: remarks ?? null,
            marked_by_actor_type: actorType,
            marked_by_actor_id: actorId,
        },
    });
    record.status = status;
    if (checkInDate)
        record.check_in = checkInDate;
    if (checkOutDate)
        record.check_out = checkOutDate;
    if (checkInDate && checkOutDate) {
        record.working_hours = workingHours;
        record.overtime_hours = overtimeHours;
    }
    if (remarks !== undefined)
        record.remarks = remarks;
    record.marked_by_actor_type = actorType;
    record.marked_by_actor_id = actorId;
    await record.save();
    await (0, audit_1.logAudit)({ req, module: "attendance", action: "mark", entityType: "Attendance", entityId: record.id, details: { status } });
    return res.status(201).json({ success: true, data: record });
}
/** Owner/manager: bulk-mark the same status (e.g. Holiday) for every active employee on one date. */
async function markBulkAttendance(req, res) {
    const { date, status, employeeIds, remarks } = req.body;
    if (!date || !status)
        return res.status(400).json({ success: false, message: "date and status are required" });
    if (!Attendance_1.ATTENDANCE_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${Attendance_1.ATTENDANCE_STATUSES.join(", ")}` });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    const targetEmployees = Array.isArray(employeeIds) && employeeIds.length
        ? await models_1.Employee.findAll({ where: { id: employeeIds, owner_id: ownerId } })
        : await models_1.Employee.findAll({ where: { owner_id: ownerId, status: "active" } });
    const results = [];
    for (const employee of targetEmployees) {
        const [record] = await models_1.Attendance.findOrCreate({
            where: { employee_id: employee.id, date },
            defaults: {
                owner_id: ownerId,
                shop_id: shopId,
                employee_id: employee.id,
                date,
                status: status,
                remarks: remarks ?? null,
                marked_by_actor_type: actorType,
                marked_by_actor_id: actorId,
            },
        });
        record.status = status;
        if (remarks !== undefined)
            record.remarks = remarks;
        await record.save();
        results.push(record);
    }
    await (0, audit_1.logAudit)({ req, module: "attendance", action: "bulk_mark", entityType: "Attendance", details: { date, status, count: results.length } });
    return res.status(201).json({ success: true, data: results });
}
//# sourceMappingURL=attendanceController.js.map