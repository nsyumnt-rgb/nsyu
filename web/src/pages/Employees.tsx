import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assignShopRole, createEmployee, listEmployees, removeShopAssignment, setEmployeeStatus } from "../api/employees";
import { listShops } from "../api/shops";
import { listRoles } from "../api/roles";
import { apiErrorMessage } from "../api/client";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Employee, Role, Shop } from "../types";

function AssignRow({
  employee,
  shops,
  roles,
  onChanged,
}: {
  employee: Employee;
  shops: Shop[];
  roles: Role[];
  onChanged: () => void;
}) {
  const [shopId, setShopId] = useState<number | "">("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    if (!shopId || !roleId) return;
    setBusy(true);
    setError(null);
    try {
      await assignShopRole({ employeeId: employee.id, shopId: Number(shopId), roleId: Number(roleId) });
      setShopId("");
      setRoleId("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not assign shop/role"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(shop_id: number) {
    setBusy(true);
    try {
      await removeShopAssignment({ employeeId: employee.id, shopId: shop_id });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="align-top">
      <td>
        <div className="font-medium">
          <ReferenceLink type="employee" id={employee.id}>
            {employee.name}
          </ReferenceLink>
        </div>
        <div className="text-xs text-muted">{employee.email}</div>
      </td>
      <td>
        <div className="flex flex-wrap gap-1.5">
          {(employee.shopAssignments ?? []).length === 0 && <span className="text-xs text-muted">Not assigned</span>}
          {(employee.shopAssignments ?? []).map((a) => (
            <span key={a.id} className="badge-active inline-flex items-center gap-1.5">
              {a.shop?.name} · {a.role?.name}
              <button
                onClick={() => handleRemove(a.shop_id)}
                disabled={busy}
                className="text-accent-700/60 hover:text-accent-700"
                title="Remove access"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <select className="input !py-1.5 !w-32 text-xs" value={shopId} onChange={(e) => setShopId(Number(e.target.value) || "")}>
            <option value="">Shop…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="input !py-1.5 !w-32 text-xs" value={roleId} onChange={(e) => setRoleId(Number(e.target.value) || "")}>
            <option value="">Role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button className="btn-secondary !py-1.5 !px-2.5 text-xs" disabled={busy || !shopId || !roleId} onClick={handleAssign}>
            Assign
          </button>
        </div>
        {error && <div className="text-xs text-danger mt-1">{error}</div>}
      </td>
      <td>
        <span className={employee.status === "active" ? "badge-active" : "badge-inactive"}>{employee.status}</span>
      </td>
      <td className="space-x-2 whitespace-nowrap">
        <Link
          to={`/app/employees/${employee.id}`}
          className="btn-secondary !py-1.5 !px-2.5 text-xs inline-block"
        >
          Profile
        </Link>
        <button
          className="btn-ghost !py-1.5 !px-2.5 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setEmployeeStatus(employee.id, employee.status === "active" ? "inactive" : "active");
              onChanged();
            } finally {
              setBusy(false);
            }
          }}
        >
          {employee.status === "active" ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

function EmployeesInner() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([listEmployees(), listShops(), listRoles()])
      .then(([e, s, r]) => {
        setEmployees(e.data.data ?? []);
        setShops(s.data.data ?? []);
        setRoles(r.data.data ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createEmployee(form);
      setForm({ name: "", email: "", phone: "", password: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create employee"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Employees</h1>
          <p className="text-sm text-muted mt-1">Assign each employee a role per shop — they can hold a different role at each one.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New employee"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input
              required
              minLength={6}
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
          <div className="sm:col-span-2">
            <button disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create employee"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Shop / Role access</th>
              <th className="min-w-[280px]">Assign</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">Loading…</td>
              </tr>
            )}
            {!loading && employees.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">No employees yet.</td>
              </tr>
            )}
            {employees.map((emp) => (
              <AssignRow key={emp.id} employee={emp} shops={shops} roles={roles} onChanged={load} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Employees() {
  return (
    <RequireModule module="employees">
      <EmployeesInner />
    </RequireModule>
  );
}
