"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listActivityLogs = listActivityLogs;
const models_1 = require("../models");
async function listActivityLogs(req, res) {
    try {
        const auth = req.auth;
        const where = { owner_id: auth.ownerId };
        // Staff cannot view logs outside their shop context
        if (!auth.isOwner) {
            if (auth.shopId) {
                where.shop_id = auth.shopId;
            }
        }
        else if (req.query.shopId) {
            where.shop_id = Number(req.query.shopId);
        }
        if (req.query.module) {
            where.module = String(req.query.module);
        }
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const logs = await models_1.AuditLog.findAll({
            where,
            order: [["created_at", "DESC"]],
            limit,
        });
        // Populate actor and shop names
        const ownerIds = new Set();
        const employeeIds = new Set();
        const shopIds = new Set();
        for (const log of logs) {
            if (log.actor_type === "owner")
                ownerIds.add(log.actor_id);
            if (log.actor_type === "employee")
                employeeIds.add(log.actor_id);
            if (log.shop_id)
                shopIds.add(log.shop_id);
        }
        const [owners, employees, shops] = await Promise.all([
            ownerIds.size > 0 ? models_1.Owner.findAll({ where: { id: Array.from(ownerIds) }, attributes: ["id", "name", "email"] }) : [],
            employeeIds.size > 0 ? models_1.Employee.findAll({ where: { id: Array.from(employeeIds) }, attributes: ["id", "name", "email"] }) : [],
            shopIds.size > 0 ? models_1.Shop.findAll({ where: { id: Array.from(shopIds) }, attributes: ["id", "name", "code"] }) : [],
        ]);
        const ownerMap = new Map(owners.map((o) => [o.id, o.name]));
        const employeeMap = new Map(employees.map((e) => [e.id, e.name]));
        const shopMap = new Map(shops.map((s) => [s.id, s.name]));
        const enriched = logs.map((log) => {
            const actorName = log.actor_type === "owner"
                ? ownerMap.get(log.actor_id) || "Owner"
                : employeeMap.get(log.actor_id) || "Staff";
            const shopName = log.shop_id ? shopMap.get(log.shop_id) || `Shop #${log.shop_id}` : "All Shops";
            return {
                id: log.id,
                actorType: log.actor_type,
                actorId: log.actor_id,
                actorName,
                module: log.module,
                action: log.action,
                entityType: log.entity_type,
                entityId: log.entity_id,
                shopId: log.shop_id,
                shopName,
                oldValue: log.old_value ? safeParse(log.old_value) : null,
                newValue: log.new_value ? safeParse(log.new_value) : null,
                details: log.details ? safeParse(log.details) : null,
                outcome: "Success",
                createdAt: log.created_at,
            };
        });
        return res.json({ success: true, data: enriched });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
function safeParse(val) {
    try {
        return JSON.parse(val);
    }
    catch {
        return val;
    }
}
//# sourceMappingURL=activityController.js.map