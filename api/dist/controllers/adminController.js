"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminDashboard = getAdminDashboard;
exports.getAdminShops = getAdminShops;
exports.createAdminShop = createAdminShop;
exports.updateAdminShop = updateAdminShop;
exports.toggleAdminShopStatus = toggleAdminShopStatus;
exports.getAdminOwners = getAdminOwners;
exports.createAdminOwner = createAdminOwner;
exports.resetAdminOwnerPassword = resetAdminOwnerPassword;
exports.toggleAdminOwnerStatus = toggleAdminOwnerStatus;
exports.getAdminAuditLogs = getAdminAuditLogs;
exports.getAdminShopSupportData = getAdminShopSupportData;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const models_1 = require("../models");
const seed_1 = require("../utils/seed");
/**
 * Helper to record Super Admin actions in the platform audit log.
 */
async function logSuperAdminAction(req, action, targetType, targetId, targetName, details = {}) {
    try {
        const superAdminId = req.auth?.ownerId || 0;
        const superAdminEmail = req.auth?.email || "superadmin@nsyu.com";
        const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
        await models_1.PlatformAuditLog.create({
            super_admin_id: superAdminId,
            super_admin_email: superAdminEmail,
            action,
            target_type: targetType,
            target_id: targetId || null,
            target_name: targetName || null,
            details,
            ip_address: ipAddress.split(",")[0].trim(),
        });
    }
    catch (err) {
        console.error("Failed to write platform audit log:", err);
    }
}
/**
 * 1. GET /api/admin/dashboard
 * Real database queries: total shops, active/suspended shops, total users, total sales across platform.
 */
async function getAdminDashboard(req, res) {
    try {
        const [totalShops, activeShops, suspendedShops, totalOwners, totalEmployees, totalCustomers, salesAgg, recentLogs,] = await Promise.all([
            models_1.Shop.count(),
            models_1.Shop.count({ where: { status: "active" } }),
            models_1.Shop.count({ where: { status: "suspended" } }),
            models_1.Owner.count({ where: { is_super_admin: false } }),
            models_1.Employee.count(),
            models_1.Customer.count(),
            models_1.Sale.findOne({
                attributes: [
                    [database_1.default.fn("COUNT", database_1.default.col("id")), "total_sales_count"],
                    [database_1.default.fn("COALESCE", database_1.default.fn("SUM", database_1.default.col("total_amount")), 0), "total_sales_amount"],
                ],
                where: { status: { [sequelize_1.Op.ne]: "cancelled" } },
                raw: true,
            }),
            models_1.PlatformAuditLog.findAll({
                order: [["created_at", "DESC"]],
                limit: 10,
            }),
        ]);
        const totalUsers = (totalOwners || 0) + (totalEmployees || 0) + (totalCustomers || 0);
        const totalSalesAmount = Number(salesAgg?.total_sales_amount || 0);
        const totalSalesCount = Number(salesAgg?.total_sales_count || 0);
        return res.json({
            success: true,
            data: {
                total_shops: totalShops,
                active_shops: activeShops,
                suspended_shops: suspendedShops,
                total_users: totalUsers,
                total_owners: totalOwners,
                total_employees: totalEmployees,
                total_customers: totalCustomers,
                total_sales_amount: totalSalesAmount,
                total_sales_count: totalSalesCount,
                recent_activity: recentLogs,
            },
        });
    }
    catch (error) {
        console.error("Error fetching admin dashboard:", error);
        return res.status(500).json({ success: false, message: "Failed to load dashboard metrics" });
    }
}
/**
 * 2. GET /api/admin/shops
 * List all shops with owner details and operational status.
 */
async function getAdminShops(req, res) {
    try {
        const shops = await models_1.Shop.findAll({
            include: [
                {
                    model: models_1.Owner,
                    as: "owner",
                    attributes: ["id", "name", "email", "phone", "status"],
                },
            ],
            order: [["id", "ASC"]],
        });
        return res.json({
            success: true,
            data: shops,
        });
    }
    catch (error) {
        console.error("Error fetching shops:", error);
        return res.status(500).json({ success: false, message: "Failed to load shops" });
    }
}
/**
 * 3. POST /api/admin/shops
 * Create a shop under an owner.
 */
