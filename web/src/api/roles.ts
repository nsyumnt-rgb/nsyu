import { api } from "./client";
import type { ApiEnvelope, ModuleName, Role, SensitiveField } from "../types";

export function listRoles() {
  return api.get<ApiEnvelope<Role[]>>("/roles");
}

export function createRole(name: string) {
  return api.post<ApiEnvelope<Role>>("/roles", { name });
}

export function updateRolePermissions(
  roleId: number,
  permissions: Array<{ module: ModuleName; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>
) {
  return api.put<ApiEnvelope<null>>(`/roles/${roleId}/permissions`, { permissions });
}

export function updateRoleFieldPermissions(roleId: number, fields: Array<{ field: SensitiveField; allowed: boolean }>) {
  return api.put<ApiEnvelope<null>>(`/roles/${roleId}/field-permissions`, { fields });
}

export function deleteRole(roleId: number) {
  return api.delete<ApiEnvelope<null>>(`/roles/${roleId}`);
}
