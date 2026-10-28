import { useAuthStore } from "../store/authStore";
import type { ActionName, ModuleName, SensitiveField } from "../types";

/**
 * Frontend permission checks are a UX convenience ONLY — hiding a
 * button here does not grant access to anything. Every route that
 * matters re-checks requirePermission() server-side, and every
 * sensitive field is stripped server-side before it ever reaches
 * this app. See src/middleware/permission.ts on the backend.
 */
export function usePermission() {
  const can = useAuthStore((s) => s.can);
  const canField = useAuthStore((s) => s.canField);
  const isOwner = useAuthStore((s) => s.accountType === "owner");

  return {
    isOwner,
    can: (module: ModuleName, action: ActionName = "view") => can(module, action),
    canField: (field: SensitiveField) => canField(field),
  };
}
