import { Request, Response } from "express";
import { Op } from "sequelize";
import { Attendance, Employee, Shop } from "../models";
import { ATTENDANCE_STATUSES, AttendanceStatus } from "../models/Attendance";
import { computeWorkingHours, splitOvertime } from "../utils/attendance";
import { logAudit } from "../utils/audit";

function actorFromReq(req: Request) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Self-service punch-in for the currently authenticated employee. */
export async function checkIn(req: Request, res: Response) {
  if (req.auth!.isOwner || !req.auth!.employeeId) {
    return res.status(400).json({ success: false, message: "Only employees punch attendance" });
  }
  const employeeId = req.auth!.employeeId;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const date = req.body.date || todayStr();

  const existing = await Attendance.findOne({ where: { employee_id: employeeId, date } });
  if (existing?.check_in) {
    return res.status(400).json({ success: false, message: "Already checked in for this date" });
  }

  const { actorType, actorId } = actorFromReq(req);
  const now = new Date();

  let record: Attendance;
  if (existing) {
    existing.check_in = now;
    existing.shop_id = shopId;
    existing.status = "Present";
    if (req.body.remarks !== undefined) existing.remarks = req.body.remarks;
    await existing.save();
    record = existing;
  } else {
    record = await Attendance.create({
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

  await logAudit({ req, module: "attendance", action: "check_in", entityType: "Attendance", entityId: record.id });
  return res.status(201).json({ success: true, data: record });
}

/** Self-service punch-out; computes working_hours and splits overtime beyond 8h/day. */
export async function checkOut(req: Request, res: Response) {
  if (req.auth!.isOwner || !req.auth!.employeeId) {
    return res.status(400).json({ success: false, message: "Only employees punch attendance" });
  }
  const employeeId = req.auth!.employeeId;
  const date = req.body.date || todayStr();

  const record = await Attendance.findOne({ where: { employee_id: employeeId, date } });
  if (!record || !record.check_in) {
    return res.status(400).json({ success: false, message: "You have not checked in yet for this date" });
  }
  if (record.check_out) {
    return res.status(400).json({ success: false, message: "Already checked out for this date" });
  }

  const now = new Date();
  const workingHours = computeWorkingHours(record.check_in, now);
  const { overtimeHours } = splitOvertime(workingHours);

  record.check_out = now;
  record.working_hours = workingHours;
  record.overtime_hours = overtimeHours;
  if (workingHours > 0 && workingHours < 4) record.status = "Half Day";
  if (req.body.remarks !== undefined) record.remarks = req.body.remarks;
  await record.save();

  await logAudit({ req, module: "attendance", action: "check_out", entityType: "Attendance", entityId: record.id });
  return res.json({ success: true, data: record });
}

/** The authenticated employee's own attendance history. */
export async function getMyAttendance(req: Request, res: Response) {
  if (!req.auth!.employeeId) {
    return res.status(400).json({ success: false, message: "This endpoint is for employees" });
  }
  const { from, to } = req.query;
  const where: any = { employee_id: req.auth!.employeeId };
  if (from || to) {
    where.date = {};
    if (from) where.date[Op.gte] = String(from);
    if (to) where.date[Op.lte] = String(to);
  }
  const records = await Attendance.findAll({ where, order: [["date", "DESC"]] });
  return res.json({ success: true, data: records });
}

/** Owner/manager: list attendance across employees, filterable by employee/shop/date/status. */
export async function listAttendance(req: Request, res: Response) {
  const { employeeId, status, from, to, allShops } = req.query;
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
  if (from || to) {
    where.date = {};
    if (from) where.date[Op.gte] = String(from);
    if (to) where.date[Op.lte] = String(to);
  }

  const records = await Attendance.findAll({
    where,
    include: [
      { model: Employee, as: "employee", attributes: ["id", "name", "email"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
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
export async function markAttendance(req: Request, res: Response) {
  const { employeeId, date, status, checkIn, checkOut, remarks } = req.body;
  if (!employeeId || !date) return res.status(400).json({ success: false, message: "employeeId and date are required" });
  if (!status || !ATTENDANCE_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  let workingHours = 0;
  let overtimeHours = 0;
  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  if (checkInDate && checkOutDate) {
    workingHours = computeWorkingHours(checkInDate, checkOutDate);
    overtimeHours = splitOvertime(workingHours).overtimeHours;
  }

  const [record] = await Attendance.findOrCreate({
    where: { employee_id: employeeId, date },
    defaults: {
      owner_id: ownerId,
      shop_id: shopId,
      employee_id: employeeId,
      date,
      status: status as AttendanceStatus,
      check_in: checkInDate,
      check_out: checkOutDate,
      working_hours: workingHours,
      overtime_hours: overtimeHours,
      remarks: remarks ?? null,
      marked_by_actor_type: actorType,
      marked_by_actor_id: actorId,
    },
  });

  record.status = status as AttendanceStatus;
  if (checkInDate) record.check_in = checkInDate;
  if (checkOutDate) record.check_out = checkOutDate;
  if (checkInDate && checkOutDate) {
    record.working_hours = workingHours;
    record.overtime_hours = overtimeHours;
  }
  if (remarks !== undefined) record.remarks = remarks;
  record.marked_by_actor_type = actorType;
  record.marked_by_actor_id = actorId;
  await record.save();

  await logAudit({ req, module: "attendance", action: "mark", entityType: "Attendance", entityId: record.id, details: { status } });
  return res.status(201).json({ success: true, data: record });
}

/** Owner/manager: bulk-mark the same status (e.g. Holiday) for every active employee on one date. */
export async function markBulkAttendance(req: Request, res: Response) {
  const { date, status, employeeIds, remarks } = req.body;
  if (!date || !status) return res.status(400).json({ success: false, message: "date and status are required" });
  if (!ATTENDANCE_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  const targetEmployees = Array.isArray(employeeIds) && employeeIds.length
    ? await Employee.findAll({ where: { id: employeeIds, owner_id: ownerId } })
    : await Employee.findAll({ where: { owner_id: ownerId, status: "active" } });

  const results: Attendance[] = [];
  for (const employee of targetEmployees) {
    const [record] = await Attendance.findOrCreate({
      where: { employee_id: employee.id, date },
      defaults: {
        owner_id: ownerId,
        shop_id: shopId,
        employee_id: employee.id,
        date,
        status: status as AttendanceStatus,
        remarks: remarks ?? null,
        marked_by_actor_type: actorType,
        marked_by_actor_id: actorId,
      },
    });
    record.status = status as AttendanceStatus;
    if (remarks !== undefined) record.remarks = remarks;
    await record.save();
    results.push(record);
  }

  await logAudit({ req, module: "attendance", action: "bulk_mark", entityType: "Attendance", details: { date, status, count: results.length } });
  return res.status(201).json({ success: true, data: results });
}
