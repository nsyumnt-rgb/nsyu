import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSuppliers, createSupplier } from "../api/suppliers";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Supplier } from "../types";

function SuppliersInner() {
  const { can } = usePermission();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listSuppliers()
      .then((res) => setSuppliers(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load suppliers")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSupplier(form);
      setForm({ name: "", phone: "", email: "", address: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create supplier"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Suppliers</h1>
          <p className="text-sm text-muted mt-1">
            Supplier records, purchasing directory, and payable balance tracking.
          </p>
        </div>
        {can("suppliers", "create") && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Supplier"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Supplier Company / Name *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Acme Tech Distributors"
            />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9812345678"
            />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. vendor@acme.com"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Warehouse 12, Industrial Area"
            />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Supplier"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  Loading suppliers…
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  No suppliers found. Click "+ New Supplier" to create one.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-ink-900">
                    <ReferenceLink type="supplier" id={s.id}>
                      {s.name}
                    </ReferenceLink>
                  </td>
                  <td className="font-mono text-xs">{s.phone || "—"}</td>
                  <td className="text-xs text-muted">{s.email || "—"}</td>
                  <td className="text-xs text-muted truncate max-w-xs">{s.address || "—"}</td>
                  <td>
                    <span
                      className={`badge ${
                        s.status === "active" ? "bg-accent-100 text-accent-700" : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    <Link
                      to={`/app/suppliers/${s.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      Profile
                    </Link>
                    <Link
                      to={`/app/purchase?supplierId=${s.id}`}
                      className="text-xs text-accent-600 hover:text-accent-700 font-medium underline"
                    >
                      View Purchases
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Suppliers() {
  return (
    <RequireModule module="suppliers">
      <SuppliersInner />
    </RequireModule>
  );
}
