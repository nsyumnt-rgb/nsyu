import { Request, Response } from "express";
import { Role, RolePermission, RoleFieldPermission } from "../models";
import { MODULES, SENSITIVE_FIELDS } from "../config/permissions";
import { logAudit } from "../utils/audit";

/** Owner-only: create a custom role (e.g. "Store Supervisor"). */
export async function createRole(req: Request, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name is required" });

  const role = await Role.create({ owner_id: req.auth!.ownerId, name, is_system: false });

  // Start with everything OFF; owner explicitly grants what's needed
  const rows = MODULES.map((module) => ({ role_id: role.id, module, can_view: false, can_create: false, can_edit: false, can_delete: false }));
  await RolePermission.bulkCreate(rows);

  const fieldRows = SENSITIVE_FIELDS.map((field) => ({ role_id: role.id, field, allowed: false }));
  await RoleFieldPermission.bulkCreate(fieldRows);

  await logAudit({ req, module: "employees", action: "create_role", entityType: "Role", entityId: role.id });

  return res.status(201).json({ success: true, data: role });
}

export async function listRoles(req: Request, res: Response) {
  const roles = await Role.findAll({
    where: { owner_id: req.auth!.ownerId },
    include: [
      { model: RolePermission, as: "permissions" },
      { model: RoleFieldPermission, as: "fieldPermissions" },
    ],
  });
  return res.json({ success: true, data: roles });
}

/**
 * Owner-only: update the module-level (view/create/edit/delete)
 * permission grid for a role. Body shape:
 * { permissions: [{ module: "products", can_view: true, can_create: true, ... }, ...] }
 */
export async function updateRolePermissions(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const { permissions } = req.body;

  const role = await Role.findOne({ where: { id: roleId, owner_id: req.auth!.ownerId } });
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });
  if (role.is_system && role.name === "Owner") {
    return res.status(400).json({ success: false, message: "The Owner role cannot be modified" });
  }

  const before = await RolePermission.findAll({ where: { role_id: roleId } });
  const beforeMap = new Map(before.map((p) => [p.module, p.toJSON()]));

  for (const p of permissions) {
    await RolePermission.update(
      { can_view: !!p.can_view, can_create: !!p.can_create, can_edit: !!p.can_edit, can_delete: !!p.can_delete },
      { where: { role_id: roleId, module: p.module } }
    );
  }

  await logAudit({
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
export async function updateRoleFieldPermissions(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const { fields } = req.body;

  const role = await Role.findOne({ where: { id: roleId, owner_id: req.auth!.ownerId } });
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });

  for (const f of fields) {
    await RoleFieldPermission.update(
      { allowed: !!f.allowed },
      { where: { role_id: roleId, field: f.field } }
    );
  }

  await logAudit({ req, module: "employees", action: "update_role_field_permissions", entityType: "Role", entityId: roleId });

  return res.json({ success: true, message: "Field permissions updated" });
}

/** Owner-only: delete a custom role (system roles are protected). */
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

  await logAudit({ req, module: "employees", action: "delete_role", entityType: "Role", entityId: roleId });

  return res.json({ success: true, message: "Role deleted" });
}
