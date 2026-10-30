import { Request, Response } from "express";
import { Op } from "sequelize";
import { Role, RolePermission, RoleFieldPermission, Module, ShopModule, UserRole } from "../models";
import { SENSITIVE_FIELDS, toCanonicalModule } from "../config/permissions";
import { logAudit } from "../utils/audit";

/** Get all available modules dynamically from the database */
export async function listModules(req: Request, res: Response) {
  try {
    const modules = await Module.findAll({
      where: { is_active: true },
      order: [["sort_order", "ASC"], ["name", "ASC"]],
    });
    return res.json({ success: true, data: modules });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load modules" });
  }
}

/** Owner / Admin: create a custom role */
export async function createRole(req: Request, res: Response) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name is required" });

  const role = await Role.create({
    owner_id: req.auth!.ownerId,
    name,
    code: name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
    description: description || null,
    is_system: false,
  });

  // Pull active modules dynamically from database (no hardcoding)
  const dbModules = await Module.findAll({ where: { is_active: true } });
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
  await RolePermission.bulkCreate(rows);

  const fieldRows = SENSITIVE_FIELDS.map((field) => ({ role_id: role.id, field, allowed: false }));
  await RoleFieldPermission.bulkCreate(fieldRows);

  await logAudit({ req, module: "user_management", action: "create_role", entityType: "Role", entityId: role.id });

  return res.status(201).json({ success: true, data: role });
}

/** Lists all system roles (Super Admin, Owner, Staff, User) + any custom roles */
export async function listRoles(req: Request, res: Response) {
  try {
    const roles = await Role.findAll({
      where: {
        [Op.or]: [
          { owner_id: req.auth!.ownerId },
          { owner_id: null },
          { is_system: true },
        ],
      },
      include: [
        { model: RolePermission, as: "permissions" },
        { model: RoleFieldPermission, as: "fieldPermissions" },
      ],
      order: [
        ["is_system", "DESC"],
        ["id", "ASC"],
      ],
    });
    return res.json({ success: true, data: roles });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list roles" });
  }
}

/**
 * Update module permissions for a role dynamically.
 * Saves to role_permissions table.
 */
export async function updateRolePermissions(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, message: "permissions array is required" });
  }

  const role = await Role.findOne({
    where: {
      id: roleId,
      [Op.or]: [{ owner_id: req.auth!.ownerId }, { is_system: true }],
    },
  });

  if (!role) return res.status(404).json({ success: false, message: "Role not found" });

  // Only Super Admin can modify the Owner role
  if (role.is_system && role.code === "owner" && !req.auth!.isSuperAdmin) {
    return res.status(400).json({ success: false, message: "The Owner system role cannot be modified by standard users" });
  }

  const before = await RolePermission.findAll({ where: { role_id: roleId } });
  const beforeMap = new Map(before.map((p) => [p.module, p.toJSON()]));

  // Dynamic upsert based on module code / module_id
  const dbModules = await Module.findAll();
  const moduleMap = new Map(dbModules.map((m) => [m.code, m.id]));

  for (const p of permissions) {
    const moduleCode = toCanonicalModule(p.module);
    const moduleId = p.module_id || moduleMap.get(moduleCode) || null;

    const existing = await RolePermission.findOne({
      where: {
        role_id: roleId,
        [Op.or]: [{ module: moduleCode }, { module: p.module }],
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
    } else {
      await RolePermission.create({
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

  await logAudit({
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
export async function updateRoleFieldPermissions(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const { fields } = req.body;

  if (!Array.isArray(fields)) {
    return res.status(400).json({ success: false, message: "fields array is required" });
  }

  const role = await Role.findOne({
    where: {
      id: roleId,
      [Op.or]: [{ owner_id: req.auth!.ownerId }, { is_system: true }],
    },
  });

  if (!role) return res.status(404).json({ success: false, message: "Role not found" });

  for (const f of fields) {
    const existing = await RoleFieldPermission.findOne({
      where: { role_id: roleId, field: f.field },
    });
    if (existing) {
      await existing.update({ allowed: !!f.allowed });
    } else {
      await RoleFieldPermission.create({
        role_id: roleId,
        field: f.field,
        allowed: !!f.allowed,
      });
    }
  }

  await logAudit({ req, module: "role_permissions", action: "update_role_field_permissions", entityType: "Role", entityId: roleId });

  return res.json({ success: true, message: "Field permissions updated" });
}

/** Delete a custom role */
export async function deleteRole(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const role = await Role.findOne({ where: { id: roleId, owner_id: req.auth!.ownerId } });
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });
  if (role.is_system) {
    return res.status(400).json({ success: false, message: "System roles cannot be deleted" });
  }

  await RolePermission.destroy({ where: { role_id: roleId } });
  await RoleFieldPermission.destroy({ where: { role_id: roleId } });
  await role.destroy();

  await logAudit({ req, module: "role_permissions", action: "delete_role", entityType: "Role", entityId: roleId });

  return res.json({ success: true, message: "Role deleted" });
}

/** List shop-level module activations */
export async function listShopModules(req: Request, res: Response) {
  const shopId = Number(req.params.shopId || req.auth?.shopId);
  if (!shopId) return res.status(400).json({ success: false, message: "shopId is required" });

  try {
    const shopModules = await ShopModule.findAll({
      where: { shop_id: shopId },
      include: [{ model: Module, as: "module" }],
    });
    return res.json({ success: true, data: shopModules });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list shop modules" });
  }
}

/** Enable or disable module for a shop (Super Admin / Owner) */
export async function updateShopModule(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const { module_code, is_enabled } = req.body;

  if (!shopId || !module_code) {
    return res.status(400).json({ success: false, message: "shopId and module_code are required" });
  }

  const mod = await Module.findOne({ where: { code: module_code } });
  if (!mod) return res.status(404).json({ success: false, message: "Module not found" });

  const [shopMod] = await ShopModule.findOrCreate({
    where: { shop_id: shopId, module_id: mod.id },
    defaults: { shop_id: shopId, module_id: mod.id, module_code, is_enabled: !!is_enabled },
  });

  await shopMod.update({ is_enabled: !!is_enabled });

  return res.json({ success: true, data: shopMod });
}
