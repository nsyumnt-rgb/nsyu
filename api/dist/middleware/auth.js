"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireCustomer = requireCustomer;
exports.requireShop = requireShop;
exports.requireOwner = requireOwner;
exports.requireSuperAdmin = requireSuperAdmin;
const jwt_1 = require("../utils/jwt");
const models_1 = require("../models");
/**
 * Verifies the access token and attaches req.auth.
 * Does NOT check shop selection or permissions — see requireShop()
 * and requirePermission() for that. Keeping these separate means
 * routes can require "logged in" without requiring "shop selected"
 * (e.g. GET /shops, POST /shops/switch).
 */
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const token = header.split(" ")[1];
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        if (payload.isCustomer) {
            return res.status(403).json({ success: false, message: "Customer tokens cannot access staff endpoints" });
        }
        req.auth = payload;
        return next();
    }
    catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}
/**
 * Verifies customer access token, verifies account is Active in DB,
 * and attaches req.customer.
 * Rejects staff tokens with 403, and deactivated accounts with 401.
 * Suspended shop blocks customer access.
 */
async function requireCustomer(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const token = header.split(" ")[1];
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.auth = payload;
        if (!payload.isCustomer || !payload.customerId || !payload.accountId) {
            return res.status(403).json({ success: false, message: "Staff tokens cannot access customer portal" });
        }
        const account = await models_1.CustomerAccount.findByPk(payload.accountId);
        if (!account || account.status !== "active") {
            return res.status(401).json({ success: false, message: "Customer account is disabled or inactive" });
        }
        // Check if shop is suspended
        const shop = await models_1.Shop.findByPk(account.shop_id);
        if (!shop || shop.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Shop is suspended. Access blocked. Contact system administrator.",
            });
        }
        req.customer = {
            customerId: account.customer_id,
            shopId: account.shop_id,
            ownerId: account.owner_id,
            accountId: account.id,
            phone: account.phone,
        };
        return next();
    }
    catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}
/**
 * Every module route (products, sales, billing...) needs an active
 * shop context. This guarantees req.auth.shopId is present before
 * the controller runs, so controllers never have to null-check it.
 * If shop is suspended, rejects with 403.
 */
async function requireShop(req, res, next) {
    if (req.auth?.isSuperAdmin) {
        return next();
    }
    if (!req.auth?.shopId) {
        if (req.auth?.isOwner) {
            try {
                const firstShop = await models_1.Shop.findOne({ where: { owner_id: req.auth.ownerId }, order: [["id", "ASC"]] });
                if (firstShop) {
                    req.auth.shopId = firstShop.id;
                }
            }
            catch {
                // Proceed to rejection
            }
        }
    }
    if (!req.auth?.shopId) {
        return res.status(400).json({
            success: false,
            message: "No shop selected. Call /api/shops/switch first.",
        });
    }
    try {
        const shop = await models_1.Shop.findByPk(req.auth.shopId);
        if (!shop || shop.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Shop is suspended. Access blocked. Contact system administrator.",
            });
        }
    }
    catch (err) {
        console.error("Error checking shop status:", err);
    }
    return next();
}
/**
 * Shortcut for routes only the Owner account itself may call
 * (e.g. creating shops, creating roles, deleting employees).
 */
function requireOwner(req, res, next) {
    if (req.auth?.isSuperAdmin) {
        return next();
    }
    if (!req.auth?.isOwner) {
        return res.status(403).json({ success: false, message: "Owner access required" });
    }
    return next();
}
/**
 * Middleware strictly for Super Admin endpoints (/api/admin/*)
 */
function requireSuperAdmin(req, res, next) {
    if (!req.auth?.isSuperAdmin) {
        return res.status(403).json({ success: false, message: "Super Admin access required" });
    }
    return next();
}
//# sourceMappingURL=auth.js.map