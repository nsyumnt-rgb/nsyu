"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listModules = listModules;
exports.createRole = createRole;
exports.listRoles = listRoles;
exports.updateRolePermissions = updateRolePermissions;
exports.updateRoleFieldPermissions = updateRoleFieldPermissions;
exports.deleteRole = deleteRole;
exports.listShopModules = listShopModules;
exports.updateShopModule = updateShopModule;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const permissions_1 = require("../config/permissions");
const audit_1 = require("../utils/audit");
/** Get all available modules dynamically from the database */
async function listModules(req, res) {
    try {
        const modules = await models_1.Module.findAll({
            where: { is_active: true },
            order: [["sort_order", "ASC"], ["name", "ASC"]],
        });
        return res.json({ success: true, data: modules });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load modules" });
    }
}
/** Owner / Admin: create a custom role */
async function createRole(req, res) {
    const { name, description } = req.body;
    if (!name)
        return res.status(400).json({ success: false, message: "name is required" });
    const role = await models_1.Role.create({
        owner_id: req.auth.ownerId,
        name,
        code: name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        description: description || null,
        is_system: false,
    });
    // Pull active modules dynamically from database (no hardcoding)
    const dbModules = await models_1.Module.findAll({ where: { is_active: true } });
    const rows = dbModules.map((m) => ({
        role_id: role.id,
        module_id: m.id,
        module: m.code,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
        scope: "shop",
    }));
    await models_1.RolePermission.bulkCreate(rows);
    const fieldRows = permissions_1.SENSITIVE_FIELDS.map((field) => ({ role_id: role.id, field, allowed: false }));
    await models_1.RoleFieldPermission.bulkCreate(fieldRows);
    await (0, audit_1.logAudit)({ req, module: "user_management", action: "create_role", entityType: "Role", entityId: role.id });
    return res.status(201).json({ success: true, data: role });
}
/** Lists all system roles (Super Admin, Owner, Staff, User) + any custom roles */
async function listRoles(req, res) {
    try {
        const roles = await models_1.Role.findAll({
            where: {
                [sequelize_1.Op.or]: [
                    { owner_id: req.auth.ownerId },
                    { owner_id: null },
                    { is_system: true },
                ],
            },
            include: [
                { model: models_1.RolePermission, as: "permissions" },
                { model: models_1.RoleFieldPermission, as: "fieldPermissions" },
            ],
            order: [
                ["is_system", "DESC"],
                ["id", "ASC"],
            ],
        });
        return res.json({ success: true, data: roles });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list roles" });
    }
}
/**
 * Update module permissions for a role dynamically.
 * Saves to role_permissions table.
 */
async function updateRolePermissions(req, res) {
    const roleId = Number(req.params.roleId);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: "permissions array is required" });
    }
    const role = await models_1.Role.findOne({
        where: {
            id: roleId,
            [sequelize_1.Op.or]: [{ owner_id: req.auth.ownerId }, { is_system: true }],
        },
    });
    if (!role)
        return res.status(404).json({ success: false, message: "Role not found" });
    // Only Super Admin can modify the Owner role
    if (role.is_system && role.code === "owner" && !req.auth.isSuperAdmin) {
        return res.status(400).json({ success: false, message: "The Owner system role cannot be modified by standard users" });
    }
    const before = await models_1.RolePermission.findAll({ where: { role_id: roleId } });
    const beforeMap = new Map(before.map((p) => [p.module, p.toJSON()]));
    // Dynamic upsert based on module code / module_id
    const dbModules = await models_1.Module.findAll();
    const moduleMap = new Map(dbModules.map((m) => [m.code, m.id]));
    for (const p of permissions) {
        const moduleCode = (0, permissions_1.toCanonicalModule)(p.module);
        const moduleId = p.module_id || moduleMap.get(moduleCode) || null;
        const existing = await models_1.RolePermission.findOne({
            where: {
                role_id: roleId,
                [sequelize_1.Op.or]: [{ module: moduleCode }, { module: p.module }],
            },
        });
        if (existing) {
            await existing.update({
                module_id: moduleId ?? existing.module_id,
                module: moduleCode,
                can_view: !!p.can_view,
                can_create: !!p.can_create,
                can_edit: !!p.can_edit,
                can_delete: !!p.can_delete,
                scope: p.scope || existing.scope || "shop",
            });
        }
        else {
            await models_1.RolePermission.create({
                role_id: roleId,
                module_id: moduleId,
                module: moduleCode,
                can_view: !!p.can_view,
                can_create: !!p.can_create,
                can_edit: !!p.can_edit,
                can_delete: !!p.can_delete,
                scope: p.scope || "shop",
            });
        }
    }
    await (0, audit_1.logAudit)({
        req,
        module: "role_permissions",
        action: "permission_change",
        entityType: "Role",
        entityId: roleId,
        oldValue: { permissions: Object.fromEntries(beforeMap) },
        newValue: { permissions },
    });
    return res.json({ success: true, message: "Permissions updated successfully" });
}
/** Update sensitive field visibility */
async function updateRoleFieldPermissions(req, res) {
    const roleId = Number(req.params.roleId);
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
        return res.status(400).json({ success: false, message: "fields array is required" });
    }
    const role = await models_1.Role.findOne({
        where: {
            id: roleId,
            [sequelize_1.Op.or]: [{ owner_id: req.auth.ownerId }, { is_system: true }],
        },
    });
    if (!role)
        return res.status(404).json({ success: false, message: "Role not found" });
    for (const f of fields) {
        const existing = await models_1.RoleFieldPermission.findOne({
            where: { role_id: roleId, field: f.field },
        });
        if (existing) {
            await existing.update({ allowed: !!f.allowed });
        }
        else {
            await models_1.RoleFieldPermission.create({
                role_id: roleId,
                field: f.field,
                allowed: !!f.allowed,
            });
        }
    }
    await (0, audit_1.logAudit)({ req, module: "role_permissions", action: "update_role_field_permissions", entityType: "Role", entityId: roleId });
    return res.json({ success: true, message: "Field permissions updated" });
}
/** Delete a custom role */
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
    await (0, audit_1.logAudit)({ req, module: "role_permissions", action: "delete_role", entityType: "Role", entityId: roleId });
    return res.json({ success: true, message: "Role deleted" });
}
/** List shop-level module activations */
async function listShopModules(req, res) {
    const shopId = Number(req.params.shopId || req.auth?.shopId);
    if (!shopId)
        return res.status(400).json({ success: false, message: "shopId is required" });
    try {
        const shopModules = await models_1.ShopModule.findAll({
            where: { shop_id: shopId },
            include: [{ model: models_1.Module, as: "module" }],
        });
        return res.json({ success: true, data: shopModules });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list shop modules" });
    }
}
/** Enable or disable module for a shop (Super Admin / Owner) */
async function updateShopModule(req, res) {
    const shopId = Number(req.params.shopId);
    const { module_code, is_enabled } = req.body;
    if (!shopId || !module_code) {
        return res.status(400).json({ success: false, message: "shopId and module_code are required" });
    }
    const mod = await models_1.Module.findOne({ where: { code: module_code } });
    if (!mod)
        return res.status(404).json({ success: false, message: "Module not found" });
    const [shopMod] = await models_1.ShopModule.findOrCreate({
        where: { shop_id: shopId, module_id: mod.id },
        defaults: { shop_id: shopId, module_id: mod.id, module_code, is_enabled: !!is_enabled },
    });
    await shopMod.update({ is_enabled: !!is_enabled });
    return res.json({ success: true, data: shopMod });
}
//# sourceMappingURL=roleController.js.map