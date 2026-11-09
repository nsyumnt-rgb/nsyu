import { Request, Response } from "express";
import { Op } from "sequelize";
import { Notification } from "../models";
import { getComputedAlerts } from "../utils/notifications";

function buildNotificationWhere(req: Request) {
  const ownerId = req.auth!.ownerId;
  const isOwner = req.auth!.isOwner || req.auth!.isSuperAdmin;
  const employeeId = req.auth!.employeeId;
  const shopId = req.auth!.shopId;

  const where: any = { owner_id: ownerId };

  if (isOwner) {
    // Owner sees all owner-addressed notifications, shop-addressed, or unassigned notifications
    where[Op.or] = [
      { recipient_type: "owner" },
      { recipient_type: null },
      ...(shopId ? [{ shop_id: shopId }] : []),
    ];
  } else {
    // Employee sees notifications specifically for them OR owner/shop notifications for their active shop
    const orClauses: any[] = [];
    if (employeeId) {
      orClauses.push({ recipient_type: "employee", recipient_id: employeeId });
    }
    if (shopId) {
      orClauses.push({ shop_id: shopId, recipient_type: "owner" });
    } else {
      orClauses.push({ recipient_type: "owner" });
    }
    where[Op.or] = orClauses;
  }
  return where;
}

/** The current actor's own notifications. */
export async function listMyNotifications(req: Request, res: Response) {
  const { unreadOnly, limit } = req.query;
  const where = buildNotificationWhere(req);

  if (unreadOnly === "true") {
    where.is_read = false;
  }

  const maxLimit = Math.min(Number(limit) || 50, 100);

  const notifications = await Notification.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: maxLimit,
  });

  const countWhere = buildNotificationWhere(req);
  countWhere.is_read = false;
  const unreadCount = await Notification.count({ where: countWhere });

  return res.json({ success: true, data: { notifications, unreadCount } });
}

export async function getUnreadCount(req: Request, res: Response) {
  const countWhere = buildNotificationWhere(req);
  countWhere.is_read = false;
  const unreadCount = await Notification.count({ where: countWhere });
  return res.json({ success: true, data: { unreadCount } });
}

export async function markRead(req: Request, res: Response) {
  const notification = await Notification.findOne({
    where: { id: req.params.notificationId, owner_id: req.auth!.ownerId },
  });
  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }

  notification.is_read = true;
  await notification.save();
  return res.json({ success: true, data: notification });
}

export async function markAllRead(req: Request, res: Response) {
  const where = buildNotificationWhere(req);
  where.is_read = false;

  await Notification.update(
    { is_read: true },
    { where }
  );
  return res.json({ success: true, message: "All notifications marked read" });
}

/** Owner/manager: live-computed operational alerts (low stock, overdue EMI, pending leave) — see utils/notifications.ts. */
export async function getAlerts(req: Request, res: Response) {
  const alerts = await getComputedAlerts(req.auth!.ownerId, req.auth!.shopId ?? undefined);
  return res.json({ success: true, data: alerts });
}
