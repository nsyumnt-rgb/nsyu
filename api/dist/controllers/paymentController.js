"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayments = listPayments;
exports.getPayment = getPayment;
exports.cancelPayment = cancelPayment;
exports.downloadReceiptPdf = downloadReceiptPdf;
const models_1 = require("../models");
const pdf_1 = require("../utils/pdf");
const audit_1 = require("../utils/audit");
const ledger_1 = require("../utils/ledger");
const models_2 = require("../models");
async function listPayments(req, res) {
    const { customerId, saleId, type, allShops } = req.query;
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
    if (customerId)
        where.customer_id = customerId;
    if (saleId)
        where.sale_id = saleId;
    if (type)
        where.type = type;
    const payments = await models_1.Payment.findAll({
        where,
        include: [
            { model: models_1.Customer, as: "customer", attributes: ["id", "name", "phone"] },
            { model: models_1.Sale, as: "sale", attributes: ["id", "invoice_number"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.EMIInstallment, as: "installment", attributes: ["id", "installment_number"] },
        ],
        order: [["payment_date", "DESC"]],
        limit: Number(req.query.limit) || 100,
    });
    return res.json({ success: true, data: payments });
}
async function getPayment(req, res) {
    const param = String(req.params.paymentId).trim();
    const digitsMatch = param.match(/\d+$/);
    const numericId = digitsMatch ? Number(digitsMatch[0]) : null;
    const where = { owner_id: req.auth.ownerId };
    if (numericId !== null && !isNaN(numericId)) {
        where.id = numericId;
    }
    else {
        where.transaction_id = param;
    }
    if (!req.auth.isOwner) {
        where.shop_id = req.auth.shopId;
    }
    const payment = await models_1.Payment.findOne({
        where,
        include: [
            { model: models_1.Customer, as: "customer" },
            { model: models_1.Sale, as: "sale" },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.EMIInstallment, as: "installment" },
        ],
    });
    if (!payment)
        return res.status(404).json({ success: false, message: "Payment not found" });
    return res.json({ success: true, data: payment });
}
/**
 * Voids a payment: never deletes it. Flips status to "cancelled" and
 * posts a reversing debit on the customer ledger, then re-syncs the
 * owning Sale's / EMI installment's paid/due amounts.
 */
async function cancelPayment(req, res) {
    const { reason } = req.body;
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const actorType = req.auth.isOwner ? "owner" : "employee";
    const actorId = req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId;
    try {
        await models_2.sequelize.transaction(async (t) => {
            const where = { id: req.params.paymentId, owner_id: ownerId };
            if (!req.auth.isOwner) {
                where.shop_id = shopId;
            }
            const payment = await models_1.Payment.findOne({
                where,
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!payment)
                throw Object.assign(new Error("Payment not found"), { status: 404 });
            if (payment.status === "cancelled")
                throw Object.assign(new Error("Payment already cancelled"), { status: 400 });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: payment.shop_id,
                customerId: payment.customer_id,
                entryType: "debit",
                amount: Number(payment.amount),
                referenceType: "PaymentCancellation",
                referenceId: payment.id,
                description: `Reversal of payment #${payment.id}${reason ? `: ${reason}` : ""}`,
                actorType: actorType,
                actorId: actorId,
                externalTransaction: t,
            });
            payment.status = "cancelled";
            payment.notes = [payment.notes, reason ? `Cancelled: ${reason}` : "Cancelled"].filter(Boolean).join(" | ");
            await payment.save({ transaction: t });
            if (payment.sale_id) {
                const sale = await models_1.Sale.findOne({ where: { id: payment.sale_id }, transaction: t, lock: t.LOCK.UPDATE });
                if (sale) {
                    sale.paid_amount = Math.max(0, Number(sale.paid_amount) - Number(payment.amount));
                    sale.due_amount = Number(sale.total_amount) - sale.paid_amount;
                    sale.status = sale.due_amount <= 0 ? "paid" : sale.paid_amount > 0 ? "partially_paid" : "unpaid";
                    await sale.save({ transaction: t });
                }
            }
            if (payment.emi_installment_id) {
                const installment = await models_1.EMIInstallment.findOne({
                    where: { id: payment.emi_installment_id },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                if (installment) {
                    installment.paid_amount = Math.max(0, Number(installment.paid_amount) - Number(payment.amount));
                    installment.remaining_amount = Number(installment.expected_amount) + Number(installment.late_fee) - installment.paid_amount;
                    installment.status = installment.paid_amount > 0 ? "Partially Paid" : "Due";
                    await installment.save({ transaction: t });
                }
            }
            await (0, audit_1.logAudit)({ req, module: "payments", action: "cancel", entityType: "Payment", entityId: payment.id, details: { reason } });
        });
        const payment = await models_1.Payment.findByPk(req.params.paymentId, {
            include: [
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Sale, as: "sale" },
                { model: models_1.Shop, as: "shop" },
            ],
        });
        return res.json({ success: true, data: payment });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
async function downloadReceiptPdf(req, res) {
    const where = { id: req.params.paymentId, owner_id: req.auth.ownerId };
    if (!req.auth.isOwner) {
        where.shop_id = req.auth.shopId;
    }
    const payment = await models_1.Payment.findOne({
        where,
        include: [
            { model: models_1.Customer, as: "customer" },
            { model: models_1.Sale, as: "sale" },
            { model: models_1.EMIInstallment, as: "installment" },
            { model: models_1.Shop, as: "shop" },
        ],
    });
    if (!payment)
        return res.status(404).json({ success: false, message: "Payment not found" });
    (0, pdf_1.streamReceiptPdf)(res, payment.toJSON());
}
//# sourceMappingURL=paymentController.js.map