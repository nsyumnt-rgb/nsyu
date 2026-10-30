import { api } from "./client";
import type { ApiEnvelope, ModuleItem, Role, SensitiveField } from "../types";

export function listModules() {
  return api.get<ApiEnvelope<ModuleItem[]>>("/roles/modules");
}

export function listRoles() {
  return api.get<ApiEnvelope<Role[]>>("/roles");
}

export function createRole(name: string, description?: string) {
  return api.post<ApiEnvelope<Role>>("/roles", { name, description });
}

export function updateRolePermissions(
  roleId: number,
  permissions: Array<{ module: string; module_id?: number; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; scope?: string }>
) {
  return api.put<ApiEnvelope<null>>(`/roles/${roleId}/permissions`, { permissions });
}

export function updateRoleFieldPermissions(roleId: number, fields: Array<{ field: SensitiveField; allowed: boolean }>) {
  return api.put<ApiEnvelope<null>>(`/roles/${roleId}/field-permissions`, { fields });
}

export function deleteRole(roleId: number) {
  return api.delete<ApiEnvelope<null>>(`/roles/${roleId}`);
}

export function listShopModules(shopId?: number) {
  return api.get<ApiEnvelope<any[]>>(`/roles/shop-modules${shopId ? `/${shopId}` : ""}`);
}

export function updateShopModule(shopId: number, module_code: string, is_enabled: boolean) {
  return api.put<ApiEnvelope<any>>(`/roles/shop-modules/${shopId}`, { module_code, is_enabled });
}
