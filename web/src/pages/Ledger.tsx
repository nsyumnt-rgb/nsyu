import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCustomerLedger, recordLedgerPayment, type CustomerLedgerResponse } from "../api/ledger";
import { listCustomers } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import CustomerViewModal, { BalanceText, CustomerStatusBadge } from "../components/CustomerViewModal";
import type { Customer } from "../types";
import { Avatar, ChoiceGroup, EmptyState, Icon, Modal, PageHeader, SearchInput, Segmented, Switch } from "../components/ui";

type Entry = CustomerLedgerResponse["entries"][number];

const inr = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
/** Local calendar date (YYYY-MM-DD) of an entry, for the date-range filter. */
const dayKey = (d: string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** Which column an entry belongs in — mirrors the backend balance rules. */
function sideOf(e: Entry): "debit" | "credit" | null {
  if (e.entry_type === "debit") return "debit";
  if (e.entry_type === "credit") return "credit";
  if (e.entry_type === "reversal") {
    if (e.reference_type === "PaymentReversal") return "debit";
    if (["SaleCancellation", "Return", "SaleReturn"].includes(e.reference_type)) return "credit";
  }
  return null;
}

function EntryReference({ entry }: { entry: Entry }) {
  if ((entry.reference_type === "Sale" || entry.reference_type === "SalePayment") && entry.reference_id) {
    return <ReferenceLink type="sale" id={entry.reference_id} refNumber={entry.reference_code || `Bill #${entry.reference_id}`} />;
  }
  return <span className="font-mono text-slate-600">{entry.reference_code || `${entry.reference_type} #${entry.reference_id ?? entry.id}`}</span>;
}

/* ─────────────────────────────────────────────────────────────
   1. Customer list: Customer | Contact | Balance | Status | Actions
   ───────────────────────────────────────────────────────────── */

function CustomerLedgerList({ onView, onLedger }: { onView: (id: number) => void; onLedger: (id: number) => void }) {
  const shopId = useAuthStore((s) => s.shopId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [onlyDue, setOnlyDue] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCustomers()
      .then((res) => setCustomers(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load customers")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, shopId]);

  const q = search.trim().toLowerCase();
  const rows = customers
    .filter((c) => !q || c.name.toLowerCase().includes(q) || String(c.phone || "").includes(q) || String(c.email || "").toLowerCase().includes(q) || String(c.id) === q)
    .filter((c) => status === "all" || (status === "inactive" ? c.status === "inactive" : c.status !== "inactive"))
    .filter((c) => !onlyDue || Number(c.current_balance) > 0)
    .sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));

  const totalDue = customers.reduce((s, c) => s + Math.max(0, Number(c.current_balance) || 0), 0);
  const withDue = customers.filter((c) => Number(c.current_balance) > 0).length;
  const inactive = customers.filter((c) => c.status === "inactive").length;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Khata" title="Customer ledger" subtitle="Balances, bills and payments for every customer." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card p-4 col-span-2 lg:col-span-1">
          <div className="stat-label">Total outstanding</div>
          <div className="mt-1.5 text-[22px] font-bold text-rose-600 tabular">{loading ? "—" : inr(totalDue)}</div>
        </div>
        <div className="card p-4">
          <div className="stat-label">Customers with dues</div>
          <div className="mt-1.5 stat-value">{loading ? "—" : withDue}</div>
        </div>
        <div className="card p-4">
          <div className="stat-label">Customers</div>
          <div className="mt-1.5 stat-value">{loading ? "—" : customers.length}<span className="ml-1.5 text-[12px] font-medium text-slate-400">{inactive ? `${inactive} inactive` : ""}</span></div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <SearchInput className="md:flex-1 md:max-w-sm" value={search} onChange={setSearch} placeholder="Name, mobile, email or ID…" />
          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            <Segmented
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "inactive", label: "Inactive" },
              ]}
            />
            <Switch checked={onlyDue} onChange={setOnlyDue} label="Only dues" />
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
              <button type="button" onClick={load} className="btn-secondary btn-sm ml-auto">Retry</button>
            </div>
          </div>
        ) : loading ? (
          <div className="p-5 space-y-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-100" />
                <div className="flex-1 h-3 rounded bg-slate-100" />
                <div className="w-24 h-3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState icon="users" tone="brand" title="No customers yet" text="Customers appear here once you add them or bill them." />
          ) : (
            <EmptyState icon="search" title="No customers match" text="Try another name, status or turn off “Only dues”." />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th className="!text-right">Balance</th>
                    <th>Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={c.name} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-navy-900 truncate max-w-[200px] 2xl:max-w-[280px]">{c.name}</div>
                            <div className="text-[11.5px] text-slate-400 truncate max-w-[200px] 2xl:max-w-[280px]">{c.shop_name ? `${c.shop_name} · ` : ""}ID {c.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="tabular text-navy-900">{c.phone || "—"}</div>
                        {c.email && <div className="text-[11.5px] text-slate-400 truncate max-w-[180px] 2xl:max-w-[240px]">{c.email}</div>}
                      </td>
                      <td className="text-right"><BalanceText value={Number(c.current_balance) || 0} /></td>
                      <td><CustomerStatusBadge status={c.status} /></td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button type="button" onClick={() => onView(c.id)} className="btn-secondary btn-sm">
                            <Icon name="eye" className="w-3.5 h-3.5" /> View
                          </button>
                          <button type="button" onClick={() => onLedger(c.id)} className="btn-soft btn-sm">
                            <Icon name="book" className="w-3.5 h-3.5" /> Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((c) => (
                <li key={c.id} className="px-4 py-3.5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-[14px] text-navy-900 [overflow-wrap:anywhere]">{c.name}</div>
                          <div className="text-[12px] text-slate-500 tabular">{c.phone || "—"}</div>
                        </div>
                        <BalanceText value={Number(c.current_balance) || 0} className="text-[14px]" />
                      </div>
                      <div className="mt-1.5"><CustomerStatusBadge status={c.status} /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onView(c.id)} className="btn-secondary btn-sm h-10">
                      <Icon name="eye" className="w-3.5 h-3.5" /> View
                    </button>
                    <button type="button" onClick={() => onLedger(c.id)} className="btn-soft btn-sm h-10">
                      <Icon name="book" className="w-3.5 h-3.5" /> Ledger
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 text-[12px] text-slate-500">
              Showing <b className="text-navy-900">{rows.length}</b> of {customers.length} customers
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. One customer's statement
   ───────────────────────────────────────────────────────────── */

function CustomerStatement({ customerId, onBack, onView }: { customerId: number; onBack: () => void; onView: (id: number) => void }) {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner, can } = usePermission();

  const [allShops, setAllShops] = useState(false);
  const [data, setData] = useState<CustomerLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [side, setSide] = useState<"all" | "debit" | "credit">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerLedger(customerId, { allShops: isOwner && allShops ? true : undefined });
      setData(res.data.data ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load this customer's ledger"));
    } finally {
      setLoading(false);
    }
  }, [customerId, isOwner, allShops]);

  useEffect(() => {
    load();
  }, [load, shopId]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const customer = data?.customer;
  const summary = data?.summary ?? {
    openingBalance: 0,
    totalDebit: Number(data?.totalDebit ?? 0),
    totalCredit: Number(data?.totalCredit ?? 0),
    currentBalance: Number(data?.currentBalance ?? 0),
  };
  const balance = summary.currentBalance;

  const needle = q.trim().toLowerCase();
  const visible = entries.filter((e) => {
    const s = sideOf(e);
    if (side !== "all" && s !== side) return false;
    const day = dayKey(e.entry_date);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (needle) {
      const hay = [e.description, e.reference_code, e.reference_type, e.payment_method, e.notes, String(e.reference_id ?? "")].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const filtered = side !== "all" || from || to || needle;
  const debitCount = entries.filter((e) => sideOf(e) === "debit").length;
  const creditCount = entries.filter((e) => sideOf(e) === "credit").length;

  function openPayment() {
    setPayAmount(balance > 0 ? balance.toFixed(2) : "");
    setPayMethod("cash");
    setPayNotes("");
    setPayError(null);
    setShowPay(true);
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return setPayError("Enter a payment amount greater than zero.");
    setPaying(true);
    setPayError(null);
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ledg-${customerId}-${Date.now()}`;
    try {
      await recordLedgerPayment({
        customerId,
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes.trim() || `Payment received (${payMethod.toUpperCase()})`,
        idempotencyKey,
      });
      setShowPay(false);
      setToast(`Payment of ${inr(amt)} recorded`);
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (err) {
      setPayError(apiErrorMessage(err, "Could not record the payment"));
    } finally {
      setPaying(false);
    }
  }

  const tiles: { label: string; value: number; tone: string; hint: string }[] = [
    { label: "Opening balance", value: summary.openingBalance, tone: "text-navy-900", hint: "Before the first bill" },
    { label: "Total debit", value: summary.totalDebit, tone: "text-rose-600", hint: "Bills raised" },
    { label: "Total credit", value: summary.totalCredit, tone: "text-emerald-600", hint: "Payments & returns" },
    { label: "Current balance", value: balance, tone: balance > 0 ? "text-rose-600" : balance < 0 ? "text-emerald-600" : "text-navy-900", hint: balance > 0 ? "Due from customer" : balance < 0 ? "Advance with you" : "Settled" },
  ];

  return (
    <div className="space-y-5 pb-10">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-navy-900">
        <Icon name="left" className="w-4 h-4" /> All customers
      </button>

      {/* Customer header */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar name={customer?.name || "Customer"} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="text-[19px] sm:text-[22px] font-bold text-navy-900 tracking-tight [overflow-wrap:anywhere]">{customer?.name || (loading ? "Loading…" : "Customer")}</h1>
                {customer && <CustomerStatusBadge status={customer.status} />}
              </div>
              <div className="text-[12.5px] text-slate-500 tabular">
                {customer?.phone || "—"}
                <span className="text-slate-300"> · </span>
                {data?.isShopScoped ? `This shop${activeShop?.name ? ` (${activeShop.name})` : ""}` : "All shops"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && <Switch checked={allShops} onChange={setAllShops} label="All shops" />}
            <button type="button" onClick={() => onView(customerId)} className="btn-secondary">
              <Icon name="eye" /> View
            </button>
            {can("ledger", "create") && (
              <button type="button" onClick={openPayment} disabled={!data} className="btn-primary">
                <Icon name="wallet" /> Record payment
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`card p-4 min-w-0 ${t.label === "Current balance" ? "ring-1 ring-inset ring-brand-600/20 bg-brand-50/30" : ""}`}>
            <div className="stat-label truncate">{t.label}</div>
            <div className={`mt-1.5 text-[17px] sm:text-[21px] font-bold tabular truncate ${t.tone} ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {data ? `${t.value < 0 ? "-" : ""}${inr(t.value)}` : "—"}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">{t.hint}</div>
          </div>
        ))}
      </div>

      {toast && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          <Icon name="checkCircle" className="w-4 h-4 shrink-0" /> {toast}
        </div>
      )}
      {error && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
          <button type="button" onClick={load} className="btn-secondary btn-sm ml-auto">Retry</button>
        </div>
      )}

      {/* Transaction history */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="card-title text-[14.5px]">Transaction history</h2>
            <Segmented
              size="sm"
              value={side}
              onChange={setSide}
              options={[
                { key: "all", label: "All", count: entries.length },
                { key: "debit", label: "Bills", count: debitCount, tone: "rose" },
                { key: "credit", label: "Payments", count: creditCount, tone: "emerald" },
              ]}
            />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <SearchInput className="md:flex-1" value={q} onChange={setQ} placeholder="Search reference, description or method…" />
            <div className="grid grid-cols-2 md:flex md:items-center gap-2">
              <label className="flex flex-col md:flex-row md:items-center gap-1 text-[11.5px] text-slate-500">
                From
                <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="input py-1.5 text-[13px] md:w-auto" />
              </label>
              <label className="flex flex-col md:flex-row md:items-center gap-1 text-[11.5px] text-slate-500">
                To
                <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input py-1.5 text-[13px] md:w-auto" />
              </label>
            </div>
            {filtered && (
              <button type="button" onClick={() => { setSide("all"); setFrom(""); setTo(""); setQ(""); }} className="btn-ghost btn-sm self-start md:self-auto">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading && !data ? (
          <div className="p-5 space-y-3" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-20 h-3 rounded bg-slate-100" />
                <div className="flex-1 h-3 rounded bg-slate-100" />
                <div className="w-20 h-3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon="file" title="No transactions yet" text="Bills and payments for this customer will appear here." />
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title="No transactions match" text="Try a different date range or search." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    {allShops && <th>Shop</th>}
                    <th className="!text-right">Debit</th>
                    <th className="!text-right">Credit</th>
                    <th className="!text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => {
                    const s = sideOf(e);
                    const reversed = e.status === "reversed";
                    const amt = Number(e.amount);
                    const bal = Number(e.running_balance ?? 0);
                    return (
                      <tr key={e.id} className={reversed ? "bg-slate-50/60" : ""}>
                        <td className="whitespace-nowrap text-slate-600">{fmtDate(e.entry_date)}</td>
                        <td className="whitespace-nowrap text-[12.5px]"><EntryReference entry={e} /></td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`font-medium text-navy-900 ${reversed ? "line-through text-slate-400" : ""}`}>{e.description || e.reference_type}</span>
                            {s === "credit" && e.payment_method && <span className="badge-inactive uppercase !text-[10px]">{e.payment_method.replace("_", " ")}</span>}
                            {reversed && <span className="badge-warn !text-[10px]">Reversed</span>}
                          </div>
                          {e.notes && e.notes !== e.description && <div className="text-[11.5px] text-slate-400 mt-0.5 max-w-[340px] truncate">{e.notes}</div>}
                        </td>
                        {allShops && <td><span className="badge-inactive">{e.shop?.name || `Shop #${e.shop_id}`}</span></td>}
                        <td className={`text-right whitespace-nowrap tabular font-semibold ${reversed ? "text-slate-400 line-through" : "text-rose-600"}`}>{s === "debit" ? inr(amt) : <span className="text-slate-300 no-underline">—</span>}</td>
                        <td className={`text-right whitespace-nowrap tabular font-semibold ${reversed ? "text-slate-400 line-through" : "text-emerald-600"}`}>{s === "credit" ? inr(amt) : <span className="text-slate-300">—</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <span className="font-bold text-navy-900 tabular">{bal < 0 ? "-" : ""}{inr(bal)}</span>
                          <span className={`ml-1.5 text-[11px] font-semibold ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>{bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {visible.map((e) => {
                const s = sideOf(e);
                const reversed = e.status === "reversed";
                const amt = Number(e.amount);
                const bal = Number(e.running_balance ?? 0);
                return (
                  <li key={e.id} className={`px-4 py-3.5 ${reversed ? "bg-slate-50/60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-[13.5px] font-medium text-navy-900 [overflow-wrap:anywhere] ${reversed ? "line-through text-slate-400" : ""}`}>{e.description || e.reference_type}</div>
                        <div className="text-[11.5px] text-slate-500 mt-0.5">{fmtDate(e.entry_date)} · <EntryReference entry={e} /></div>
                      </div>
                      <div className={`text-[14px] font-bold tabular whitespace-nowrap ${reversed ? "text-slate-400 line-through" : s === "debit" ? "text-rose-600" : s === "credit" ? "text-emerald-600" : "text-slate-500"}`}>
                        {s === "debit" ? "+" : s === "credit" ? "−" : ""}{inr(amt)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className={s === "debit" ? "badge-danger" : s === "credit" ? "badge-active" : "badge-inactive"}>{s === "debit" ? "Debit" : s === "credit" ? "Credit" : "Entry"}</span>
                        {s === "credit" && e.payment_method && <span className="badge-inactive uppercase !text-[10px]">{e.payment_method.replace("_", " ")}</span>}
                        {reversed && <span className="badge-warn !text-[10px]">Reversed</span>}
                      </div>
                      <div className="text-[11.5px] text-slate-500 whitespace-nowrap">
                        Bal <span className="font-semibold text-navy-900 tabular">{bal < 0 ? "-" : ""}{inr(bal)}</span> {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 text-[12px] text-slate-500 flex flex-wrap justify-between gap-2">
              <span>Showing <b className="text-navy-900">{visible.length}</b> of {entries.length} transactions</span>
              <span>Balance is a running total of all transactions, including those hidden by filters.</span>
            </div>
          </>
        )}
      </section>

      {showPay && (
        <Modal
          size="sm"
          icon="wallet"
          title="Record payment"
          subtitle={customer?.name}
          onClose={() => setShowPay(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowPay(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="ledger-pay-form" disabled={paying} className="btn-primary">{paying ? "Saving…" : "Save payment"}</button>
            </>
          }
        >
          <form id="ledger-pay-form" onSubmit={savePayment} className="space-y-4">
            {balance > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <span className="text-[12.5px] font-medium text-rose-700">Current due</span>
                <span className="text-[15px] font-bold text-rose-700 tabular">{inr(balance)}</span>
              </div>
            )}
            <div>
              <label className="label" htmlFor="pay-amount">Amount received (₹)</label>
              <input id="pay-amount" type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus className="input text-[16px] font-semibold tabular" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div>
              <label className="label">Payment method</label>
              <ChoiceGroup
                value={payMethod}
                onChange={setPayMethod}
                cols={3}
                options={[
                  ["cash", "Cash"],
                  ["upi", "UPI"],
                  ["bank_transfer", "Bank"],
                  ["card", "Card"],
                  ["cheque", "Cheque"],
                  ["other", "Other"],
                ]}
              />
            </div>
            <div>
              <label className="label" htmlFor="pay-notes">Notes (optional)</label>
              <input id="pay-notes" type="text" className="input" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Receipt note or reference" />
            </div>
            <p className="text-[11.5px] text-slate-500">Adds a credit entry to the ledger and settles unpaid bills automatically.</p>
            {payError && (
              <p role="alert" className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {payError}</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function LedgerInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = Number(searchParams.get("customerId")) || null;
  const [viewId, setViewId] = useState<number | null>(null);

  const openLedger = (id: number) => {
    setViewId(null);
    setSearchParams({ customerId: String(id) });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {customerId ? (
        <CustomerStatement key={customerId} customerId={customerId} onBack={() => setSearchParams({})} onView={setViewId} />
      ) : (
        <CustomerLedgerList onView={setViewId} onLedger={openLedger} />
      )}
      {viewId !== null && (
        <CustomerViewModal customerId={viewId} onClose={() => setViewId(null)} onOpenLedger={viewId === customerId ? undefined : openLedger} />
      )}
    </>
  );
}

export default function Ledger() {
  return (
    <RequireModule module="ledger">
      <LedgerInner />
    </RequireModule>
  );
}
