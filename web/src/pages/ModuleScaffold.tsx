import RequireModule from "../components/RequireModule";
import type { ModuleName } from "../types";

interface Props {
  module: ModuleName;
  title: string;
  description: string;
}

/**
 * Placeholder for modules the backend hasn't implemented yet
 * (Inventory, Purchase, Sales, Billing, Customers, Suppliers,
 * Payments, Ledger, EMI, Attendance, Payroll, Reports).
 *
 * The permission gate, sidebar entry, and route already work end to
 * end — wire this page up to real endpoints the same way Products
 * is wired (see src/api/products.ts + src/pages/Products.tsx) once
 * each backend module lands, following the README's replication
 * steps.
 */
export default function ModuleScaffold({ module, title, description }: Props) {
  return (
    <RequireModule module={module}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>
        <div className="card p-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 font-display mb-3">
            +
          </div>
          <h2 className="text-base mb-1">Backend module not wired yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            This page, its sidebar entry and its permission gate are live. Connect it to <code className="font-mono text-xs">/api/{module}</code>{" "}
            once that backend module exists, following the Products module as the pattern.
          </p>
        </div>
      </div>
    </RequireModule>
  );
}
