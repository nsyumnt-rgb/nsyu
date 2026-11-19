import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSuppliers, createSupplier, type CreateSupplierPayload } from "../api/suppliers";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Supplier } from "../types";
import {
  Avatar,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
  StatCard,
} from "../components/ui";

const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

function SuppliersInner() {
  const { can } = usePermission();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owe" | "advance" | "settled">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateSupplierPayload>({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    openingBalance: 0,
    password: "",
  });

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
      await createSupplier({
        ...form,
        name: form.name.trim(),
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        address: form.address?.trim() || undefined,
        gstin: form.gstin?.trim() || undefined,
        openingBalance: Number(form.openingBalance) || 0,
        password: form.password?.trim() || undefined,
      });
      setForm({ name: "", phone: "", email: "", address: "", gstin: "", openingBalance: 0, password: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create supplier"));
    } finally {
      setSaving(false);
    }
  }

  // Summary Metrics
  const totalSuppliers = suppliers.length;
  const oweTotal = suppliers.reduce((acc, s) => acc + Math.max(0, Number(s.current_balance) || 0), 0);
  const advanceTotal = suppliers.reduce((acc, s) => acc + Math.max(0, -(Number(s.current_balance) || 0)), 0);
  const activeCount = suppliers.filter((s) => s.status === "active").length;

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const bal = Number(s.current_balance) || 0;
      if (balanceFilter === "owe" && bal <= 0) return false;
      if (balanceFilter === "advance" && bal >= 0) return false;
      if (balanceFilter === "settled" && bal !== 0) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = (s.name || "").toLowerCase().includes(q);
        const mPhone = (s.phone || "").toLowerCase().includes(q);
        const mEmail = (s.email || "").toLowerCase().includes(q);
        const mAddress = (s.address || "").toLowerCase().includes(q);
        const mGstin = (s.gstin || "").toLowerCase().includes(q);
        if (!mName && !mPhone && !mEmail && !mAddress && !mGstin) return false;
      }
      return true;
    });
  }, [suppliers, balanceFilter, search]);

  function handleExportCSV() {
    const headers = ["Vendor Name", "Phone", "Email", "GSTIN", "Address", "Current Balance", "Status"];
    const rows = filteredSuppliers.map((s) => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      s.phone || "",
      s.email || "",
      s.gstin || "",
      `"${(s.address || "").replace(/"/g, '""')}"`,
      Number(s.current_balance || 0),
      s.status || "active",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NSYU_Suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers & Vendors"
        subtitle="Manage your vendor network, track purchase payables, and portal accounts."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={suppliers.length === 0}
              className="btn-secondary"
              title="Export Suppliers to CSV"
            >
              <Icon name="download" /> Export
            </button>
            {can("suppliers", "create") && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setError(null);
                  setShowForm(true);
                }}
              >
                <Icon name="plus" /> New Supplier
              </button>
            )}
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Vendors"
          icon="truck"
          tone="brand"
          value={totalSuppliers.toLocaleString("en-IN")}
          loading={loading}
          hint={`${activeCount} active partners`}
        />
        <StatCard
          label="You Owe (Payables)"
          icon="wallet"
          tone="amber"
          value={inr(oweTotal)}
          loading={loading}
          valueClass={oweTotal > 0 ? "text-amber-600" : "text-slate-700"}
          hint="Unsettled purchase dues"
        />
        <StatCard
          label="Advance Paid"
          icon="sparkle"
          tone="emerald"
          value={inr(advanceTotal)}
          loading={loading}
          valueClass={advanceTotal > 0 ? "text-emerald-600" : "text-slate-700"}
          hint="Credit with suppliers"
        />
        <StatCard
          label="Active Accounts"
          icon="checkCircle"
          tone="sky"
          value={activeCount.toLocaleString("en-IN")}
          loading={loading}
          hint={`${totalSuppliers - activeCount} inactive`}
        />
      </div>

      {/* Control Bar: Search + Balance Segmented Filter */}
      <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search by vendor name, phone, email, or GSTIN..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="shrink-0">
          <Segmented
            value={balanceFilter}
            onChange={setBalanceFilter}
            options={[
              { key: "all", label: `All (${suppliers.length})` },
              { key: "owe", label: "You Owe" },
              { key: "advance", label: "Advance" },
              { key: "settled", label: "Settled" },
            ]}
          />
        </div>
      </div>

      {/* Form Modal for Creating Supplier */}
      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          title="Add New Supplier"
          subtitle="Register a new vendor for purchase bills and ledger tracking."
        >
          <form onSubmit={handleCreate} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number</label>
              <input
                className="input"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 9812345678"
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. vendor@acme.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">GSTIN / Tax ID</label>
              <input
                className="input font-mono uppercase"
                value={form.gstin || ""}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 07AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="label">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.openingBalance || ""}
                onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })}
                placeholder="0.00 (+ for you owe, - for advance)"
              />
            </div>
          </div>

          <div>
            <label className="label">Warehouse / Office Address</label>
            <input
              className="input"
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Warehouse 12, Industrial Area, Sector 5"
            />
          </div>

          <div>
            <label className="label">Supplier Portal Password (Optional)</label>
            <input
              type="password"
              className="input"
              value={form.password || ""}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Set a password for vendor self-service login"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Vendors can log in at the supplier portal to review purchase orders and ledgers.
            </p>
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Supplier"}
            </button>
          </div>
        </form>
      </Modal>
      )}

      {/* Error state */}
      {error && !showForm && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="card py-16 text-center text-[13px] text-slate-500">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Loading suppliers…
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          icon="truck"
          title={search ? "No matching suppliers" : "No suppliers yet"}
          text={
            search
              ? `No vendors match your search "${search}". Try clearing your search.`
              : "Add the vendors you buy inventory from to record purchases, track bills, and settle payables."
          }
          action={
            can("suppliers", "create") && !search ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setError(null);
                  setShowForm(true);
                }}
              >
                <Icon name="plus" /> Add first supplier
              </button>
            ) : search ? (
              <button type="button" className="btn-secondary" onClick={() => setSearch("")}>
                Clear search
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => {
            const bal = Number(s.current_balance ?? 0);
            return (
              <div
                key={s.id}
                className="card card-hover p-5 flex flex-col justify-between border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <Avatar name={s.name || "Vendor"} size="md" />
                    <div className="min-w-0 flex-1">
                      <ReferenceLink
                        type="supplier"
                        id={s.id}
                        className="!font-sans text-[15px] font-bold text-navy-900 hover:text-emerald-700 truncate block"
                      >
                        {s.name}
                      </ReferenceLink>
                      {s.gstin ? (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          GSTIN: <span className="font-semibold text-slate-700">{s.gstin}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-0.5">Unregistered Vendor</div>
                      )}
                    </div>
                    <span
                      className={`capitalize px-2 py-0.5 rounded text-[11px] font-semibold ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                          : "bg-slate-100 text-slate-600 border border-slate-200/60"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-2 text-[12.5px]">
                    <div className="flex items-center gap-2.5 text-slate-600">
                      <Icon name="users" className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="tabular font-medium">{s.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-600 min-w-0">
                      <Icon name="file" className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{s.email || "—"}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600 min-w-0">
                      <Icon name="receipt" className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-slate-500">{s.address || "No address specified"}</span>
                    </div>
                  </dl>

                  {/* Financial Balance Pill */}
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50/90 ring-1 ring-slate-200/70 px-3.5 py-2.5">
                    <span className="text-[12px] font-medium text-slate-600">
                      {bal > 0 ? "You owe" : bal < 0 ? "Advance paid" : "Balance"}
                    </span>
                    <span
                      className={`text-[15px] font-extrabold tabular ${
                        bal > 0 ? "text-amber-700" : bal < 0 ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex gap-2">
                  <Link
                    to={`/app/suppliers/${s.id}`}
                    className="btn-secondary btn-sm flex-1 text-center justify-center font-semibold"
                  >
                    Profile & Ledger
                  </Link>
                  <Link
                    to={`/app/purchase?supplierId=${s.id}`}
                    className="btn-soft btn-sm flex-1 text-center justify-center font-semibold"
                  >
                    Purchases
                  </Link>
                </div>
              </div>
            );
          })}
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
