"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireSelfOrPermission = requireSelfOrPermission;
exports.getAllowedFields = getAllowedFields;
exports.stripFields = stripFields;
const models_1 = require("../models");
/**
 * requirePermission("products", "create")
 *
 * The Owner account bypasses all checks (owner always has full
 * access to their own data). Employees are checked against the
 * RolePermission row for their CURRENT shop's role
 * (req.auth.roleId, set at login / shop-switch time).
 *
 * This runs on the SERVER for every request — permissions are
 * never trusted from the frontend, per the spec requirement that
 * "permissions must work at backend/API level, not only frontend."
 */
function requirePermission(module, action) {
    return async (req, res, next) => {
        const auth = req.auth;
        if (!auth) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        // Owner always has full access to everything under their own account
        if (auth.isOwner)
            return next();
        if (!auth.roleId) {
            return res.status(403).json({ success: false, message: "No role assigned for this shop" });
        }
        const permission = await models_1.RolePermission.findOne({
            where: { role_id: auth.roleId, module },
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
                message: `You do not have permission to ${action} ${module}`,
            });
        }
        return next();
    };
}
/**
 * For self-service modules (attendance, leave, payroll): an employee
 * may always view/act on their OWN records without any RolePermission
 * row, but touching another employee's records — or the Owner acting
 * on any employee's records — requires the normal module permission.
 * The Owner account always passes (see requirePermission above).
 *
 * `resolveTargetEmployeeId` pulls the employee id the request is
 * about (e.g. from req.params.employeeId, or req.body.employeeId for
 * a create). Returning undefined (e.g. "list my own stuff" endpoints
 * with no target param) is treated as "definitely self".
 */
function requireSelfOrPermission(module, action, resolveTargetEmployeeId) {
    return async (req, res, next) => {
        const auth = req.auth;
        if (!auth)
            return res.status(401).json({ success: false, message: "Authentication required" });
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
 * Loads which sensitive fields (purchase_price, profit, salary...)
 * the current actor is allowed to see, and stashes them on the
 * request so controllers can strip disallowed fields from the
 * response before sending it — e.g.:
 *
 *   const allowed = await getAllowedFields(req, ["purchase_price", "profit"]);
 *   const safeProduct = stripFields(product, allowed);
 */
async function getAllowedFields(req, fields) {
    const result = {};
    // Owner sees everything
    if (req.auth?.isOwner) {
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
/**
 * Removes any key from `record` whose corresponding field permission
 * is false. Works on plain objects (call .toJSON() on Sequelize
 * instances first).
 */
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