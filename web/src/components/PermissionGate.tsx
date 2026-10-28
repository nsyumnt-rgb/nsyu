import type { ReactNode } from "react";
import { usePermission } from "../hooks/usePermission";
import type { ActionName, ModuleName } from "../types";

interface Props {
  module: ModuleName;
  action?: ActionName;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Wrap any element (a nav link, a button, a column) that should only render when permitted. */
export default function PermissionGate({ module, action = "view", children, fallback = null }: Props) {
  const { can } = usePermission();
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}
