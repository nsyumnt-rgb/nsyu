"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupplierLedger = getSupplierLedger;
exports.listSupplierOutstanding = listSupplierOutstanding;
exports.listSupplierPayments = listSupplierPayments;
const models_1 = require("../models");
async function getSupplierLedger(req, res) {
    const supplier = await models_1.Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth.ownerId } });
    if (!supplier)
        return res.status(404).json({ success: false, message: "Supplier not found" });
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
    const where = { owner_id: req.auth.ownerId, supplier_id: supplier.id };
    if (targetShopId)
        where.shop_id = targetShopId;
    const entries = await models_1.SupplierLedger.findAll({
        where,
        include: [{ model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] }],
        order: [
            ["entry_date", "ASC"],
            ["id", "ASC"],
        ],
    });
    const totalDebit = entries.filter((e) => e.entry_type === "debit" && e.status === "active").reduce((s, e) => s + Number(e.amount), 0);
    const totalCredit = entries.filter((e) => e.entry_type === "credit" && e.status === "active").reduce((s, e) => s + Number(e.amount), 0);
    // In supplier ledger: credit = purchase, debit = payment. Outstanding = credit - debit
    const shopBalance = Math.round((totalCredit - totalDebit) * 100) / 100;
    return res.json({
        success: true,
        data: {
            supplier,
            currentBalance: Number(supplier.current_balance),
            shopBalance,
            isShopScoped: !!targetShopId,
            scopedShopId: targetShopId ?? null,
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            entries,
        },
    });
}
/** Every supplier the owner currently owes money to. */
async function listSupplierOutstanding(req, res) {
    const suppliers = await models_1.Supplier.findAll({ where: { owner_id: req.auth.ownerId }, order: [["current_balance", "DESC"]] });
    const outstanding = suppliers.filter((s) => Number(s.current_balance) !== 0);
    return res.json({ success: true, data: outstanding });
}
/** Listing of money paid out to suppliers. */
async function listSupplierPayments(req, res) {
    const { supplierId, allShops } = req.query;
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
    if (supplierId)
        where.supplier_id = supplierId;
    const payments = await models_1.SupplierPayment.findAll({
        where,
        include: [
            { model: models_1.Supplier, as: "supplier", attributes: ["id", "name"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
        ],
        order: [["payment_date", "DESC"]],
        limit: Number(req.query.limit) || 100,
    });
    return res.json({ success: true, data: payments });
}
//# sourceMappingURL=supplierLedgerController.js.map