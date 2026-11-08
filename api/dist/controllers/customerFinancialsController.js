"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPortalBills = listPortalBills;
exports.getPortalBill = getPortalBill;
exports.downloadPortalBillPdf = downloadPortalBillPdf;
exports.listPortalLedger = listPortalLedger;
exports.getPortalLedgerSummary = getPortalLedgerSummary;
exports.listPortalPayments = listPortalPayments;
exports.listPortalNotifications = listPortalNotifications;
exports.getPortalUnreadCount = getPortalUnreadCount;
exports.markPortalNotificationRead = markPortalNotificationRead;
exports.markAllPortalNotificationsRead = markAllPortalNotificationsRead;
exports.getPortalProfile = getPortalProfile;
exports.updatePortalProfile = updatePortalProfile;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const pdf_1 = require("../utils/pdf");
function round2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * GET /api/customer-portal/bills
 * Paginated bills (Sale) for this customer only.
 */
async function listPortalBills(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const { status, from, to, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
        const offset = (pageNum - 1) * limitNum;
        const where = {
            customer_id: customerId,
            shop_id: shopId,
        };
        if (status && status !== "all") {
            where.status = status;
        }
        if (from || to) {
            where.invoice_date = {};
            if (from)
                where.invoice_date[sequelize_1.Op.gte] = new Date(String(from));
            if (to)
                where.invoice_date[sequelize_1.Op.lte] = new Date(String(to));
        }
        const { count, rows } = await models_1.Sale.findAndCountAll({
            where,
            limit: limitNum,
            offset,
            order: [["invoice_date", "DESC"], ["id", "DESC"]],
            include: [{ model: models_1.SaleItem, as: "items" }],
        });
        return res.json({
            success: true,
            data: rows,
            meta: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(count / limitNum),
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list bills" });
    }
}
/**
 * GET /api/customer-portal/bills/:id
 */
async function getPortalBill(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const billId = Number(req.params.id);
        const bill = await models_1.Sale.findOne({
            where: { id: billId, customer_id: customerId, shop_id: shopId },
            include: [
                { model: models_1.SaleItem, as: "items" },
                { model: models_1.Payment, as: "payments" },
                { model: models_1.Shop, as: "shop", attributes: ["id", "name", "phone", "address", "email"] },
            ],
        });
        if (!bill) {
            return res.status(404).json({ success: false, message: "Bill not found" });
        }
        return res.json({ success: true, data: bill });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load bill" });
    }
}
/**
 * GET /api/customer-portal/bills/:id/pdf
 */
async function downloadPortalBillPdf(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const billId = Number(req.params.id);
        const bill = await models_1.Sale.findOne({
            where: { id: billId, customer_id: customerId, shop_id: shopId },
            include: [
                { model: models_1.SaleItem, as: "items" },
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Shop, as: "shop" },
                { model: models_1.Payment, as: "payments" },
            ],
        });
        if (!bill) {
            return res.status(404).json({ success: false, message: "Bill not found" });
        }
        await (0, pdf_1.streamBillPdf)(res, bill);
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to generate bill PDF" });
    }
}
/**
 * GET /api/customer-portal/ledger
 * Read-only statement of ledger entries with running balance.
 */
