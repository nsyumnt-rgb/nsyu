"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyNotifications = listMyNotifications;
exports.markRead = markRead;
exports.markAllRead = markAllRead;
exports.getAlerts = getAlerts;
const models_1 = require("../models");
const notifications_1 = require("../utils/notifications");
function recipientFromReq(req) {
    return {
        recipientType: (req.auth.isOwner ? "owner" : "employee"),
        recipientId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
/** The current actor's own notifications (owner sees owner-addressed ones, employee sees their own — never each other's). */
async function listMyNotifications(req, res) {
    const { recipientType, recipientId } = recipientFromReq(req);
    const { unreadOnly } = req.query;
    const where = { owner_id: req.auth.ownerId, recipient_type: recipientType, recipient_id: recipientId };
    if (unreadOnly === "true")
        where.is_read = false;
    const notifications = await models_1.Notification.findAll({ where, order: [["created_at", "DESC"]], limit: 100 });
    const unreadCount = await models_1.Notification.count({
        where: { owner_id: req.auth.ownerId, recipient_type: recipientType, recipient_id: recipientId, is_read: false },
    });
    return res.json({ success: true, data: { notifications, unreadCount } });
}
async function markRead(req, res) {
    const { recipientType, recipientId } = recipientFromReq(req);
    const notification = await models_1.Notification.findOne({
        where: { id: req.params.notificationId, owner_id: req.auth.ownerId, recipient_type: recipientType, recipient_id: recipientId },
    });
    if (!notification)
        return res.status(404).json({ success: false, message: "Notification not found" });
    notification.is_read = true;
    await notification.save();
    return res.json({ success: true, data: notification });
}
async function markAllRead(req, res) {
    const { recipientType, recipientId } = recipientFromReq(req);
    await models_1.Notification.update({ is_read: true }, { where: { owner_id: req.auth.ownerId, recipient_type: recipientType, recipient_id: recipientId, is_read: false } });
    return res.json({ success: true, message: "All notifications marked read" });
}
/** Owner/manager: live-computed operational alerts (low stock, overdue EMI, pending leave) — see utils/notifications.ts. */
async function getAlerts(req, res) {
    const alerts = await (0, notifications_1.getComputedAlerts)(req.auth.ownerId, req.auth.shopId ?? undefined);
    return res.json({ success: true, data: alerts });
}
//# sourceMappingURL=notificationController.js.map