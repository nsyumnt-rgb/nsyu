"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireShop = requireShop;
exports.requireOwner = requireOwner;
const jwt_1 = require("../utils/jwt");
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
        req.auth = (0, jwt_1.verifyAccessToken)(token);
        return next();
    }
    catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}
const models_1 = require("../models");
/**
 * Every module route (products, sales, billing...) needs an active
 * shop context. This guarantees req.auth.shopId is present before
 * the controller runs, so controllers never have to null-check it.
 */
async function requireShop(req, res, next) {
    if (!req.auth?.shopId) {
        if (req.auth?.isOwner) {
            try {
                const firstShop = await models_1.Shop.findOne({ where: { owner_id: req.auth.ownerId }, order: [["id", "ASC"]] });
                if (firstShop) {
                    req.auth.shopId = firstShop.id;
                    return next();
                }
            }
            catch {
                // Proceed to rejection
            }
        }
        return res.status(400).json({
            success: false,
            message: "No shop selected. Call /api/shops/switch first.",
        });
    }
    return next();
}
/**
 * Shortcut for routes only the Owner account itself may call
 * (e.g. creating shops, creating roles, deleting employees).
 */
function requireOwner(req, res, next) {
    if (!req.auth?.isOwner) {
        return res.status(403).json({ success: false, message: "Owner access required" });
    }
    return next();
}
//# sourceMappingURL=auth.js.map