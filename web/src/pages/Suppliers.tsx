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
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">
            Your vendors, their contact details and purchase history.
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

      {error && !showForm && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="card py-14 text-center text-[13px] text-slate-500">
          <div className="w-6 h-6 mx-auto mb-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Loading suppliers…
        </div>
      ) : suppliers.length === 0 ? (
        <div className="card py-16 px-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
          </div>
          <div className="text-[15px] font-semibold text-navy-900">No suppliers yet</div>
          <p className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">
            Add the vendors you buy stock from to record purchases and track what you owe them.
          </p>
          {can("suppliers", "create") && (
            <button className="btn-primary mt-5" onClick={() => setShowForm(true)}>+ Add first supplier</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="card card-hover p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-[15px] font-bold shrink-0">
                  {(s.name || "S").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <ReferenceLink type="supplier" id={s.id} className="!font-sans text-[14.5px] font-semibold text-navy-900 hover:text-brand-600 truncate block">
                    {s.name}
                  </ReferenceLink>
                  {s.gstin && <div className="text-[11.5px] text-slate-400 font-mono mt-0.5">GSTIN {s.gstin}</div>}
                </div>
                <span className={`capitalize ${s.status === "active" ? "badge-active" : "badge-inactive"}`}>{s.status}</span>
              </div>

              <dl className="mt-4 space-y-2 text-[12.5px]">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  <span className="tabular">{s.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
                  <span className="truncate">{s.email || "—"}</span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-600 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className="line-clamp-2">{s.address || "—"}</span>
                </div>
              </dl>

              {(() => {
                const bal = Number(s.current_balance ?? 0);
                return (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 ring-1 ring-slate-100 px-3.5 py-2.5">
                    <span className="text-[12px] text-slate-500">{bal < 0 ? "Advance paid" : "You owe"}</span>
                    <span className={`text-[15px] font-bold tabular ${bal > 0 ? "text-amber-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}

              <div className="mt-auto pt-4 flex gap-2">
                <Link to={`/app/suppliers/${s.id}`} className="btn-secondary btn-sm flex-1">Profile & balance</Link>
                <Link to={`/app/purchase?supplierId=${s.id}`} className="btn-soft btn-sm flex-1">Purchases</Link>
              </div>
            </div>
          ))}
        </div>
      )}
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