async function createAdminShop(req, res) {
    try {
        const { name, code, owner_id, address, phone, email } = req.body;
        if (!name || !code || !owner_id) {
            return res.status(400).json({ success: false, message: "name, code, and owner_id are required" });
        }
        const owner = await models_1.Owner.findByPk(owner_id);
        if (!owner) {
            return res.status(404).json({ success: false, message: "Owner not found" });
        }
        const existingCode = await models_1.Shop.findOne({ where: { owner_id, code: code.trim().toUpperCase() } });
        if (existingCode) {
            return res.status(409).json({ success: false, message: "Shop code already exists for this owner" });
        }
        const shop = await models_1.Shop.create({
            owner_id,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            address: address?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            status: "active",
        });
        await logSuperAdminAction(req, "CREATE_SHOP", "shop", shop.id, shop.name, { code: shop.code, owner_id: shop.owner_id });
        return res.status(201).json({
            success: true,
            message: "Shop created successfully",
            data: shop,
        });
    }
    catch (error) {
        console.error("Error creating shop:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to create shop" });
    }
}
/**
 * 4. PUT /api/admin/shops/:id
 * Edit shop basics (name, address, phone, email).
 */
async function updateAdminShop(req, res) {
    try {
        const shopId = Number(req.params.id);
        const { name, address, phone, email } = req.body;
        const shop = await models_1.Shop.findByPk(shopId);
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        const oldData = { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email };
        if (name)
            shop.name = name.trim();
        if (address !== undefined)
            shop.address = address ? address.trim() : null;
        if (phone !== undefined)
            shop.phone = phone ? phone.trim() : null;
        if (email !== undefined)
            shop.email = email ? email.trim() : null;
        await shop.save();
        await logSuperAdminAction(req, "UPDATE_SHOP", "shop", shop.id, shop.name, { old: oldData, updated: { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email } });
        return res.json({
            success: true,
            message: "Shop updated successfully",
            data: shop,
        });
    }
    catch (error) {
        console.error("Error updating shop:", error);
        return res.status(500).json({ success: false, message: "Failed to update shop" });
    }
}
/**
 * 5. PATCH /api/admin/shops/:id/status
 * Activate or suspend a shop.
 * Suspended shop blocks login and API access for all of its users.
 */
async function toggleAdminShopStatus(req, res) {
    const transaction = await database_1.default.transaction();
    try {
        const shopId = Number(req.params.id);
        const { status, reason } = req.body;
        if (!["active", "suspended"].includes(status)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Invalid status. Must be 'active' or 'suspended'" });
        }
        const shop = await models_1.Shop.findByPk(shopId, { transaction });
        if (!shop) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        const oldStatus = shop.status;
        shop.status = status;
        await shop.save({ transaction });
        // Record in status_history
        await models_1.StatusHistory.create({
            shop_id: shop.id,
            entity_type: "shop",
            entity_id: shop.id,
            old_status: oldStatus,
            new_status: status,
            changed_by_id: req.auth?.ownerId || 0,
            changed_by_role: "super_admin",
            reason: reason || `Shop status set to ${status} by Super Admin`,
        }, { transaction });
        await transaction.commit();
        // Log to platform audit log
        await logSuperAdminAction(req, status === "suspended" ? "SUSPEND_SHOP" : "ACTIVATE_SHOP", "shop", shop.id, shop.name, { old_status: oldStatus, new_status: status, reason });
        return res.json({
            success: true,
            message: `Shop successfully ${status === "suspended" ? "suspended" : "activated"}`,
            data: shop,
        });
    }
    catch (error) {
        await transaction.rollback();
        console.error("Error changing shop status:", error);
        return res.status(500).json({ success: false, message: "Failed to update shop status" });
    }
}
/**
 * 6. GET /api/admin/owners
 * List all owners with shop count, status, and details.
 */
async function getAdminOwners(req, res) {
    try {
        const owners = await models_1.Owner.findAll({
            attributes: { exclude: ["password"] },
            include: [
                {
                    model: models_1.Shop,
                    as: "shops",
                    attributes: ["id", "name", "code", "status"],
                },
            ],
            order: [["id", "ASC"]],
        });
        return res.json({
            success: true,
            data: owners,
        });
    }
    catch (error) {
        console.error("Error fetching owners:", error);
        return res.status(500).json({ success: false, message: "Failed to load owners" });
    }
}
/**
 * 7. POST /api/admin/owners
 * Create the first Owner for a shop.
 */
async function createAdminOwner(req, res) {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "name, email and password are required" });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await models_1.Owner.findOne({ where: { email: normalizedEmail } });
        if (existing) {
            return res.status(409).json({ success: false, message: "Email is already registered as an Owner" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const owner = await models_1.Owner.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone?.trim() || null,
            status: "active",
            is_super_admin: false,
            role: "owner",
        });
        // Seed default roles and permissions for the new owner
        await (0, seed_1.seedOwnerDefaults)(owner.id);
        await logSuperAdminAction(req, "CREATE_OWNER", "owner", owner.id, owner.name, { email: owner.email, phone: owner.phone });
        const result = owner.toJSON();
        delete result.password;
        return res.status(201).json({
            success: true,
            message: "Owner created successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error creating owner:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to create owner" });
    }
}
/**
 * 8. PATCH /api/admin/owners/:id/password
 * Reset an Owner's password.
 */
