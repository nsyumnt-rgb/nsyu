import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  createRole,
  deleteRole,
  listModules,
  listRoles,
  updateRoleFieldPermissions,
  updateRolePermissions,
} from "../api/roles";
import { apiErrorMessage } from "../api/client";
import RequireModule from "../components/RequireModule";
import {
  ACTIONS,
  SENSITIVE_FIELDS,
  type ModuleItem,
  type Role,
  type SensitiveField,
} from "../types";

const FIELD_LABELS: Record<SensitiveField, string> = {
  purchase_price: "View purchase price",
  selling_price: "View selling price",
  profit: "View profit",
  supplier: "View supplier",
  customer_outstanding: "View customer outstanding",
  emi: "View EMI",
  salary: "View salary",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

const ROLE_BADGES: Record<string, { badge: string; color: string; desc: string }> = {
  super_admin: {
    badge: "Super Admin",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "System Management – Full System Control across all shops and global configurations",
  },
  owner: {
    badge: "Owner",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    desc: "Full Shop Access – Full Business Control of own shop and operations",
  },
  staff: {
    badge: "Staff",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "Daily Operations – Limited operational access to permitted shop workflows",
  },
  user: {
    badge: "User",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    desc: "Customer Portal – Customer access to browse catalog, cart, and self orders",
  },
};

// Static reference matrix for overview display
const MATRIX_SPEC = [
  { module: "All Shops", code: "all_shops", sa: "✓", ow: "—", st: "—", us: "—" },
  { module: "Shop Settings", code: "shop_settings", sa: "✓", ow: "✓", st: "—", us: "—" },
  { module: "User Management", code: "user_management", sa: "✓", ow: "✓", st: "—", us: "—" },
  { module: "Role & Permissions", code: "role_permissions", sa: "✓", ow: "✓", st: "—", us: "—" },
  { module: "Products", code: "products", sa: "✓", ow: "✓", st: "✓*", us: "✓*" },
  { module: "Stock Management", code: "stock_management", sa: "✓", ow: "✓", st: "✓*", us: "—" },
  { module: "Billing", code: "billing", sa: "✓", ow: "✓", st: "✓*", us: "—" },
  { module: "Sales & Purchases", code: "sales_purchases", sa: "✓", ow: "✓", st: "✓*", us: "—" },
  { module: "Customers", code: "customers", sa: "✓", ow: "✓", st: "✓*", us: "—" },
  { module: "Orders", code: "orders", sa: "✓", ow: "✓", st: "✓*", us: "✓*" },
  { module: "Accounts & Expenses", code: "accounts_expenses", sa: "✓", ow: "✓", st: "—", us: "—" },
  { module: "Reports", code: "reports", sa: "✓", ow: "✓", st: "—", us: "—" },
  { module: "Subscriptions", code: "subscriptions", sa: "✓", ow: "—", st: "—", us: "—" },
  { module: "System Settings", code: "system_settings", sa: "✓", ow: "—", st: "—", us: "—" },
];

function PermissionEditor({
  role,
  modules,
  onSaved,
}: {
  role: Role;
  modules: ModuleItem[];
  onSaved: () => void;
}) {
  const [grid, setGrid] = useState<
    Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; scope?: string }>
  >(() => {
    const base: any = {};
    modules.forEach((m) => {
      const existing = role.permissions?.find((p) => p.module === m.code);
      base[m.code] = {
        can_view: existing?.can_view ?? false,
        can_create: existing?.can_create ?? false,
        can_edit: existing?.can_edit ?? false,
        can_delete: existing?.can_delete ?? false,
        scope: existing?.scope ?? "shop",
      };
    });
    return base;
  });

  const [fields, setFields] = useState<Record<SensitiveField, boolean>>(() => {
    const base: any = {};
    SENSITIVE_FIELDS.forEach((f) => {
      base[f] = role.fieldPermissions?.find((x) => x.field === f)?.allowed ?? false;
    });
    return base;
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync state if modules change
  useEffect(() => {
    setGrid((prev) => {
      const updated = { ...prev };
      modules.forEach((m) => {
        if (!updated[m.code]) {
          const existing = role.permissions?.find((p) => p.module === m.code);
          updated[m.code] = {
            can_view: existing?.can_view ?? false,
            can_create: existing?.can_create ?? false,
            can_edit: existing?.can_edit ?? false,
            can_delete: existing?.can_delete ?? false,
            scope: existing?.scope ?? "shop",
          };
        }
      });
      return updated;
    });
  }, [modules, role]);

  const isSuperAdminRole = role.code === "super_admin" || role.name === "Super Admin";
  const isOwnerRole = role.code === "owner" || role.name === "Owner";
  const isUserRole = role.code === "user" || role.name === "User";

  function toggle(moduleCode: string, action: (typeof ACTIONS)[number]) {
    setSuccessMsg(null);
    setGrid((g) => ({
      ...g,
      [moduleCode]: {
        ...g[moduleCode],
        [`can_${action}`]: !g[moduleCode]?.[`can_${action}` as const],
      },
    }));
  }

  function toggleField(field: SensitiveField) {
    setSuccessMsg(null);
    setFields((f) => ({ ...f, [field]: !f[field] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const permPayload = modules.map((m) => ({
        module: m.code,
        module_id: m.id,
        can_view: !!grid[m.code]?.can_view,
        can_create: !!grid[m.code]?.can_create,
        can_edit: !!grid[m.code]?.can_edit,
        can_delete: !!grid[m.code]?.can_delete,
        scope: grid[m.code]?.scope || "shop",
      }));

      await updateRolePermissions(role.id, permPayload);

      await updateRoleFieldPermissions(
        role.id,
        SENSITIVE_FIELDS.map((f) => ({ field: f, allowed: fields[f] }))
      );

      setSuccessMsg("Permissions successfully saved to database!");
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save permissions"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Role Notice */}
      {isSuperAdminRole && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 text-xs text-purple-900 leading-relaxed">
          <span className="font-semibold">Super Admin Privileges:</span> Has full system control across all shops,
          businesses, subscriptions, global configurations, and module permissions.
        </div>
      )}
      {isOwnerRole && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 leading-relaxed">
          <span className="font-semibold">Owner Privileges:</span> Controls only their own shop. Has full operational
          access to all shop business features (billing, inventory, sales, customers, reports).
        </div>
      )}
      {isUserRole && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">Customer Portal Privileges:</span> Access is strictly scoped to customer-facing
          features (product catalog browsing, add to cart, and tracking their own personal orders).
        </div>
      )}

      {/* Dynamic Module Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Module Access ({modules.length} Modules)</h3>
            <p className="text-xs text-slate-500">
              Checkboxes grant backend API access. Disabling an action rejects API calls with HTTP 403.
            </p>
          </div>
          <button
            className="btn-primary !py-1.5 !px-4 text-xs shadow-sm"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        <div className="table-wrap overflow-x-auto border border-border rounded-lg bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-center">Scope</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="py-2.5 px-3 text-center w-20">
                    {ACTION_LABELS[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modules.map((m) => {
                const row = grid[m.code] || {
                  can_view: false,
                  can_create: false,
                  can_edit: false,
                  can_delete: false,
                  scope: "shop",
                };
                return (
                  <tr key={m.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                      <span className="text-sm mr-1.5">📦</span>
                      {m.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {m.description || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
                          row.scope === "all"
                            ? "bg-purple-100 text-purple-700"
                            : row.scope === "self"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {row.scope || "shop"}
                      </span>
                    </td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={row[`can_${a}` as const]}
                          onChange={() => toggle(m.code, a)}
                          className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sensitive Fields */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Sensitive Data Field Visibility</h3>
        <p className="text-xs text-slate-500 mb-3">
          Control access to proprietary financial metrics (purchase prices, margins, salaries).
        </p>
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/50">
          {SENSITIVE_FIELDS.map((f) => (
            <label
              key={f}
              className="flex items-center gap-2.5 text-xs font-medium text-slate-700 bg-white p-2.5 rounded border border-border hover:border-slate-300 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={fields[f]}
                onChange={() => toggleField(f)}
                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
              />
              {FIELD_LABELS[f]}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
          ✓ {successMsg}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          className="btn-primary !py-2 !px-6 text-xs font-semibold shadow-sm"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving to Database…" : "Save All Permissions"}
        </button>
      </div>
    </div>
  );
}

function RoleMatrixTable() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Role Permission Matrix Reference</h2>
          <p className="text-xs text-slate-500">
            Standard 4-Role System Matrix across all 14 platform business modules.
          </p>
        </div>
      </div>

      <div className="table-wrap overflow-x-auto border border-border rounded-lg bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 border-b border-border text-slate-700 font-bold uppercase text-[11px]">
            <tr>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4 text-center">Super Admin</th>
              <th className="py-3 px-4 text-center">Owner</th>
              <th className="py-3 px-4 text-center">Staff</th>
              <th className="py-3 px-4 text-center">User (Customer)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MATRIX_SPEC.map((row) => (
              <tr key={row.code} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-900">
                  {row.module}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className={clsx("font-bold text-sm", row.sa === "✓" ? "text-emerald-600" : "text-slate-300")}>
                    {row.sa}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className={clsx("font-bold text-sm", row.ow === "✓" ? "text-emerald-600" : "text-slate-300")}>
                    {row.ow}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={clsx(
                      "font-bold text-sm",
                      row.st.startsWith("✓") ? "text-blue-600" : "text-slate-300"
                    )}
                  >
                    {row.st}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={clsx(
                      "font-bold text-sm",
                      row.us.startsWith("✓") ? "text-amber-600" : "text-slate-300"
                    )}
                  >
                    {row.us}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 bg-slate-50/60 border border-border space-y-3">
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">✓*</span> Access depends on permissions assigned by Super Admin or Owner. Customer access is restricted to their own account and orders.
        </p>

        <div className="border-t border-border pt-3">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
            Important RBAC Enforcement Rules
          </h4>
          <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
            <li><strong>Super Admin</strong> controls all businesses and global module permissions.</li>
            <li><strong>Owner</strong> controls only their own shop.</li>
            <li><strong>Staff</strong> receives only assigned permissions.</li>
            <li><strong>User (Customer)</strong> can access only customer-facing features.</li>
            <li><strong>Backend APIs</strong> must enforce permissions, not just hide frontend menu items.</li>
            <li><strong>Every shop</strong> has isolated data using shop_id / business_id.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function RolesInner() {
  const [activeTab, setActiveTab] = useState<"manage" | "matrix">("manage");
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadData(selectAfter?: number) {
    setLoading(true);
    Promise.all([listRoles(), listModules()])
      .then(([rolesRes, modulesRes]) => {
        const roleData = rolesRes.data.data ?? [];
        const moduleData = modulesRes.data.data ?? [];
        setRoles(roleData);
        setModules(moduleData);
        if (selectAfter) {
          setSelectedId(selectAfter);
        } else if (!selectedId && roleData.length) {
          setSelectedId(roleData[0].id);
        }
      })
      .catch((err) => {
        setError(apiErrorMessage(err, "Failed to load roles and modules"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createRole(newRoleName.trim());
      setNewRoleName("");
      loadData(res.data.data?.id);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create role"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(roleId: number) {
    if (!confirm("Delete this custom role? Employees assigned to it will need to be reassigned.")) return;
    await deleteRole(roleId);
    setSelectedId(null);
    loadData();
  }

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const roleCode = selected?.code || selected?.name.toLowerCase().replace(/[^a-z0-9]/g, "_") || "";
  const roleBadgeInfo = ROLE_BADGES[roleCode] || {
    badge: selected?.name || "Custom Role",
    color: "bg-slate-100 text-slate-800 border-slate-200",
    desc: selected?.description || "Custom shop employee role",
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-2xl font-bold text-slate-900">Final Role & Permission Structure</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total 4 User Roles with centralized role-based access control (RBAC) backed dynamically by database tables.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-border self-start">
          <button
            onClick={() => setActiveTab("manage")}
            className={clsx(
              "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
              activeTab === "manage"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            ⚙️ Manage Role Permissions
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={clsx(
              "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
              activeTab === "matrix"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            📊 Role Permission Matrix
          </button>
        </div>
      </div>

      {activeTab === "matrix" ? (
        <RoleMatrixTable />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Roles Sidebar */}
          <div className="card p-3.5 h-fit space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1 mb-2">
                User Roles ({roles.length})
              </h2>
              <div className="space-y-1.5">
                {loading && <div className="text-xs text-muted px-2 py-2">Loading roles…</div>}
                {roles.map((r) => {
                  const rCode = r.code || r.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
                  const badge = ROLE_BADGES[rCode];
                  const isSelected = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={clsx(
                        "w-full flex flex-col items-start p-2.5 rounded-lg border text-left transition-all",
                        isSelected
                          ? "bg-accent-50/50 border-accent text-accent-800 shadow-xs"
                          : "border-border/60 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900">{r.name}</span>
                        {badge ? (
                          <span className={clsx("text-[10px] px-1.5 py-0.2 rounded border font-medium", badge.color)}>
                            {badge.badge}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                            Custom
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                        {r.description || (badge ? badge.desc : "Custom staff role")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Role Creation */}
            <form onSubmit={handleCreateRole} className="border-t border-border pt-3 space-y-2">
              <label className="text-[11px] font-semibold text-slate-600 block">
                Add Custom Role
              </label>
              <div className="flex gap-1.5">
                <input
                  className="input !py-1.5 text-xs flex-1"
                  placeholder="e.g. Supervisor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-secondary !py-1.5 !px-3 text-xs font-semibold"
                  disabled={creating}
                >
                  Add
                </button>
              </div>
              {error && <p className="text-[11px] text-danger">{error}</p>}
            </form>
          </div>

          {/* Role Detail & Permissions */}
          <div className="card p-5">
            {!selected && <p className="text-sm text-muted">Select a role to inspect or edit permissions.</p>}
            {selected && (
              <>
                <div className="flex items-start justify-between border-b border-border pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                      <span
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded border font-semibold",
                          roleBadgeInfo.color
                        )}
                      >
                        {roleBadgeInfo.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {selected.description || roleBadgeInfo.desc}
                    </p>
                  </div>
                  {!selected.is_system && (
                    <button
                      className="text-xs text-danger font-semibold hover:underline"
                      onClick={() => handleDelete(selected.id)}
                    >
                      Delete Role
                    </button>
                  )}
                </div>

                <PermissionEditor
                  key={selected.id}
                  role={selected}
                  modules={modules}
                  onSaved={() => loadData(selected.id)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Roles() {
  return (
    <RequireModule module="user_management">
      <RolesInner />
    </RequireModule>
  );
}
