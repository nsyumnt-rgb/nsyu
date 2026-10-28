import { Request, Response } from "express";
import { sequelize, LeaveRequest, Employee, Attendance } from "../models";
import { daysBetweenInclusive, eachDateInRange } from "../utils/attendance";
import { logAudit } from "../utils/audit";
import { notifyOwner, notifyEmployee } from "../utils/notifications";

function actorFromReq(req: Request) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

/** Self-service (or owner-on-behalf-of, if employeeId given): raise a leave request. */
export async function requestLeave(req: Request, res: Response) {
  const { leaveType, startDate, endDate, reason } = req.body;
  const employeeId = req.auth!.isOwner ? req.body.employeeId : req.auth!.employeeId;

  if (!employeeId) return res.status(400).json({ success: false, message: "employeeId is required" });
  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: "leaveType, startDate and endDate are required" });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  const days = daysBetweenInclusive(startDate, endDate);

  const leave = await LeaveRequest.create({
    owner_id: ownerId,
    shop_id: shopId,
    employee_id: employeeId,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    days,
    reason: reason ?? null,
  });

  await logAudit({ req, module: "leave", action: "request", entityType: "LeaveRequest", entityId: leave.id });

  await notifyOwner(ownerId, {
    shopId,
    type: "leave_requested",
    title: "New leave request",
    message: `${employee.name} requested ${days} day(s) leave (${startDate} to ${endDate})`,
    referenceType: "LeaveRequest",
    referenceId: leave.id,
  });

  return res.status(201).json({ success: true, data: leave });
}

export async function getMyLeaves(req: Request, res: Response) {
  if (!req.auth!.employeeId) return res.status(400).json({ success: false, message: "This endpoint is for employees" });
  const leaves = await LeaveRequest.findAll({
    where: { employee_id: req.auth!.employeeId },
    order: [["created_at", "DESC"]],
  });
  return res.json({ success: true, data: leaves });
}

/** Owner/manager: list leave requests across employees, filterable by employee/status. */
export async function listLeaves(req: Request, res: Response) {
  const { employeeId, status } = req.query;
  const where: any = { owner_id: req.auth!.ownerId, shop_id: req.auth!.shopId };
  if (employeeId) where.employee_id = employeeId;
  if (status) where.status = status;

  const leaves = await LeaveRequest.findAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name", "email"] }],
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
export async function decideLeave(req: Request, res: Response) {
  const { decision, isPaid, note } = req.body; // decision: "approve" | "reject"
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ success: false, message: "decision must be 'approve' or 'reject'" });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const result = await sequelize.transaction(async (t) => {
      const leave = await LeaveRequest.findOne({
        where: { id: req.params.leaveId, owner_id: ownerId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!leave) throw Object.assign(new Error("Leave request not found"), { status: 404 });
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
        for (const date of eachDateInRange(leave.start_date, leave.end_date)) {
          const [record] = await Attendance.findOrCreate({
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

    await logAudit({ req, module: "leave", action: decision, entityType: "LeaveRequest", entityId: result, details: { isPaid } });
    const leave = await LeaveRequest.findByPk(result);

    if (leave) {
      await notifyEmployee(ownerId, leave.employee_id, {
        shopId,
        type: "leave_decided",
        title: `Leave ${leave.status}`,
        message: `Your leave request (${leave.start_date} to ${leave.end_date}) was ${leave.status.toLowerCase()}${
          note ? `: ${note}` : ""
        }`,
        referenceType: "LeaveRequest",
        referenceId: leave.id,
      });
    }

    return res.json({ success: true, data: leave });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/** Self-service or owner: cancel a still-pending leave request. */
export async function cancelLeave(req: Request, res: Response) {
  const leave = await LeaveRequest.findOne({ where: { id: req.params.leaveId, owner_id: req.auth!.ownerId } });
  if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });

  if (!req.auth!.isOwner && leave.employee_id !== req.auth!.employeeId) {
    return res.status(403).json({ success: false, message: "You can only cancel your own leave requests" });
  }
  if (leave.status !== "Pending") {
    return res.status(400).json({ success: false, message: `Cannot cancel a leave request that is already ${leave.status}` });
  }

  leave.status = "Cancelled";
  await leave.save();

  await logAudit({ req, module: "leave", action: "cancel", entityType: "LeaveRequest", entityId: leave.id });
  return res.json({ success: true, data: leave });
}
