"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRole = createRole;
exports.listRoles = listRoles;
exports.updateRolePermissions = updateRolePermissions;
exports.updateRoleFieldPermissions = updateRoleFieldPermissions;
exports.deleteRole = deleteRole;
const models_1 = require("../models");
const permissions_1 = require("../config/permissions");
const audit_1 = require("../utils/audit");
/** Owner-only: create a custom role (e.g. "Store Supervisor"). */
async function createRole(req, res) {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ success: false, message: "name is required" });
    const role = await models_1.Role.create({ owner_id: req.auth.ownerId, name, is_system: false });
    // Start with everything OFF; owner explicitly grants what's needed
    const rows = permissions_1.MODULES.map((module) => ({ role_id: role.id, module, can_view: false, can_create: false, can_edit: false, can_delete: false }));
    await models_1.RolePermission.bulkCreate(rows);
    const fieldRows = permissions_1.SENSITIVE_FIELDS.map((field) => ({ role_id: role.id, field, allowed: false }));
    await models_1.RoleFieldPermission.bulkCreate(fieldRows);
    await (0, audit_1.logAudit)({ req, module: "employees", action: "create_role", entityType: "Role", entityId: role.id });
    return res.status(201).json({ success: true, data: role });
}
async function listRoles(req, res) {
    const roles = await models_1.Role.findAll({
        where: { owner_id: req.auth.ownerId },
        include: [
            { model: models_1.RolePermission, as: "permissions" },
            { model: models_1.RoleFieldPermission, as: "fieldPermissions" },
        ],
    });
    return res.json({ success: true, data: roles });
}
/**
 * Owner-only: update the module-level (view/create/edit/delete)
 * permission grid for a role. Body shape:
 * { permissions: [{ module: "products", can_view: true, can_create: true, ... }, ...] }
 */
async function updateRolePermissions(req, res) {
    const roleId = Number(req.params.roleId);
    const { permissions } = req.body;
    const role = await models_1.Role.findOne({ where: { id: roleId, owner_id: req.auth.ownerId } });
    if (!role)
        return res.status(404).json({ success: false, message: "Role not found" });
    if (role.is_system && role.name === "Owner") {
        return res.status(400).json({ success: false, message: "The Owner role cannot be modified" });
    }
    const before = await models_1.RolePermission.findAll({ where: { role_id: roleId } });
    const beforeMap = new Map(before.map((p) => [p.module, p.toJSON()]));
    for (const p of permissions) {
        await models_1.RolePermission.update({ can_view: !!p.can_view, can_create: !!p.can_create, can_edit: !!p.can_edit, can_delete: !!p.can_delete }, { where: { role_id: roleId, module: p.module } });
    }
    await (0, audit_1.logAudit)({
        req,
        module: "employees",
        action: "permission_change",
        entityType: "Role",
        entityId: roleId,
        oldValue: { permissions: Object.fromEntries(beforeMap) },
        newValue: { permissions },
    });
    return res.json({ success: true, message: "Permissions updated" });
}
/**
 * Owner-only: update sensitive field visibility for a role.
 * Body shape: { fields: [{ field: "profit", allowed: true }, ...] }
 */
async function updateRoleFieldPermissions(req, res) {
    const roleId = Number(req.params.roleId);
    const { fields } = req.body;
    const role = await models_1.Role.findOne({ where: { id: roleId, owner_id: req.auth.ownerId } });
    if (!role)
        return res.status(404).json({ success: false, message: "Role not found" });
    for (const f of fields) {
        await models_1.RoleFieldPermission.update({ allowed: !!f.allowed }, { where: { role_id: roleId, field: f.field } });
    }
    await (0, audit_1.logAudit)({ req, module: "employees", action: "update_role_field_permissions", entityType: "Role", entityId: roleId });
    return res.json({ success: true, message: "Field permissions updated" });
}
/** Owner-only: delete a custom role (system roles are protected). */
async function deleteRole(req, res) {
    const roleId = Number(req.params.roleId);
    const role = await models_1.Role.findOne({ where: { id: roleId, owner_id: req.auth.ownerId } });
    if (!role)
        return res.status(404).json({ success: false, message: "Role not found" });
    if (role.is_system) {
        return res.status(400).json({ success: false, message: "System roles cannot be deleted" });
    }
    await models_1.RolePermission.destroy({ where: { role_id: roleId } });
    await models_1.RoleFieldPermission.destroy({ where: { role_id: roleId } });
    await role.destroy();
    await (0, audit_1.logAudit)({ req, module: "employees", action: "delete_role", entityType: "Role", entityId: roleId });
    return res.json({ success: true, message: "Role deleted" });
}
//# sourceMappingURL=roleController.js.map