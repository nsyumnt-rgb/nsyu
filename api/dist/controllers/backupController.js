"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportBackup = exportBackup;
exports.validateBackup = validateBackup;
exports.restoreBackup = restoreBackup;
const models_1 = require("../models");
const audit_1 = require("../utils/audit");
async function exportBackup(req, res) {
    try {
        const auth = req.auth;
        const ownerId = auth.ownerId;
        const shopId = auth.shopId;
        const [shops, categories, products, customers, sales, payments] = await Promise.all([
            models_1.Shop.findAll({ where: { owner_id: ownerId } }),
            models_1.Category.findAll({ where: { owner_id: ownerId } }),
            models_1.Product.findAll({ where: { owner_id: ownerId } }),
            models_1.Customer.findAll({ where: { owner_id: ownerId } }),
            models_1.Sale.findAll({
                where: shopId && !auth.isOwner ? { owner_id: ownerId, shop_id: shopId } : { owner_id: ownerId },
                include: [{ model: models_1.SaleItem, as: "items" }],
                limit: 500,
                order: [["id", "DESC"]],
            }),
            models_1.Payment.findAll({
                where: shopId && !auth.isOwner ? { owner_id: ownerId, shop_id: shopId } : { owner_id: ownerId },
                limit: 500,
                order: [["id", "DESC"]],
            }),
        ]);
        const backupData = {
            app: "NSYU Business",
            version: "1.0",
            exportDate: new Date().toISOString(),
            ownerId,
            shopId: shopId ?? 1,
            stats: {
                shopsCount: shops.length,
                categoriesCount: categories.length,
                productsCount: products.length,
                customersCount: customers.length,
                salesCount: sales.length,
                paymentsCount: payments.length,
            },
            data: {
                shops,
                categories,
                products,
                customers,
                sales,
                payments,
            },
        };
        await (0, audit_1.logAudit)({
            req,
            module: "settings",
            action: "backup_export",
            entityType: "Backup",
            details: { stats: backupData.stats },
        });
        return res.json({ success: true, data: backupData });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
async function validateBackup(req, res) {
    try {
        const payload = req.body;
        if (!payload || typeof payload !== "object") {
            return res.status(400).json({ success: false, message: "Invalid backup format: payload must be a JSON object" });
        }
        if (!payload.data || typeof payload.data !== "object") {
            return res.status(400).json({ success: false, message: "Invalid backup format: missing 'data' container" });
        }
        const { products, customers, sales, categories } = payload.data;
        const stats = {
            productsCount: Array.isArray(products) ? products.length : 0,
            customersCount: Array.isArray(customers) ? customers.length : 0,
            salesCount: Array.isArray(sales) ? sales.length : 0,
            categoriesCount: Array.isArray(categories) ? categories.length : 0,
        };
        return res.json({
            success: true,
            valid: true,
            version: payload.version || "1.0",
            exportDate: payload.exportDate || "Unknown",
            stats,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
}
async function restoreBackup(req, res) {
    const t = await models_1.sequelize.transaction();
    try {
        const auth = req.auth;
        if (!auth.isOwner) {
            await t.rollback();
            return res.status(403).json({ success: false, message: "Only the business Owner can restore backups" });
        }
        const payload = req.body;
        if (!payload?.data) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Invalid backup file: missing data block" });
        }
        const ownerId = auth.ownerId;
        let productsRestored = 0;
        let customersRestored = 0;
        // Restore/upsert customers
        if (Array.isArray(payload.data.customers)) {
            for (const c of payload.data.customers) {
                if (!c.name || !c.phone)
                    continue;
                const [customer, created] = await models_1.Customer.findOrCreate({
                    where: { owner_id: ownerId, phone: String(c.phone).trim() },
                    defaults: {
                        owner_id: ownerId,
                        name: String(c.name).trim(),
                        phone: String(c.phone).trim(),
                        address: c.address ?? "",
                        gstin: c.gstin ?? null,
                        opening_balance: c.opening_balance ?? 0,
                        current_balance: c.current_balance ?? 0,
                        status: c.status ?? "active",
                    },
                    transaction: t,
                });
                if (!created) {
                    customer.name = String(c.name).trim();
                    if (c.address)
                        customer.address = c.address;
                    await customer.save({ transaction: t });
                }
                customersRestored++;
            }
        }
        // Restore/upsert products
        if (Array.isArray(payload.data.products)) {
            for (const p of payload.data.products) {
                const prodSku = (p.sku || p.code || "").toString().trim().toUpperCase();
                if (!prodSku || !p.name)
                    continue;
                const [prod, created] = await models_1.Product.findOrCreate({
                    where: { owner_id: ownerId, sku: prodSku },
                    defaults: {
                        owner_id: ownerId,
                        sku: prodSku,
                        name: String(p.name).trim(),
                        category_id: p.category_id ?? null,
                        subcategory_id: p.subcategory_id ?? null,
                        supplier_id: p.supplier_id ?? null,
                        purchase_price: p.purchase_price ?? 0,
                        selling_price: p.selling_price ?? 0,
                        mrp: p.mrp ?? p.selling_price ?? 0,
                        status: p.status ?? "active",
                    },
                    transaction: t,
                });
                if (!created) {
                    prod.name = String(p.name).trim();
                    if (p.purchase_price)
                        prod.purchase_price = p.purchase_price;
                    if (p.selling_price)
                        prod.selling_price = p.selling_price;
                    await prod.save({ transaction: t });
                }
                productsRestored++;
            }
        }
        await t.commit();
        await (0, audit_1.logAudit)({
            req,
            module: "settings",
            action: "backup_restore",
            entityType: "Backup",
            details: { productsRestored, customersRestored },
        });
        return res.json({
            success: true,
            message: `Restoration complete: ${productsRestored} products, ${customersRestored} customers verified and updated.`,
            restored: {
                products: productsRestored,
                customers: customersRestored,
            },
        });
    }
    catch (err) {
        await t.rollback();
        return res.status(500).json({ success: false, message: `Backup restoration failed: ${err.message}` });
    }
}
//# sourceMappingURL=backupController.js.map