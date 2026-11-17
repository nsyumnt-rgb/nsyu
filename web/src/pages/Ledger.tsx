import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCustomerLedger, recordLedgerPayment } from "../api/ledger";
import { listCustomers } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Customer } from "../types";

function LedgerInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner, can } = usePermission();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [allShopsToggle, setAllShopsToggle] = useState(false);
  const [entryFilter, setEntryFilter] = useState<"all" | "debit" | "credit">("all");

  const [customerLedgerData, setCustomerLedgerData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Record payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerLedger(Number(selectedCustomerId), {
        allShops: isOwner && allShopsToggle ? true : undefined,
      });
      setCustomerLedgerData(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load customer ledger"));
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, isOwner, allShopsToggle]);

  useEffect(() => {
    listCustomers()
      .then((c) => {
        const custList = c.data.data ?? [];
        setCustomers(custList);

        const urlCustId = searchParams.get("customerId");
        if (urlCustId) {
          setSelectedCustomerId(Number(urlCustId));
        } else if (custList.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(custList[0].id);
        }
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load customers")));
  }, [shopId]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger, shopId]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayError("Please enter a valid positive payment amount.");
      return;
    }
    setSubmittingPay(true);
    setPayError(null);
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ledg-${selectedCustomerId}-${Date.now()}`;
    try {
      await recordLedgerPayment({
        customerId: Number(selectedCustomerId),
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes.trim() || `Payment received (${payMethod.toUpperCase()})`,
        idempotencyKey,
      });
      setShowPaymentModal(false);
      setPayAmount("");
      setPayNotes("");
      setPayMethod("cash");
      await loadLedger();
    } catch (err) {
      setPayError(apiErrorMessage(err, "Failed to record payment in ledger"));
    } finally {
      setSubmittingPay(false);
    }
  }

  const allEntries = customerLedgerData?.entries ?? [];
  const filteredEntries = allEntries.filter((entry: any) => {
    if (entryFilter === "debit") return entry.entry_type === "debit";
    if (entryFilter === "credit") return entry.entry_type === "credit";
    return true;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const balance = Number(customerLedgerData?.currentBalance ?? 0);
  const shopBalance = Number(customerLedgerData?.shopBalance ?? 0);
  const debitCount = allEntries.filter((e: any) => e.entry_type === "debit").length;
  const creditCount = allEntries.filter((e: any) => e.entry_type === "credit").length;
  const inr = (n: number) =>
    "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balanceTag = (n: number) => (n > 0 ? "Due" : n < 0 ? "Advance" : "Settled");
  const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit" });
  const fmtMonth = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const tabs: { key: "all" | "debit" | "credit"; label: string; count: number }[] = [
    { key: "all", label: "All entries", count: allEntries.length },
    { key: "debit", label: "Bills", count: debitCount },
    { key: "credit", label: "Payments", count: creditCount },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Customer Ledger</h1>
          <p className="page-subtitle">Bills, payments received and the running balance for each customer.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-border text-[12.5px] font-medium text-slate-700 cursor-pointer select-none shadow-xs">
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  checked={allShopsToggle}
                  onChange={(e) => setAllShopsToggle(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="w-8 h-[18px] rounded-full bg-slate-200 peer-checked:bg-brand-600 transition-colors" />
                <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
              </span>
              All shops
            </label>
          )}
          {selectedCustomerId && can("ledger", "create") && (
            <button
              onClick={() => {
                const due = Number(customerLedgerData?.currentBalance || 0);
                setPayAmount(due > 0 ? due.toFixed(2) : "");
                setPayError(null);
                setShowPaymentModal(true);
              }}
              className="btn-primary"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* ── Customer + balance summary ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="card p-5 lg:col-span-5 flex flex-col gap-4">
          <div>
            <label className="label">Customer</label>
            <select
              className="input"
              value={selectedCustomerId}
              onChange={(e) => {
                const val = Number(e.target.value) || "";
                setSelectedCustomerId(val);
                setSearchParams(val ? { customerId: String(val) } : {});
              }}
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          {selectedCustomer ? (
            <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center text-[15px] font-semibold shrink-0">
                {(selectedCustomer.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <ReferenceLink type="customer" id={selectedCustomer.id} refNumber={selectedCustomer.name} className="!font-sans text-[14px] font-semibold text-navy-900 hover:text-brand-600 truncate block">
                  {selectedCustomer.name}
                </ReferenceLink>
                <div className="text-[12px] text-slate-500 mt-0.5 truncate">{selectedCustomer.phone}</div>
              </div>
              {customerLedgerData && (
                <span className={balance > 0 ? "badge-danger" : balance < 0 ? "badge-active" : "badge-inactive"}>
                  {balanceTag(balance)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500">Choose a customer to view their statement.</p>
          )}
        </div>

        <div className="hero-brand lg:col-span-7 p-6">
          <div className="absolute -right-12 -bottom-20 w-64 h-64 rounded-full bg-white/[0.04]" />
          <div className="relative flex flex-col h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-medium text-brand-100/80">
                  {balance < 0 ? "Advance with you" : "Outstanding balance"}
                  {allShopsToggle ? " · all shops" : ""}
                </div>
                <div className={`mt-2 text-[32px] sm:text-[36px] font-bold tracking-tight leading-none tabular ${loading ? "opacity-40 animate-pulse" : ""}`}>
                  {customerLedgerData ? inr(balance) : "—"}
                </div>
              </div>
              {customerLedgerData && (
                <span
                  className={`badge ring-1 ring-inset ${
                    balance > 0
                      ? "bg-rose-500/15 text-rose-200 ring-rose-300/30"
                      : balance < 0
                      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-300/30"
                      : "bg-white/10 text-white/80 ring-white/20"
                  }`}
                >
                  {balanceTag(balance)}
                </span>
              )}
            </div>
            <div className="mt-auto pt-5 grid grid-cols-3 gap-3 sm:gap-4 border-t border-white/10 mt-6">
              <div className="min-w-0">
                <div className="text-[11.5px] text-brand-100/70 truncate">This shop{activeShop?.name ? ` · ${activeShop.name}` : ""}</div>
                <div className="text-[13px] sm:text-[17px] font-semibold tabular mt-1 truncate">
                  {customerLedgerData ? `${inr(shopBalance)}` : "—"}
                  {customerLedgerData && shopBalance !== 0 && (
                    <span className="text-[11px] font-medium text-brand-100/60 ml-1">{shopBalance > 0 ? "Dr" : "Cr"}</span>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] text-brand-100/70">Total billed</div>
                <div className="text-[13px] sm:text-[17px] font-semibold tabular mt-1 truncate">
                  {customerLedgerData ? inr(Number(customerLedgerData.totalDebit || 0)) : "—"}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] text-brand-100/70">Total paid</div>
                <div className="text-[13px] sm:text-[17px] font-semibold tabular mt-1 truncate text-emerald-300">
                  {customerLedgerData ? inr(Number(customerLedgerData.totalCredit || 0)) : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      {/* ── Statement ────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
          <h2 className="card-title">Statement</h2>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 self-start sm:self-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setEntryFilter(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all ${
                  entryFilter === t.key ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 tabular ${entryFilter === t.key ? "text-brand-600" : "text-slate-400"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-500">
            <div className="w-6 h-6 mx-auto mb-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            Loading statement…
          </div>
        ) : !customerLedgerData || filteredEntries.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
            </div>
            <div className="text-[13.5px] font-semibold text-navy-900">No ledger entries</div>
            <p className="text-[12.5px] text-slate-500 mt-1">Nothing recorded for this customer in the selected scope.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    {allShopsToggle && <th>Shop</th>}
                    <th>Type</th>
                    <th className="!text-right">Debit</th>
                    <th className="!text-right">Credit</th>
                    <th className="!text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry: any) => {
                    const amt = Number(entry.amount);
                    const bal = Number(entry.running_balance ?? 0);
                    const isReversed = entry.status === "reversed";
                    const isDebit = entry.entry_type === "debit";
                    return (
                      <tr key={entry.id} className={isReversed ? "opacity-50 line-through" : ""}>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center leading-none shrink-0 ${isDebit ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                              <span className="text-[14px] font-bold">{fmtDay(entry.entry_date)}</span>
                            </div>
                            <span className="text-[12px] text-slate-500">{fmtMonth(entry.entry_date)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-[13px] text-navy-900">{entry.description || entry.reference_type}</div>
                          <div className="font-mono text-[11.5px] text-slate-400 mt-0.5">
                            {entry.reference_type === "Sale" || entry.reference_type === "SalePayment" ? (
                              <ReferenceLink type="sale" id={entry.reference_id} refNumber={`Sale #${entry.reference_id}`} />
                            ) : entry.reference_code ? (
                              <span>{entry.reference_code}</span>
                            ) : (
                              <span>{entry.reference_type} #{entry.reference_id ?? entry.id}</span>
                            )}
                          </div>
                        </td>
                        {allShopsToggle && (
                          <td>
                            <span className="badge-inactive">{entry.shop?.name || `Shop #${entry.shop_id}`}</span>
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isDebit ? "badge-danger" : "badge-active"}>{isDebit ? "Bill" : "Payment"}</span>
                            {entry.entry_type === "credit" && entry.payment_method && (
                              <span className="badge-inactive uppercase text-[10px]">{entry.payment_method.replace("_", " ")}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right font-semibold text-rose-600 whitespace-nowrap">{isDebit ? inr(amt) : <span className="text-slate-300">—</span>}</td>
                        <td className="text-right font-semibold text-emerald-600 whitespace-nowrap">{!isDebit ? inr(amt) : <span className="text-slate-300">—</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <span className="font-bold text-navy-900">{inr(bal)}</span>
                          <span className={`ml-1.5 text-[11px] font-semibold ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile timeline */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filteredEntries.map((entry: any) => {
                const amt = Number(entry.amount);
                const bal = Number(entry.running_balance ?? 0);
                const isReversed = entry.status === "reversed";
                const isDebit = entry.entry_type === "debit";
                return (
                  <li key={entry.id} className={`px-4 py-3.5 flex gap-3 ${isReversed ? "opacity-50 line-through" : ""}`}>
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center leading-none shrink-0 ${isDebit ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                      <span className="text-[14px] font-bold">{fmtDay(entry.entry_date)}</span>
                      <span className="text-[9px] font-semibold uppercase mt-0.5">{new Date(entry.entry_date).toLocaleDateString("en-IN", { month: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-medium text-navy-900 line-clamp-2">{entry.description || entry.reference_type}</div>
                        <div className={`text-[14px] font-bold tabular whitespace-nowrap ${isDebit ? "text-rose-600" : "text-emerald-600"}`}>
                          {isDebit ? "+" : "−"}{inr(amt)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={isDebit ? "badge-danger" : "badge-active"}>{isDebit ? "Bill" : "Payment"}</span>
                          {entry.entry_type === "credit" && entry.payment_method && (
                            <span className="badge-inactive uppercase text-[10px]">{entry.payment_method.replace("_", " ")}</span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-slate-500 whitespace-nowrap">
                          Bal <span className="font-semibold text-navy-900">{inr(bal)}</span> {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ── Record Payment Modal ─────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                </div>
                <div>
                  <h2 className="text-[16px] font-bold">Record Payment</h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">{selectedCustomer?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="px-6 pb-6 space-y-4">
              {balance > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                  <span className="text-[12.5px] font-medium text-rose-700">Current due</span>
                  <span className="text-[15px] font-bold text-rose-700 tabular">{inr(balance)}</span>
                </div>
              )}
              <div>
                <label className="label">Amount received (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="input text-[15px] font-semibold py-2.5 tabular"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="label">Payment method</label>
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <input
                  type="text"
                  className="input"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Receipt note or reference"
                />
              </div>
              <p className="text-[11.5px] text-slate-500">
                Credits the customer&apos;s ledger and settles unpaid bills automatically.
              </p>
              {payError && <p className="text-[12.5px] text-rose-600">{payError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPay} className="btn-primary flex-1">
                  {submittingPay ? "Saving…" : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Ledger() {
  return (
    <RequireModule module="ledger">
      <LedgerInner />
    </RequireModule>
  );
}
