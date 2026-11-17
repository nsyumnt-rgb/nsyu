import { Employee, Role, Shop, UserRole } from "../models";

/** Active shop assignments for an employee (shop must belong to the same owner and not be suspended). */
export async function employeeAssignments(employee: { id: number; owner_id: number }) {
  const rows = await UserRole.findAll({
    where: { user_type: "employee", user_id: employee.id, is_active: true },
    include: [
      { model: Shop, as: "shop", required: true },
      { model: Role, as: "role", required: true },
    ],
    order: [["id", "ASC"]],
  });
  return rows.filter((r: any) => r.shop && r.shop.owner_id === employee.owner_id && r.shop.status !== "suspended" && r.role.owner_id === employee.owner_id);
}

/**
 * Resolve the live access context for an employee token: the account must still be active
 * and still assigned to the shop. Returns the CURRENT role for that shop (so role changes and
 * removals take effect immediately, not when the token expires), or null when access is gone.
 */
export async function resolveEmployeeAccess(employeeId: number, ownerId: number, shopId: number | null | undefined) {
  const employee = await Employee.findByPk(employeeId);
  if (!employee || employee.owner_id !== ownerId || employee.status !== "active") return { ok: false as const };
  if (!shopId) return { ok: true as const, employee, roleId: null as number | null, roleName: null as string | null };
  const assignment: any = await UserRole.findOne({
    where: { user_type: "employee", user_id: employeeId, shop_id: shopId, is_active: true },
    include: [{ model: Role, as: "role", required: true }],
  });
  if (!assignment || assignment.role.owner_id !== ownerId) return { ok: false as const };
  return { ok: true as const, employee, roleId: assignment.role_id as number, roleName: assignment.role.name as string };
}
