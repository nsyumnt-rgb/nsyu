import { Request, Response } from "express";
import { Op } from "sequelize";
import { Notification, EmailNotification, Customer } from "../models";
import { getComputedAlerts } from "../utils/notifications";
import { retryEmailNotification, retryAllFailedEmails } from "../utils/mailer";

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

/* ---------------- Email Notification History & Retries ---------------- */

export async function listEmailHistory(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const { customerId, status, notificationType, limit, offset } = req.query;

    const where: any = { owner_id: ownerId };
    if (!req.auth!.isOwner && req.auth!.shopId) {
      where.shop_id = req.auth!.shopId;
    }
    if (customerId) where.customer_id = Number(customerId);
    if (status) where.status = String(status);
    if (notificationType) where.notification_type = String(notificationType);

    const limitNum = Math.min(Number(limit) || 50, 100);
    const offsetNum = Number(offset) || 0;

    const { count, rows } = await EmailNotification.findAndCountAll({
      where,
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone", "email"] },
      ],
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset: offsetNum,
    });

    return res.json({
      success: true,
      data: {
        total: count,
        emails: rows,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load email history" });
  }
}

export async function retryEmail(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const id = Number(req.params.id);

    const result = await retryEmailNotification(id, ownerId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to retry email" });
  }
}

export async function retryFailedEmailsEndpoint(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const shopId = req.auth!.isOwner ? (req.query.shopId ? Number(req.query.shopId) : undefined) : req.auth!.shopId;

    const summary = await retryAllFailedEmails(ownerId, shopId);
    return res.json({ success: true, data: summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to retry failed emails" });
  }
}
