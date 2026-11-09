"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyNotifications = listMyNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markRead = markRead;
exports.markAllRead = markAllRead;
exports.getAlerts = getAlerts;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const notifications_1 = require("../utils/notifications");
function buildNotificationWhere(req) {
    const ownerId = req.auth.ownerId;
    const isOwner = req.auth.isOwner || req.auth.isSuperAdmin;
    const employeeId = req.auth.employeeId;
    const shopId = req.auth.shopId;
    const where = { owner_id: ownerId };
    if (isOwner) {
        // Owner sees all owner-addressed notifications, shop-addressed, or unassigned notifications
        where[sequelize_1.Op.or] = [
            { recipient_type: "owner" },
            { recipient_type: null },
            ...(shopId ? [{ shop_id: shopId }] : []),
        ];
    }
    else {
        // Employee sees notifications specifically for them OR owner/shop notifications for their active shop
        const orClauses = [];
        if (employeeId) {
            orClauses.push({ recipient_type: "employee", recipient_id: employeeId });
        }
        if (shopId) {
            orClauses.push({ shop_id: shopId, recipient_type: "owner" });
        }
        else {
            orClauses.push({ recipient_type: "owner" });
        }
        where[sequelize_1.Op.or] = orClauses;
    }
    return where;
}
/** The current actor's own notifications. */
async function listMyNotifications(req, res) {
    const { unreadOnly, limit } = req.query;
    const where = buildNotificationWhere(req);
    if (unreadOnly === "true") {
        where.is_read = false;
    }
    const maxLimit = Math.min(Number(limit) || 50, 100);
    const notifications = await models_1.Notification.findAll({
        where,
        order: [["created_at", "DESC"]],
        limit: maxLimit,
    });
    const countWhere = buildNotificationWhere(req);
    countWhere.is_read = false;
    const unreadCount = await models_1.Notification.count({ where: countWhere });
    return res.json({ success: true, data: { notifications, unreadCount } });
}
async function getUnreadCount(req, res) {
    const countWhere = buildNotificationWhere(req);
    countWhere.is_read = false;
    const unreadCount = await models_1.Notification.count({ where: countWhere });
    return res.json({ success: true, data: { unreadCount } });
}
async function markRead(req, res) {
    const notification = await models_1.Notification.findOne({
        where: { id: req.params.notificationId, owner_id: req.auth.ownerId },
    });
    if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found" });
    }
    notification.is_read = true;
    await notification.save();
    return res.json({ success: true, data: notification });
}
async function markAllRead(req, res) {
    const where = buildNotificationWhere(req);
    where.is_read = false;
    await models_1.Notification.update({ is_read: true }, { where });
    return res.json({ success: true, message: "All notifications marked read" });
}
/** Owner/manager: live-computed operational alerts (low stock, overdue EMI, pending leave) — see utils/notifications.ts. */
async function getAlerts(req, res) {
    const alerts = await (0, notifications_1.getComputedAlerts)(req.auth.ownerId, req.auth.shopId ?? undefined);
    return res.json({ success: true, data: alerts });
}
//# sourceMappingURL=notificationController.js.map