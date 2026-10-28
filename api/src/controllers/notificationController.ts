import { Request, Response } from "express";
import { Notification } from "../models";
import { getComputedAlerts } from "../utils/notifications";

function recipientFromReq(req: Request) {
  return {
    recipientType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    recipientId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

/** The current actor's own notifications (owner sees owner-addressed ones, employee sees their own — never each other's). */
export async function listMyNotifications(req: Request, res: Response) {
  const { recipientType, recipientId } = recipientFromReq(req);
  const { unreadOnly } = req.query;

  const where: any = { owner_id: req.auth!.ownerId, recipient_type: recipientType, recipient_id: recipientId };
  if (unreadOnly === "true") where.is_read = false;

  const notifications = await Notification.findAll({ where, order: [["created_at", "DESC"]], limit: 100 });
  const unreadCount = await Notification.count({
    where: { owner_id: req.auth!.ownerId, recipient_type: recipientType, recipient_id: recipientId, is_read: false },
  });

  return res.json({ success: true, data: { notifications, unreadCount } });
}

export async function markRead(req: Request, res: Response) {
  const { recipientType, recipientId } = recipientFromReq(req);
  const notification = await Notification.findOne({
    where: { id: req.params.notificationId, owner_id: req.auth!.ownerId, recipient_type: recipientType, recipient_id: recipientId },
  });
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });

  notification.is_read = true;
  await notification.save();
  return res.json({ success: true, data: notification });
}

export async function markAllRead(req: Request, res: Response) {
  const { recipientType, recipientId } = recipientFromReq(req);
  await Notification.update(
    { is_read: true },
    { where: { owner_id: req.auth!.ownerId, recipient_type: recipientType, recipient_id: recipientId, is_read: false } }
  );
  return res.json({ success: true, message: "All notifications marked read" });
}

/** Owner/manager: live-computed operational alerts (low stock, overdue EMI, pending leave) — see utils/notifications.ts. */
export async function getAlerts(req: Request, res: Response) {
  const alerts = await getComputedAlerts(req.auth!.ownerId, req.auth!.shopId ?? undefined);
  return res.json({ success: true, data: alerts });
}
