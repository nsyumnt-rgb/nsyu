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
          <h1 className="page-title">Shops</h1>
          <p className="page-subtitle">Every shop is a separate data boundary — inventory, sales and staff never cross.</p>
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

      {/* Desktop table */}
      <div className="hidden md:block table-wrap">
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

      {/* Mobile cards view */}
      <div className="md:hidden space-y-3">
        {loading && <div className="card p-6 text-center text-muted text-sm">Loading shops…</div>}
        {!loading && shops.length === 0 && <div className="card p-6 text-center text-muted text-sm">No shops yet.</div>}
        {shops.map((shop) => (
          <div key={shop.id} className="card p-4 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{shop.name}</span>
              <span className={shop.status === "active" ? "badge-active" : "badge-inactive"}>{shop.status}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">{shop.code}</span>
              <span>{shop.roleName || (isOwner ? "Owner" : "—")}</span>
            </div>
            {(shop.phone || shop.email) && (
              <div className="text-xs text-muted pt-1 border-t border-slate-50 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <span>{shop.phone || shop.email}</span>
              </div>
            )}
          </div>
        ))}
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
