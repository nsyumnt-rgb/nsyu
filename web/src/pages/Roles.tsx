import { useEffect, useState } from "react";
import clsx from "clsx";
import { createRole, deleteRole, listRoles, updateRoleFieldPermissions, updateRolePermissions } from "../api/roles";
import { apiErrorMessage } from "../api/client";
import RequireModule from "../components/RequireModule";
import { ACTIONS, MODULES, SENSITIVE_FIELDS, type ModuleName, type Role, type SensitiveField } from "../types";

const FIELD_LABELS: Record<SensitiveField, string> = {
  purchase_price: "View purchase price",
  selling_price: "View selling price",
  profit: "View profit",
  supplier: "View supplier",
  customer_outstanding: "View customer outstanding",
  emi: "View EMI",
  salary: "View salary",
};

const ACTION_LABELS: Record<string, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete" };

function PermissionEditor({ role, onSaved }: { role: Role; onSaved: () => void }) {
  const [grid, setGrid] = useState<Record<ModuleName, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>>(
    () => {
      const base: any = {};
      MODULES.forEach((m) => {
        const existing = role.permissions?.find((p) => p.module === m);
        base[m] = {
          can_view: existing?.can_view ?? false,
          can_create: existing?.can_create ?? false,
          can_edit: existing?.can_edit ?? false,
          can_delete: existing?.can_delete ?? false,
        };
      });
      return base;
    }
  );
  const [fields, setFields] = useState<Record<SensitiveField, boolean>>(() => {
    const base: any = {};
    SENSITIVE_FIELDS.forEach((f) => {
      base[f] = role.fieldPermissions?.find((x) => x.field === f)?.allowed ?? false;
    });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = role.is_system && role.name === "Owner";

  function toggle(module: ModuleName, action: (typeof ACTIONS)[number]) {
    if (locked) return;
    setGrid((g) => ({ ...g, [module]: { ...g[module], [`can_${action}`]: !g[module][`can_${action}` as const] } }));
  }

  function toggleField(field: SensitiveField) {
    if (locked) return;
    setFields((f) => ({ ...f, [field]: !f[field] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(
        role.id,
        MODULES.map((m) => ({ module: m, ...grid[m] }))
      );
      await updateRoleFieldPermissions(
        role.id,
        SENSITIVE_FIELDS.map((f) => ({ field: f, allowed: fields[f] }))
      );
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save permissions"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {locked && (
        <p className="text-xs text-muted bg-canvas rounded-md px-3 py-2 border border-border">
          The Owner role always has full access and can't be modified.
        </p>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2.5">Module access</h3>
        <div className="table-wrap overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="text-center">
                    {ACTION_LABELS[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="capitalize font-medium">{m}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="text-center">
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={grid[m][`can_${a}` as const]}
                        onChange={() => toggle(m, a)}
                        className="h-4 w-4 accent-accent"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2.5">Sensitive fields</h3>
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SENSITIVE_FIELDS.map((f) => (
            <label key={f} className={clsx("flex items-center gap-2 text-sm", locked && "opacity-60")}>
              <input
                type="checkbox"
                disabled={locked}
                checked={fields[f]}
                onChange={() => toggleField(f)}
                className="h-4 w-4 accent-accent"
              />
              {FIELD_LABELS[f]}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!locked && (
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save permissions"}
        </button>
      )}
    </div>
  );
}

function RolesInner() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(selectAfter?: number) {
    setLoading(true);
    listRoles()
      .then((res) => {
        const data = res.data.data ?? [];
        setRoles(data);
        if (selectAfter) setSelectedId(selectAfter);
        else if (!selectedId && data.length) setSelectedId(data[0].id);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createRole(newRoleName.trim());
      setNewRoleName("");
      load(res.data.data?.id);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create role"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(roleId: number) {
    if (!confirm("Delete this role? Employees assigned to it will need to be reassigned.")) return;
    await deleteRole(roleId);
    setSelectedId(null);
    load();
  }

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Roles & Permissions</h1>
        <p className="text-sm text-muted mt-1">
          Every check here is re-enforced by the API — disabling a module here blocks the endpoint, not just the menu item.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <div className="card p-3 h-fit">
          <div className="space-y-1 mb-3">
            {loading && <div className="text-sm text-muted px-2 py-1.5">Loading…</div>}
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={clsx(
                  "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-left",
                  selectedId === r.id ? "bg-accent-50 text-accent-700 font-medium" : "hover:bg-canvas"
                )}
              >
                <span>{r.name}</span>
                {r.is_system && <span className="text-[10px] text-muted uppercase">system</span>}
              </button>
            ))}
          </div>
          <form onSubmit={handleCreateRole} className="flex gap-1.5 border-t border-border pt-3">
            <input
              className="input !py-1.5 text-xs"
              placeholder="New role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
            <button className="btn-secondary !py-1.5 !px-2.5 text-xs" disabled={creating}>
              Add
            </button>
          </form>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </div>

        <div className="card p-5">
          {!selected && <p className="text-sm text-muted">Select a role to edit its permissions.</p>}
          {selected && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium">{selected.name}</h2>
                {!selected.is_system && (
                  <button className="text-xs text-danger hover:underline" onClick={() => handleDelete(selected.id)}>
                    Delete role
                  </button>
                )}
              </div>
              <PermissionEditor key={selected.id} role={selected} onSaved={() => load(selected.id)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Roles() {
  return (
    <RequireModule module="employees">
      <RolesInner />
    </RequireModule>
  );
}
