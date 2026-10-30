"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireSelfOrPermission = requireSelfOrPermission;
exports.getAllowedFields = getAllowedFields;
exports.stripFields = stripFields;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const permissions_1 = require("../config/permissions");
/**
 * Backend API permission enforcement for dynamic RBAC.
 *
 * Rules:
 * 1. Super Admin: Full system control across all shops and modules.
 * 2. Owner: Full shop access to own shop modules, blocked from platform modules.
 * 3. Staff: Checked dynamically against role_permissions in DB + shop_modules enabled.
 * 4. User (Customer): Limited to customer portal operations (catalog view, self orders).
 */
function requirePermission(module, action) {
    return async (req, res, next) => {
        const auth = req.auth;
        if (!auth) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const canonicalModule = (0, permissions_1.toCanonicalModule)(module);
        // 1. Super Admin has unrestricted access to all modules and shops
        if (auth.isSuperAdmin || auth.roleCode === "super_admin" || auth.roleName === "Super Admin") {
            return next();
        }
        // 2. Global platform modules restricted to Super Admin only
        const SUPER_ADMIN_ONLY_MODULES = ["all_shops", "subscriptions", "system_settings"];
        if (SUPER_ADMIN_ONLY_MODULES.includes(canonicalModule)) {
            return res.status(403).json({
                success: false,
                message: `Only Super Admin can access the ${canonicalModule} module`,
            });
        }
        // 3. User / Customer Portal restrictions
        if (auth.isCustomer || auth.roleCode === "user" || auth.roleName === "User") {
            if (canonicalModule === "products" && action === "view") {
                return next();
            }
            if (canonicalModule === "orders" && (action === "view" || action === "create")) {
                return next();
            }
            return res.status(403).json({
                success: false,
                message: "Customer access is restricted to customer portal features only",
            });
        }
        // 4. Owner has full business control within their own shop for shop-level modules
        if (auth.isOwner) {
            return next();
        }
        // 5. Staff / Employee: Check dynamic permissions from DB
        if (!auth.roleId) {
            return res.status(403).json({ success: false, message: "No role assigned for this shop" });
        }
        // Check shop_modules table if current shop disabled this module
        if (auth.shopId) {
            try {
                const shopMod = await models_1.ShopModule.findOne({
                    where: {
                        shop_id: auth.shopId,
                        module_code: canonicalModule,
                    },
                });
                if (shopMod && !shopMod.is_enabled) {
                    return res.status(403).json({
                        success: false,
                        message: `Module ${canonicalModule} is deactivated for this shop`,
                    });
                }
            }
            catch (err) {
                // Fallback gracefully if shop_modules lookup fails
            }
        }
        // Check dynamic RolePermission row
        const permission = await models_1.RolePermission.findOne({
            where: {
                role_id: auth.roleId,
                [sequelize_1.Op.or]: [{ module: canonicalModule }, { module: module }],
            },
        });
        const columnMap = {
            view: "can_view",
            create: "can_create",
            edit: "can_edit",
            delete: "can_delete",
        };
        const allowed = permission ? Boolean(permission[columnMap[action]]) : false;
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: `You do not have permission to ${action} ${canonicalModule}`,
            });
        }
        return next();
    };
}
/**
 * Self-service routes (viewing own attendance, orders, profile):
 * Allows the user if the record belongs to them, or falls back to requirePermission.
 */
function requireSelfOrPermission(module, action, resolveTargetEmployeeId) {
    return async (req, res, next) => {
        const auth = req.auth;
        if (!auth)
            return res.status(401).json({ success: false, message: "Authentication required" });
        if (auth.isSuperAdmin || auth.roleCode === "super_admin")
            return next();
        if (auth.isOwner)
            return next();
        const targetEmployeeId = resolveTargetEmployeeId(req);
        const isSelf = targetEmployeeId === undefined || targetEmployeeId === auth.employeeId;
        if (isSelf)
            return next();
        return requirePermission(module, action)(req, res, next);
    };
}
/**
 * Loads allowed sensitive fields (purchase_price, profit, etc.) for current role.
 */
async function getAllowedFields(req, fields) {
    const result = {};
    // Super Admin & Owner see everything
    if (req.auth?.isSuperAdmin || req.auth?.roleCode === "super_admin" || req.auth?.isOwner) {
        fields.forEach((f) => (result[f] = true));
        return result;
    }
    if (!req.auth?.roleId) {
        fields.forEach((f) => (result[f] = false));
        return result;
    }
    const rows = await models_1.RoleFieldPermission.findAll({
        where: { role_id: req.auth.roleId, field: fields },
    });
    const allowedSet = new Set(rows.filter((r) => r.allowed).map((r) => r.field));
    fields.forEach((f) => (result[f] = allowedSet.has(f)));
    return result;
}
function stripFields(record, allowed) {
    const copy = { ...record };
    for (const [field, isAllowed] of Object.entries(allowed)) {
        if (!isAllowed && field in copy) {
            delete copy[field];
        }
    }
    return copy;
}
//# sourceMappingURL=permission.js.map