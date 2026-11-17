import { useEffect, useMemo, useState } from "react";
import { apiErrorMessage } from "../api/client";
import { assignShopRole, createEmployee, listEmployees, removeShopAssignment, resetEmployeePassword, setEmployeeStatus, updateEmployee } from "../api/employees";
import { listRoles } from "../api/roles";
import { listShops } from "../api/shops";
import { usePermission } from "../hooks/usePermission";
import type { Employee, Role, Shop } from "../types";

/* Owner-only staff accounts: create staff logins, give each one a role per shop,
   reset passwords and deactivate. Everything is enforced again by the API. */

type StaffRow = Employee & { shopAssignments?: Array<{ id: number; shop_id: number; role_id: number; shop?: Shop; role?: Role }> };

export default function Staff() {
  const { isOwner } = usePermission();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [query, setQuery] = useState("");

  // Platform, owner and customer roles are not staff roles (the API refuses them too).
  const staffRoles = useMemo(() => roles.filter((r) => !["Owner", "Super Admin", "User"].includes(r.name)), [roles]);

  async function load() {
    try {
      const [s, r, sh] = await Promise.all([listEmployees(), listRoles(), listShops()]);
      setStaff((s.data.data || []) as StaffRow[]);
      setRoles((r.data.data || []) as Role[]);
      setShops((sh.data.data || []) as Shop[]);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load staff"));
      setStaff([]);
    }
  }
  useEffect(() => {
    if (isOwner) load();
  }, [isOwner]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  if (!isOwner) {
    return (
      <div className="card p-8 text-center">
        <h1 className="page-title">Staff</h1>
        <p className="page-subtitle">Only the shop owner can manage staff accounts.</p>
      </div>
    );
  }

  const filtered = (staff || []).filter((s) => !query.trim() || `${s.name} ${s.email} ${s.phone || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeCount = (staff || []).filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">Give managers and staff their own login. Each person gets a role in each shop they work in.</p>
        </div>
        <button type="button" className="btn-primary h-10 self-start sm:self-auto" onClick={() => setCreating(true)}>
          + Add staff member
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label="Staff accounts" value={staff?.length ?? "—"} />
        <Kpi label="Active" value={staff ? activeCount : "—"} />
        <Kpi label="Staff roles" value={staffRoles.length || "—"} className="hidden sm:block" />
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex-wrap gap-3">
          <h2 className="card-title">Team</h2>
          <input className="input h-9 w-full sm:w-64" placeholder="Search name, email, phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search staff" />
        </div>

        {staff === null ? (
          <div className="p-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold text-navy-900">{staff.length ? "No staff match your search" : "No staff accounts yet"}</p>
            <p className="text-[13px] text-slate-500 mt-1">{staff.length ? "Try a different name or email." : "Add a manager or staff member so they can sign in with their own email and password."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <li key={s.id} className="px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 md:w-72">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${s.status === "active" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                    {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-navy-900 truncate">{s.name}</div>
                    <div className="text-[12px] text-slate-500 truncate">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {(s.shopAssignments || []).length === 0 ? (
                    <span className="badge bg-amber-50 text-amber-700">No shop assigned — can't sign in yet</span>
                  ) : (
                    (s.shopAssignments || []).map((a) => (
                      <span key={a.id} className="badge bg-slate-100 text-slate-700">
                        {a.shop?.name || `Shop #${a.shop_id}`} · <b className="font-semibold">{a.role?.name || "Role"}</b>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${s.status === "active" ? "badge-active" : "bg-slate-100 text-slate-500"}`}>{s.status === "active" ? "Active" : "Inactive"}</span>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(s)}>Manage</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <CreateDialog
          shops={shops}
          roles={staffRoles}
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false);
            flash(`${name} can now sign in with their email and password.`);
            load();
          }}
        />
      )}
      {editing && (
        <ManageDialog
          staff={editing}
          shops={shops}
          roles={staffRoles}
          onClose={() => setEditing(null)}
          onChanged={(msg, updated) => {
            flash(msg);
            if (updated) setEditing(updated);
            load();
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, className = "" }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="mt-1 text-[22px] font-bold text-navy-900 tabular">{value}</div>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-navy-950/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 h-14 border-b border-slate-100">
          <h2 className="text-[16px] font-bold text-navy-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy-900 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function CreateDialog({ shops, roles, onClose, onCreated }: { shops: Shop[]; roles: Role[]; onClose: () => void; onCreated: (name: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", shopId: shops[0]?.id ? String(shops[0].id) : "", roleId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.roleId || !form.shopId) return setError("Choose the shop and the role for this person.");
    setBusy(true);
    try {
      await createEmployee({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password, shopId: Number(form.shopId), roleId: Number(form.roleId) });
      onCreated(form.name.trim());
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create the staff account"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add staff member" onClose={onClose}>
      {error && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name" className="sm:col-span-2"><input className="input h-11" required value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" /></Field>
        <Field label="Email (used to sign in)"><input className="input h-11" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" /></Field>
        <Field label="Phone (optional)"><input className="input h-11" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Temporary password" className="sm:col-span-2" hint="At least 8 characters. Share it privately; you can reset it any time.">
          <input className="input h-11" type="text" minLength={8} required value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Shop">
          <select className="input h-11" value={form.shopId} onChange={(e) => set("shopId", e.target.value)} required>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Role in this shop">
          <select className="input h-11" value={form.roleId} onChange={(e) => set("roleId", e.target.value)} required>
            <option value="">Choose a role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary h-11" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary h-11" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ManageDialog({ staff, shops, roles, onClose, onChanged }: { staff: StaffRow; shops: Shop[]; roles: Role[]; onClose: () => void; onChanged: (msg: string, updated?: StaffRow) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: staff.name, phone: staff.phone || "" });
  const [password, setPassword] = useState("");
  const assigned = staff.shopAssignments || [];
  const unassigned = shops.filter((s) => !assigned.some((a) => a.shop_id === s.id));
  const [add, setAdd] = useState({ shopId: unassigned[0]?.id ? String(unassigned[0].id) : "", roleId: "" });

  const run = async (key: string, fn: () => Promise<any>, msg: string) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      const updated = res?.data?.data && res.data.data.shopAssignments ? (res.data.data as StaffRow) : undefined;
      onChanged(msg, updated);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save the change"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog title={`Manage ${staff.name}`} onClose={onClose}>
      {error && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      <section className="space-y-3">
        <h3 className="section-label">Profile</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name"><input className="input h-11" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Phone"><input className="input h-11" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
        </div>
        <p className="text-[12px] text-slate-500">Signs in as <b className="text-navy-900">{staff.email}</b></p>
        <button type="button" className="btn-secondary btn-sm" disabled={busy !== null} onClick={() => run("profile", () => updateEmployee(staff.id, { name: profile.name, phone: profile.phone }), "Profile saved.")}>
          {busy === "profile" ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="space-y-2 pt-3 border-t border-slate-100">
        <h3 className="section-label">Shops & roles</h3>
        {assigned.length === 0 && <p className="text-[13px] text-amber-700">Not assigned to any shop — this person can't sign in yet.</p>}
        {assigned.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl ring-1 ring-slate-200 p-2.5">
            <span className="flex-1 min-w-[120px] text-[13.5px] font-semibold text-navy-900">{a.shop?.name || `Shop #${a.shop_id}`}</span>
            <select
              className="input h-9 w-auto"
              aria-label={`Role in ${a.shop?.name || "shop"}`}
              value={a.role_id}
              disabled={busy !== null}
              onChange={(e) => run(`role-${a.id}`, () => assignShopRole({ employeeId: staff.id, shopId: a.shop_id, roleId: Number(e.target.value) }), "Role updated — it applies immediately.")}
            >
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button type="button" className="btn-ghost btn-sm text-rose-600" disabled={busy !== null} onClick={() => run(`rm-${a.id}`, () => removeShopAssignment({ employeeId: staff.id, shopId: a.shop_id }), "Removed from shop.")}>
              Remove
            </button>
          </div>
        ))}
        {unassigned.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <Field label="Add to shop" className="flex-1 min-w-[140px]">
              <select className="input h-10" value={add.shopId} onChange={(e) => setAdd({ ...add, shopId: e.target.value })}>
                {unassigned.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Role" className="flex-1 min-w-[140px]">
              <select className="input h-10" value={add.roleId} onChange={(e) => setAdd({ ...add, roleId: e.target.value })}>
                <option value="">Choose…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <button type="button" className="btn-primary h-10" disabled={busy !== null || !add.roleId || !add.shopId} onClick={() => run("add", () => assignShopRole({ employeeId: staff.id, shopId: Number(add.shopId), roleId: Number(add.roleId) }), "Shop added.")}>
              Add
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2 pt-3 border-t border-slate-100">
        <h3 className="section-label">Reset password</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input h-10 flex-1 min-w-[180px]" type="text" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="New password" />
          <button type="button" className="btn-secondary h-10" disabled={busy !== null || password.length < 8} onClick={() => run("pw", () => resetEmployeePassword(staff.id, password), "Password changed. They've been signed out everywhere.")}>
            {busy === "pw" ? "Saving…" : "Set password"}
          </button>
        </div>
      </section>

      <section className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-slate-500">{staff.status === "active" ? "Deactivating signs them out at once and blocks sign-in." : "This account is inactive and cannot sign in."}</p>
        <button
          type="button"
          className={staff.status === "active" ? "btn-danger btn-sm" : "btn-primary btn-sm"}
          disabled={busy !== null}
          onClick={() =>
            run("status", () => setEmployeeStatus(staff.id, staff.status === "active" ? "inactive" : "active"), staff.status === "active" ? `${staff.name} was deactivated.` : `${staff.name} can sign in again.`).then(onClose)
          }
        >
          {staff.status === "active" ? "Deactivate" : "Re-activate"}
        </button>
      </section>
    </Dialog>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11.5px] text-slate-500">{hint}</span>}
    </label>
  );
}
