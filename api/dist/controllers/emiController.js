"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEmiPlans = listEmiPlans;
exports.getEmiPlan = getEmiPlan;
exports.listDueInstallments = listDueInstallments;
exports.payInstallment = payInstallment;
exports.cancelEmiPlan = cancelEmiPlan;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const Sale_1 = require("../models/Sale");
const ledger_1 = require("../utils/ledger");
const emi_1 = require("../utils/emi");
const audit_1 = require("../utils/audit");
function round2(n) {
    return Math.round(n * 100) / 100;
}
function actorFromReq(req) {
    return {
        actorType: (req.auth.isOwner ? "owner" : "employee"),
        actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
async function listEmiPlans(req, res) {
    const { customerId, status, allShops } = req.query;
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
    if (status)
        where.status = status;
    const plans = await models_1.EMIPlan.findAll({
        where,
        include: [
            { model: models_1.Customer, as: "customer", attributes: ["id", "name", "phone"] },
            { model: models_1.Sale, as: "sale", attributes: ["id", "invoice_number"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.EMIInstallment, as: "installments" },
        ],
        order: [["created_at", "DESC"]],
    });
    for (const plan of plans) {
        await (0, emi_1.refreshInstallmentStatuses)(plan.installments);
    }
    return res.json({ success: true, data: plans });
}
async function getEmiPlan(req, res) {
    const param = String(req.params.planId).trim();
    const digitsMatch = param.match(/\d+$/);
    const numericId = digitsMatch ? Number(digitsMatch[0]) : null;
    const where = { owner_id: req.auth.ownerId };
    if (numericId !== null && !isNaN(numericId)) {
        where.id = numericId;
    }
    if (!req.auth.isOwner) {
        where.shop_id = req.auth.shopId;
    }
    let plan = await models_1.EMIPlan.findOne({
        where,
        include: [
            { model: models_1.Customer, as: "customer" },
            { model: models_1.Sale, as: "sale" },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.EMIInstallment, as: "installments" },
        ],
        order: [[{ model: models_1.EMIInstallment, as: "installments" }, "installment_number", "ASC"]],
    });
    // If not found by ID, try searching by sale invoice_number
    if (!plan) {
        const saleMatch = await models_1.Sale.findOne({
            where: { owner_id: req.auth.ownerId, invoice_number: { [sequelize_1.Op.iLike]: param } },
            attributes: ["id"],
        });
        if (saleMatch) {
            plan = await models_1.EMIPlan.findOne({
                where: { owner_id: req.auth.ownerId, sale_id: saleMatch.id },
                include: [
                    { model: models_1.Customer, as: "customer" },
                    { model: models_1.Sale, as: "sale" },
                    { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
                    { model: models_1.EMIInstallment, as: "installments" },
                ],
                order: [[{ model: models_1.EMIInstallment, as: "installments" }, "installment_number", "ASC"]],
            });
        }
    }
    if (!plan)
        return res.status(404).json({ success: false, message: "EMI plan not found" });
    await (0, emi_1.refreshInstallmentStatuses)(plan.installments);
    return res.json({ success: true, data: plan });
}
/** Installments due/overdue across all EMI plans for the current shop — for a collections dashboard. */
async function listDueInstallments(req, res) {
    let targetShopId;
    if (req.auth.isOwner) {
        if (req.query.allShops === "true") {
            targetShopId = undefined;
        }
        else {
            targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth.shopId || undefined;
        }
    }
    else {
        targetShopId = req.auth.shopId || undefined;
    }
    const where = { owner_id: req.auth.ownerId, status: "active" };
    if (targetShopId)
        where.shop_id = targetShopId;
    const plans = await models_1.EMIPlan.findAll({
        where,
        include: [
            { model: models_1.Customer, as: "customer", attributes: ["id", "name", "phone"] },
            { model: models_1.Sale, as: "sale", attributes: ["id", "invoice_number"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.EMIInstallment, as: "installments" },
        ],
    });
    const rows = [];
    for (const plan of plans) {
        const installments = await (0, emi_1.refreshInstallmentStatuses)(plan.installments);
        for (const inst of installments) {
            if (["Due", "Overdue", "Partially Paid"].includes(inst.status)) {
                rows.push({
                    installment: inst,
                    plan: { id: plan.id, saleId: plan.sale_id, shop: plan.shop },
                    customer: plan.customer,
                    sale: plan.sale,
                });
            }
        }
    }
    rows.sort((a, b) => new Date(a.installment.due_date).getTime() - new Date(b.installment.due_date).getTime());
    return res.json({ success: true, data: rows });
}
/**
 * EMI payment received: Payment record -> EMI installment update ->
 * Customer ledger update -> Outstanding update, all inside one DB
 * transaction. Auto-applies a late fee the first time an overdue
 * installment is paid, if the plan has late_fee_percent configured.
 */
async function payInstallment(req, res) {
    const { amount, method, transactionId, paymentDate, notes } = req.body;
    if (!amount || Number(amount) <= 0)
        return res.status(400).json({ success: false, message: "amount must be positive" });
    if (!method || !Sale_1.PAYMENT_METHODS.includes(method)) {
        return res.status(400).json({ success: false, message: `method must be one of: ${Sale_1.PAYMENT_METHODS.join(", ")}` });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const installment = await models_1.EMIInstallment.findOne({
                where: { id: req.params.installmentId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!installment)
                throw Object.assign(new Error("Installment not found"), { status: 404 });
            if (installment.status === "Cancelled")
                throw Object.assign(new Error("Installment is cancelled"), { status: 400 });
            if (installment.status === "Paid")
                throw Object.assign(new Error("Installment is already fully paid"), { status: 400 });
            const planWhere = { id: installment.emi_plan_id, owner_id: ownerId };
            if (!req.auth.isOwner) {
                planWhere.shop_id = shopId;
            }
            const plan = await models_1.EMIPlan.findOne({
                where: planWhere,
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!plan)
                throw Object.assign(new Error("EMI plan not found"), { status: 404 });
            if (plan.status !== "active")
                throw Object.assign(new Error(`EMI plan is ${plan.status}`), { status: 400 });
            // Auto-apply late fee the first time this installment is paid past due_date
            const dueDate = new Date(installment.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const today = new Date(effectivePaymentDate);
            today.setHours(0, 0, 0, 0);
            if (Number(installment.late_fee) === 0 && Number(plan.late_fee_percent) > 0 && today.getTime() > dueDate.getTime()) {
                installment.late_fee = round2((Number(installment.expected_amount) * Number(plan.late_fee_percent)) / 100);
            }
            const owedBefore = round2(Number(installment.expected_amount) + Number(installment.late_fee) - Number(installment.paid_amount));
            const payAmount = round2(Math.min(Number(amount), owedBefore));
            if (payAmount <= 0)
                throw Object.assign(new Error("Installment has no outstanding balance"), { status: 400 });
            const targetShopId = plan.shop_id;
            const payment = await models_1.Payment.create({
                owner_id: ownerId,
                shop_id: targetShopId,
                customer_id: plan.customer_id,
                sale_id: plan.sale_id,
                emi_installment_id: installment.id,
                type: "emi_payment",
                amount: payAmount,
                method: method,
                transaction_id: transactionId ?? null,
                payment_date: effectivePaymentDate,
                notes: notes ?? null,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            installment.paid_amount = round2(Number(installment.paid_amount) + payAmount);
            installment.remaining_amount = round2(Number(installment.expected_amount) + Number(installment.late_fee) - Number(installment.paid_amount));
            installment.payment_date = effectivePaymentDate;
            installment.payment_method = method;
            installment.transaction_id = transactionId ?? installment.transaction_id ?? null;
            installment.status = (0, emi_1.computeInstallmentStatus)(installment);
            await installment.save({ transaction: t });
            const sale = await models_1.Sale.findOne({ where: { id: plan.sale_id }, transaction: t, lock: t.LOCK.UPDATE });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: targetShopId,
                customerId: plan.customer_id,
                entryType: "credit",
                amount: payAmount,
                referenceType: "EMIInstallment",
                referenceId: installment.id,
                description: `EMI installment #${installment.installment_number} for ${sale?.invoice_number ?? "sale " + plan.sale_id}`,
                actorType,
                actorId,
                entryDate: effectivePaymentDate,
                externalTransaction: t,
            });
            // Recompute plan outstanding = sum of remaining_amount across all non-cancelled installments
            const allInstallments = await models_1.EMIInstallment.findAll({ where: { emi_plan_id: plan.id }, transaction: t });
            const outstanding = round2(allInstallments
                .filter((i) => i.status !== "Cancelled")
                .reduce((sum, i) => sum + Number(i.remaining_amount), 0));
            plan.outstanding_amount = outstanding;
            if (outstanding <= 0)
                plan.status = "completed";
            await plan.save({ transaction: t });
            if (sale) {
                sale.paid_amount = round2(Number(sale.paid_amount) + payAmount);
                sale.due_amount = outstanding;
                sale.status = outstanding <= 0 ? "paid" : "partially_paid";
                await sale.save({ transaction: t });
            }
            await (0, audit_1.logAudit)({
                req,
                module: "emi",
                action: "payment",
                entityType: "EMIInstallment",
                entityId: installment.id,
                details: { amount: payAmount, lateFee: installment.late_fee, planId: plan.id },
            });
            return payment.id;
        });
        const payment = await models_1.Payment.findByPk(result, {
            include: [{ model: models_1.EMIInstallment, as: "installment" }],
        });
        return res.status(201).json({ success: true, data: payment });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
/**
 * Cancels an entire EMI plan (e.g. the underlying sale was cancelled,
 * or the customer settled the balance out-of-band). Marks all
 * unpaid/partial installments Cancelled and closes the outstanding
 * ledger debit with a credit — never deletes any row.
 */
async function cancelEmiPlan(req, res) {
    const { reason } = req.body;
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        await models_1.sequelize.transaction(async (t) => {
            const where = { id: req.params.planId, owner_id: ownerId };
            if (!req.auth.isOwner) {
                where.shop_id = shopId;
            }
            const plan = await models_1.EMIPlan.findOne({
                where,
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!plan)
                throw Object.assign(new Error("EMI plan not found"), { status: 404 });
            if (plan.status === "cancelled")
                throw Object.assign(new Error("EMI plan is already cancelled"), { status: 400 });
            const outstanding = Number(plan.outstanding_amount);
            if (outstanding > 0) {
                await (0, ledger_1.recordLedgerEntry)({
                    ownerId,
                    shopId: plan.shop_id,
                    customerId: plan.customer_id,
                    entryType: "credit",
                    amount: outstanding,
                    referenceType: "EMIPlanCancellation",
                    referenceId: plan.id,
                    description: `Cancellation of EMI plan #${plan.id}`,
                    actorType,
                    actorId,
                    externalTransaction: t,
                });
            }
            await models_1.EMIInstallment.update({ status: "Cancelled" }, { where: { emi_plan_id: plan.id, status: ["Upcoming", "Due", "Overdue", "Partially Paid"] }, transaction: t });
            plan.status = "cancelled";
            plan.cancel_reason = reason ?? null;
            plan.outstanding_amount = 0;
            await plan.save({ transaction: t });
            const sale = await models_1.Sale.findOne({ where: { id: plan.sale_id }, transaction: t, lock: t.LOCK.UPDATE });
            if (sale) {
                sale.due_amount = 0;
                sale.status = "cancelled";
                sale.cancel_reason = reason ?? "EMI plan cancelled";
                await sale.save({ transaction: t });
            }
            await (0, audit_1.logAudit)({ req, module: "emi", action: "cancel", entityType: "EMIPlan", entityId: plan.id, details: { reason } });
        });
        const plan = await models_1.EMIPlan.findByPk(req.params.planId, { include: [{ model: models_1.EMIInstallment, as: "installments" }] });
        return res.json({ success: true, data: plan });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
//# sourceMappingURL=emiController.js.map