"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const models_1 = require("../models");
/**
 * Fire-and-forget audit trail. Call this from controllers after any
 * write action so there's always a record of who did what, when,
 * from which shop, and — for field-level changes — the old/new
 * values, e.g.:
 *
 *   await logAudit({ req, module: "products", action: "price_change",
 *                     entityType: "Product", entityId: product.id,
 *                     oldValue: { selling_price: 100 }, newValue: { selling_price: 120 } });
 */
async function logAudit({ req, module, action, entityType, entityId, oldValue, newValue, details }) {
    if (!req.auth)
        return;
    try {
        await models_1.AuditLog.create({
            owner_id: req.auth.ownerId,
            shop_id: req.auth.shopId ?? null,
            actor_type: req.auth.isOwner ? "owner" : "employee",
            actor_id: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
            module,
            action,
            entity_type: entityType ?? null,
            entity_id: entityId ?? null,
            old_value: oldValue ? JSON.stringify(oldValue) : null,
            new_value: newValue ? JSON.stringify(newValue) : null,
            details: details ? JSON.stringify(details) : null,
            ip_address: req.ip,
        });
    }
    catch (err) {
        // Audit logging must never break the actual request
        console.error("Audit log failed:", err);
    }
}
//# sourceMappingURL=audit.js.map