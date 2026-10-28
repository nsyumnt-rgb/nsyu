import { Role, RolePermission, RoleFieldPermission } from "../models";
import { MODULES, SENSITIVE_FIELDS, SYSTEM_ROLES } from "../config/permissions";

/**
 * Default permission matrix per system role. "owner" gets everything
 * implicitly (handled in requirePermission, not stored as rows).
 * Adjust these defaults freely — they're just sane starting points;
 * the actual owner can change any of it afterwards via the Roles UI.
 */
const DEFAULT_MODULE_ACCESS: Record<string, string[]> = {
  Manager: [...MODULES], // full module access, but NOT owner-only actions like deleting the owner account
  "Sales Staff": ["dashboard", "sales", "billing", "customers", "payments", "products"],
  "Billing Staff": ["dashboard", "billing", "payments", "customers"],
  "Inventory Staff": ["dashboard", "products", "inventory", "purchase", "suppliers"],
  Accountant: ["dashboard", "payments", "ledger", "emi", "reports", "attendance", "leave", "payroll"],
};

const DEFAULT_FIELD_ACCESS: Record<string, string[]> = {
  Manager: [...SENSITIVE_FIELDS],
  "Sales Staff": ["selling_price"],
  "Billing Staff": ["selling_price", "customer_outstanding"],
  "Inventory Staff": ["purchase_price"],
  Accountant: [...SENSITIVE_FIELDS],
};

export async function seedOwnerDefaults(ownerId: number) {
  for (const roleName of SYSTEM_ROLES) {
    const role = await Role.create({ owner_id: ownerId, name: roleName, is_system: true });

    if (roleName === "Owner") continue; // Owner bypasses permission rows entirely

    const modules = DEFAULT_MODULE_ACCESS[roleName] || [];
    const rows = MODULES.map((module) => ({
      role_id: role.id,
      module,
      can_view: modules.includes(module),
      can_create: modules.includes(module) && module !== "reports",
      can_edit: modules.includes(module) && module !== "reports",
      can_delete: false, // deletion off by default for every non-owner role; owner can enable per-role
    }));
    await RolePermission.bulkCreate(rows);

    const allowedFields = DEFAULT_FIELD_ACCESS[roleName] || [];
    const fieldRows = SENSITIVE_FIELDS.map((field) => ({
      role_id: role.id,
      field,
      allowed: allowedFields.includes(field),
    }));
    await RoleFieldPermission.bulkCreate(fieldRows);
  }
}
