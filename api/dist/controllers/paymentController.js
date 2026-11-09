"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayments = listPayments;
exports.getPayment = getPayment;
exports.createPayment = createPayment;
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
async function createPayment(req, res) {
    const { customerId, amount, type, method, transactionId, paymentDate, notes, saleId } = req.body;
    const ownerId = req.auth.ownerId;
    const shopId = req.body.shopId ? Number(req.body.shopId) : (req.auth.shopId || 1);
    const actorType = req.auth.isOwner ? "owner" : "employee";
    const actorId = req.auth.isOwner ? req.auth.ownerId : (req.auth.employeeId || 1);
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ success: false, message: "Valid payment amount is required" });
    }
    const validMethods = ["cash", "upi", "bank_transfer", "card", "cheque", "other"];
    let cleanMethod = String(method || "cash").toLowerCase().trim();
    if (cleanMethod === "online")
        cleanMethod = "upi";
    if (!validMethods.includes(cleanMethod))
        cleanMethod = "cash";
    const validTypes = ["sale_payment", "down_payment", "emi_payment", "refund"];
    let cleanType = String(type || "sale_payment").toLowerCase().trim();
    if (!validTypes.includes(cleanType))
        cleanType = "sale_payment";
    try {
        const result = await models_2.sequelize.transaction(async (t) => {
            let targetCustId = customerId ? Number(customerId) : null;
            if (!targetCustId || isNaN(targetCustId)) {
                const firstCust = await models_1.Customer.findOne({ where: { owner_id: ownerId }, transaction: t });
                if (!firstCust)
                    throw Object.assign(new Error("No customer found"), { status: 404 });
                targetCustId = firstCust.id;
            }
            const payment = await models_1.Payment.create({
                owner_id: ownerId,
                shop_id: shopId,
                customer_id: targetCustId,
                sale_id: saleId ? Number(saleId) : null,
                type: cleanType,
                amount: numAmount,
                method: cleanMethod,
                transaction_id: transactionId || null,
                payment_date: paymentDate ? new Date(paymentDate) : new Date(),
                notes: notes || "Payment received",
                status: "completed",
                actor_type: actorType,
                actor_id: actorId,
                reference_code: `RCP-${Date.now()}`,
            }, { transaction: t });
            // Record ledger credit entry to update customer balance
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId,
                customerId: targetCustId,
                entryType: "credit",
                amount: numAmount,
                referenceType: "Payment",
                referenceId: payment.id,
                description: notes || `Payment received (${cleanMethod.toUpperCase()})`,
                actorType,
                actorId,
                entryDate: payment.payment_date,
                externalTransaction: t,
            });
            // If saleId provided, update that sale
            if (saleId) {
                const sale = await models_1.Sale.findOne({ where: { id: saleId, owner_id: ownerId }, transaction: t, lock: t.LOCK.UPDATE });
                if (sale) {
                    sale.paid_amount = Number(sale.paid_amount) + numAmount;
                    sale.due_amount = Math.max(0, Number(sale.total_amount) - sale.paid_amount);
                    sale.status = sale.due_amount <= 0 ? "paid" : "partially_paid";
                    await sale.save({ transaction: t });
                }
            }
            else {
                // Allocate to unpaid sales chronologically
                const unpaidSales = await models_1.Sale.findAll({
                    where: {
                        owner_id: ownerId,
                        customer_id: targetCustId,
                        status: ["unpaid", "partially_paid"],
                    },
                    order: [["created_at", "ASC"]],
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                let remaining = numAmount;
                for (const s of unpaidSales) {
                    if (remaining <= 0)
                        break;
                    const due = Math.max(0, Number(s.due_amount));
                    const apply = Math.min(remaining, due);
                    s.paid_amount = Number(s.paid_amount) + apply;
                    s.due_amount = Math.max(0, Number(s.total_amount) - s.paid_amount);
                    s.status = s.due_amount <= 0 ? "paid" : "partially_paid";
                    await s.save({ transaction: t });
                    remaining -= apply;
                }
            }
            await (0, audit_1.logAudit)({
                req,
                module: "payments",
                action: "create",
                entityType: "Payment",
                entityId: payment.id,
                details: { amount: numAmount, method: cleanMethod, customerId: targetCustId },
            });
            return payment;
        });
        const fullPayment = await models_1.Payment.findByPk(result.id, {
            include: [
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Sale, as: "sale" },
                { model: models_1.Shop, as: "shop" },
            ],
        });
        return res.status(201).json({ success: true, data: fullPayment });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
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