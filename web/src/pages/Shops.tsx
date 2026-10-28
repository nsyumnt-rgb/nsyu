import { useEffect, useState } from "react";
import { createShop, listShops } from "../api/shops";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import type { Shop } from "../types";

function ShopsInner() {
  const { isOwner } = usePermission();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    listShops()
      .then((res) => setShops(res.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createShop(form);
      setForm({ name: "", code: "", address: "", phone: "", email: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create shop"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Shops</h1>
          <p className="text-sm text-muted mt-1">Every shop is a separate data boundary — inventory, sales and staff never cross.</p>
        </div>
        {isOwner && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New shop"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Shop name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Shop code</label>
            <input
              required
              className="input font-mono"
              placeholder="e.g. MAIN01"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
          <div className="sm:col-span-2">
            <button disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create shop"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shop</th>
              <th>Code</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">Loading…</td>
              </tr>
            )}
            {!loading && shops.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">No shops yet.</td>
              </tr>
            )}
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td className="font-medium">{shop.name}</td>
                <td className="font-mono text-xs text-muted">{shop.code}</td>
                <td className="text-muted">{shop.phone || shop.email || "—"}</td>
                <td className="text-muted">{shop.roleName || (isOwner ? "Owner" : "—")}</td>
                <td>
                  <span className={shop.status === "active" ? "badge-active" : "badge-inactive"}>{shop.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Shops() {
  return (
    <RequireModule module="shops">
      <ShopsInner />
    </RequireModule>
  );
}
