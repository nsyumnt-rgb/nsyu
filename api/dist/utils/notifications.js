"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = notify;
exports.notifyOwner = notifyOwner;
exports.notifyEmployee = notifyEmployee;
exports.getComputedAlerts = getComputedAlerts;
const Notification_1 = require("../models/Notification");
const models_1 = require("../models");
const emi_1 = require("./emi");
/** Fire-and-forget: creates one persisted notification for a single recipient. Never throws into the caller's flow. */
async function notify(params) {
    try {
        return await Notification_1.Notification.create({
            owner_id: params.ownerId,
            shop_id: params.shopId ?? null,
            recipient_type: params.recipientType,
            recipient_id: params.recipientId,
            type: params.type,
            title: params.title,
            message: params.message,
            reference_type: params.referenceType ?? null,
            reference_id: params.referenceId ?? null,
        });
    }
    catch (err) {
        console.error("Notification creation failed:", err);
        return null;
    }
}
/** Notify the owner account. */
async function notifyOwner(ownerId, params) {
    return notify({ ownerId, recipientType: "owner", recipientId: ownerId, ...params });
}
/** Notify one specific employee. */
async function notifyEmployee(ownerId, employeeId, params) {
    return notify({ ownerId, recipientType: "employee", recipientId: employeeId, ...params });
}
/**
 * Live-computed alerts — NOT persisted, so they never go stale or
 * duplicate. Recomputed on every call from current data: low stock,
 * overdue EMI installments, pending leave requests. Scoped to the
 * current owner + (if given) shop.
 */
async function getComputedAlerts(ownerId, shopId) {
    const stockWhere = { owner_id: ownerId };
    if (shopId)
        stockWhere.shop_id = shopId;
    const stocks = await models_1.ProductStock.findAll({
        where: stockWhere,
        include: [{ model: models_1.Product, as: "product", attributes: ["id", "name", "sku", "min_stock"] }],
    });
    const lowStock = stocks
        .filter((s) => s.current_stock <= (s.min_stock ?? s.product?.min_stock ?? 0))
        .map((s) => ({
        productId: s.product_id,
        productName: s.product?.name,
        sku: s.product?.sku,
        shopId: s.shop_id,
        currentStock: s.current_stock,
        minStock: s.min_stock ?? s.product?.min_stock ?? 0,
    }));
    const planWhere = { owner_id: ownerId, status: "active" };
    if (shopId)
        planWhere.shop_id = shopId;
    const plans = await models_1.EMIPlan.findAll({
        where: planWhere,
        include: [
            { model: models_1.Customer, as: "customer", attributes: ["id", "name", "phone"] },
            { model: models_1.Sale, as: "sale", attributes: ["id", "invoice_number"] },
            { model: models_1.EMIInstallment, as: "installments" },
        ],
    });
    const overdueEmi = [];
    for (const plan of plans) {
        const installments = await (0, emi_1.refreshInstallmentStatuses)(plan.installments);
        for (const inst of installments) {
            if (inst.status === "Overdue") {
                overdueEmi.push({
                    planId: plan.id,
                    customer: plan.customer,
                    sale: plan.sale,
                    installmentNumber: inst.installment_number,
                    dueDate: inst.due_date,
                    remainingAmount: Number(inst.remaining_amount),
                });
            }
        }
    }
    const leaveWhere = { owner_id: ownerId, status: "Pending" };
    if (shopId)
        leaveWhere.shop_id = shopId;
    const pendingLeaves = await models_1.LeaveRequest.findAll({
        where: leaveWhere,
        include: [{ model: models_1.Employee, as: "employee", attributes: ["id", "name"] }],
    });
    return { lowStock, overdueEmi, pendingLeaves };
}
//# sourceMappingURL=notifications.js.map