async function listPortalLedger(req, res) {
    try {
        const customerId = req.customer.customerId;
        const { from, to, page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
        const offset = (pageNum - 1) * limitNum;
        const where = { customer_id: customerId };
        if (from || to) {
            where.entry_date = {};
            if (from)
                where.entry_date[sequelize_1.Op.gte] = new Date(String(from));
            if (to)
                where.entry_date[sequelize_1.Op.lte] = new Date(String(to));
        }
        const { count, rows } = await models_1.CustomerLedger.findAndCountAll({
            where,
            limit: limitNum,
            offset,
            order: [["entry_date", "ASC"], ["id", "ASC"]],
        });
        return res.json({
            success: true,
            data: rows,
            meta: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(count / limitNum),
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list ledger" });
    }
}
/**
 * GET /api/customer-portal/ledger/summary
 * Current outstanding, last payment and last bill.
 */
async function getPortalLedgerSummary(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const customer = await models_1.Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        const [lastPayment, lastBill] = await Promise.all([
            models_1.Payment.findOne({
                where: { customer_id: customerId },
                order: [["payment_date", "DESC"], ["id", "DESC"]],
            }),
            models_1.Sale.findOne({
                where: { customer_id: customerId, shop_id: shopId },
                order: [["invoice_date", "DESC"], ["id", "DESC"]],
            }),
        ]);
        return res.json({
            success: true,
            data: {
                currentOutstanding: round2(Number(customer.current_balance || 0)),
                lastPaymentDate: lastPayment?.payment_date || null,
                lastPaymentAmount: lastPayment ? round2(Number(lastPayment.amount)) : 0,
                lastBillDate: lastBill?.invoice_date || null,
                lastBillNumber: lastBill?.invoice_number || null,
                lastBillAmount: lastBill ? round2(Number(lastBill.total_amount)) : 0,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load ledger summary" });
    }
}
/**
 * GET /api/customer-portal/payments
 */
async function listPortalPayments(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const payments = await models_1.Payment.findAll({
            where: { customer_id: customerId, shop_id: shopId },
            order: [["payment_date", "DESC"], ["id", "DESC"]],
            include: [{ model: models_1.Sale, as: "sale", attributes: ["id", "invoice_number"] }],
        });
        return res.json({ success: true, data: payments });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list payments" });
    }
}
/**
 * GET /api/customer-portal/notifications
 */
async function listPortalNotifications(req, res) {
    try {
        const customerId = req.customer.customerId;
        const { unread, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
        const offset = (pageNum - 1) * limitNum;
        const where = {
            recipient_type: "customer",
            recipient_id: customerId,
        };
        if (unread === "true") {
            where.is_read = false;
        }
        const { count, rows } = await models_1.Notification.findAndCountAll({
            where,
            limit: limitNum,
            offset,
            order: [["created_at", "DESC"]],
        });
        return res.json({
            success: true,
            data: rows,
            meta: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(count / limitNum),
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list notifications" });
    }
}
/**
 * GET /api/customer-portal/notifications/unread-count
 */
async function getPortalUnreadCount(req, res) {
    try {
        const customerId = req.customer.customerId;
        const count = await models_1.Notification.count({
            where: {
                recipient_type: "customer",
                recipient_id: customerId,
                is_read: false,
            },
        });
        return res.json({ success: true, count });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to get unread count" });
    }
}
/**
 * PATCH /api/customer-portal/notifications/:id/read
 */
async function markPortalNotificationRead(req, res) {
    try {
        const customerId = req.customer.customerId;
        const notifId = Number(req.params.id);
        const notif = await models_1.Notification.findOne({
            where: { id: notifId, recipient_type: "customer", recipient_id: customerId },
        });
        if (!notif) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        notif.is_read = true;
        await notif.save();
        return res.json({ success: true, message: "Marked as read", data: notif });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to update notification" });
    }
}
/**
 * POST /api/customer-portal/notifications/read-all
 */
async function markAllPortalNotificationsRead(req, res) {
    try {
        const customerId = req.customer.customerId;
        await models_1.Notification.update({ is_read: true }, { where: { recipient_type: "customer", recipient_id: customerId, is_read: false } });
        return res.json({ success: true, message: "All notifications marked as read" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to mark all as read" });
    }
}
/**
 * GET /api/customer-portal/me
 */
async function getPortalProfile(req, res) {
    try {
        const customerId = req.customer.customerId;
        const shopId = req.customer.shopId;
        const [customer, shop] = await Promise.all([
            models_1.Customer.findByPk(customerId),
            models_1.Shop.findByPk(shopId),
        ]);
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer profile not found" });
        }
        return res.json({
            success: true,
            data: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                gstin: customer.gstin,
                currentBalance: round2(Number(customer.current_balance || 0)),
                shop: shop
                    ? {
                        id: shop.id,
                        name: shop.name,
                        code: shop.code,
                        phone: shop.phone,
                        email: shop.email,
                        address: shop.address,
                    }
                    : null,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load profile" });
    }
}
/**
 * PATCH /api/customer-portal/me
 * Allows customer to update email and address only.
 */
async function updatePortalProfile(req, res) {
    try {
        const customerId = req.customer.customerId;
        const { email, address } = req.body;
        const customer = await models_1.Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        if (email !== undefined)
            customer.email = email ? String(email).trim() : null;
        if (address !== undefined)
            customer.address = address ? String(address).trim() : null;
        await customer.save();
        return res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to update profile" });
    }
}
//# sourceMappingURL=customerFinancialsController.js.map