import type { ReactNode } from "react";
import { usePermission } from "../hooks/usePermission";
import type { ModuleName } from "../types";

/**
 * Used to wrap a page component. Hiding the sidebar link isn't
 * enough — someone could type the URL directly, so we also block
 * the page itself. The real enforcement still lives on the API
 * (requirePermission middleware); this is just so the UI doesn't
 * show an empty/broken page or leak layout information.
 */
export default function RequireModule({ module, children }: { module: ModuleName; children: ReactNode }) {
  const { can } = usePermission();
  if (!can(module, "view")) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-lg mb-1">Access restricted</h2>
        <p className="text-sm text-muted">
          You don't have permission to view this section. Ask your owner or manager to grant access.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