async function resetAdminOwnerPassword(req, res) {
    try {
        const ownerId = Number(req.params.id);
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }
        const owner = await models_1.Owner.findByPk(ownerId);
        if (!owner) {
            return res.status(404).json({ success: false, message: "Owner not found" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        owner.password = hashedPassword;
        await owner.save();
        await logSuperAdminAction(req, "RESET_OWNER_PASSWORD", "owner", owner.id, owner.name, { email: owner.email });
        return res.json({
            success: true,
            message: "Password reset successfully for owner",
        });
    }
    catch (error) {
        console.error("Error resetting owner password:", error);
        return res.status(500).json({ success: false, message: "Failed to reset password" });
    }
}
/**
 * 9. PATCH /api/admin/owners/:id/status
 * Activate or deactivate an Owner.
 */
async function toggleAdminOwnerStatus(req, res) {
    try {
        const ownerId = Number(req.params.id);
        const { status, reason } = req.body;
        if (!["active", "inactive", "suspended"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }
        const owner = await models_1.Owner.findByPk(ownerId);
        if (!owner) {
            return res.status(404).json({ success: false, message: "Owner not found" });
        }
        if (owner.is_super_admin) {
            return res.status(403).json({ success: false, message: "Cannot modify status of a Super Admin account" });
        }
        const oldStatus = owner.status;
        owner.status = status;
        await owner.save();
        await logSuperAdminAction(req, "UPDATE_OWNER_STATUS", "owner", owner.id, owner.name, { old_status: oldStatus, new_status: status, reason });
        return res.json({
            success: true,
            message: `Owner status updated to ${status}`,
            data: { id: owner.id, email: owner.email, status: owner.status },
        });
    }
    catch (error) {
        console.error("Error toggling owner status:", error);
        return res.status(500).json({ success: false, message: "Failed to update owner status" });
    }
}
/**
 * 10. GET /api/admin/audit-logs
 * List all platform audit logs.
 */
async function getAdminAuditLogs(req, res) {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const { count, rows } = await models_1.PlatformAuditLog.findAndCountAll({
            order: [["created_at", "DESC"]],
            limit,
            offset,
        });
        return res.json({
            success: true,
            data: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
                logs: rows,
            },
        });
    }
    catch (error) {
        console.error("Error fetching audit logs:", error);
        return res.status(500).json({ success: false, message: "Failed to load audit logs" });
    }
}
/**
 * 11. GET /api/admin/shops/:id/data
 * Read-only support view of any shop's business data.
 * STRICTLY READ-ONLY — NO WRITES ALLOWED.
 */
async function getAdminShopSupportData(req, res) {
    try {
        const shopId = Number(req.params.id);
        const shop = await models_1.Shop.findByPk(shopId, {
            include: [
                {
                    model: models_1.Owner,
                    as: "owner",
                    attributes: ["id", "name", "email", "phone"],
                },
            ],
        });
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        const [billsCount, ordersCount, customersCount, productsCount, recentBills, recentOrders, inventorySummary, customersList,] = await Promise.all([
            models_1.Sale.count({ where: { shop_id: shopId } }),
            models_1.Order.count({ where: { shop_id: shopId } }),
            models_1.Customer.count({ where: { owner_id: shop.owner_id } }),
            models_1.ProductStock.count({ where: { shop_id: shopId } }),
            models_1.Sale.findAll({
                where: { shop_id: shopId },
                order: [["created_at", "DESC"]],
                limit: 15,
            }),
            models_1.Order.findAll({
                where: { shop_id: shopId },
                order: [["created_at", "DESC"]],
                limit: 15,
            }),
            models_1.ProductStock.findAll({
                where: { shop_id: shopId },
                include: [{ model: models_1.Product, as: "product" }],
                limit: 30,
            }),
            models_1.Customer.findAll({
                where: { owner_id: shop.owner_id },
                limit: 30,
            }),
        ]);
        await logSuperAdminAction(req, "VIEW_SHOP_SUPPORT_DATA", "shop", shop.id, shop.name, { shop_id: shop.id });
        return res.json({
            success: true,
            data: {
                shop,
                stats: {
                    billsCount,
                    ordersCount,
                    customersCount,
                    productsCount,
                },
                recentBills,
                recentOrders,
                inventorySummary,
                customersList,
            },
        });
    }
    catch (error) {
        console.error("Error fetching shop support data:", error);
        return res.status(500).json({ success: false, message: "Failed to load shop support data" });
    }
}
//# sourceMappingURL=adminController.js.map