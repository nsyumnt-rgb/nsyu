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
import { Avatar, ChoiceGroup, EmptyState, Icon, Modal, PageHeader, SearchInput, Segmented, Switch } from "../components/ui";

function LedgerInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner, can } = usePermission();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [allShopsToggle, setAllShopsToggle] = useState(false);
  const [entryFilter, setEntryFilter] = useState<"all" | "debit" | "credit">("all");
  const [custSearch, setCustSearch] = useState("");
  const [onlyDue, setOnlyDue] = useState(false);

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
  const fmtMonth = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const tabs: { key: "all" | "debit" | "credit"; label: string; count: number }[] = [
    { key: "all", label: "All entries", count: allEntries.length },
    { key: "debit", label: "Bills", count: debitCount },
    { key: "credit", label: "Payments", count: creditCount },
  ];

  const cq = custSearch.trim().toLowerCase();
  const listCustomersView = customers
    .filter((c) => !cq || c.name.toLowerCase().includes(cq) || String(c.phone || "").includes(cq))
    .filter((c) => !onlyDue || Number(c.current_balance) > 0)
    .sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));

  function selectCustomer(id: number | "") {
    setSelectedCustomerId(id);
    setSearchParams(id ? { customerId: String(id) } : {});
  }

  function openPayment() {
    const due = Number(customerLedgerData?.currentBalance || 0);
    setPayAmount(due > 0 ? due.toFixed(2) : "");
    setPayError(null);
    setShowPaymentModal(true);
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Khata"
        title="Customer ledger"
        subtitle="Bills, payments received and the running balance for each customer."
        actions={
          <>
            {isOwner && <Switch checked={allShopsToggle} onChange={setAllShopsToggle} label="All shops" />}
            {selectedCustomerId && can("ledger", "create") && (
              <button type="button" onClick={openPayment} className="btn-primary">
                <Icon name="wallet" /> Record payment
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Customer list */}
        <section className="card overflow-hidden lg:col-span-4 lg:sticky lg:top-24">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-[14px]">Customers</h2>
              <Switch checked={onlyDue} onChange={setOnlyDue} label="Only dues" />
            </div>
            <SearchInput value={custSearch} onChange={setCustSearch} placeholder="Name or phone…" />
          </div>
          {/* Phones: compact select instead of a long list */}
          <div className="lg:hidden p-4">
            <select className="input" value={selectedCustomerId} onChange={(e) => selectCustomer(Number(e.target.value) || "")}>
              <option value="">Select customer</option>
              {listCustomersView.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <ul className="hidden lg:block max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-slate-100">
            {listCustomersView.length === 0 ? (
              <li><EmptyState compact icon="users" title="No customers" text={cq || onlyDue ? "Nothing matches." : "Add customers first."} /></li>
            ) : (
              listCustomersView.map((c) => {
                const b = Number(c.current_balance) || 0;
                const on = c.id === selectedCustomerId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${on ? "bg-brand-50/80 shadow-[inset_3px_0_0_#047857]" : "hover:bg-slate-50"}`}
                    >
                      <Avatar name={c.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-semibold ${on ? "text-brand-800" : "text-navy-900"}`}>{c.name}</span>
                        <span className="block text-[11.5px] text-slate-400 tabular">{c.phone}</span>
                      </span>
                      <span className={`text-[12.5px] font-bold tabular ${b > 0 ? "text-rose-600" : b < 0 ? "text-emerald-600" : "text-slate-300"}`}>
                        {b === 0 ? "—" : inr(b)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* Balance hero */}
          <div className="hero-brand p-5 sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -right-12 -bottom-20 w-64 h-64 rounded-full bg-white/[0.04]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedCustomer && (
                    <span className="w-11 h-11 rounded-full bg-white/15 ring-1 ring-inset ring-white/20 text-white flex items-center justify-center text-[14px] font-bold shrink-0">
                      {(selectedCustomer.name || "C").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    {selectedCustomer ? (
                      <ReferenceLink type="customer" id={selectedCustomer.id} refNumber={selectedCustomer.name} className="!font-sans !text-white text-[15px] font-semibold hover:underline truncate block">
                        {selectedCustomer.name}
                      </ReferenceLink>
                    ) : (
                      <div className="text-[15px] font-semibold text-white">Choose a customer</div>
                    )}
                    <div className="text-[12px] text-emerald-50/70 truncate">
                      {selectedCustomer?.phone || "Their statement will appear here"}
                      {allShopsToggle ? " · all shops" : ""}
                    </div>
                  </div>
                </div>
                {customerLedgerData && (
                  <span
                    className={`badge ring-1 ring-inset ${
                      balance > 0 ? "bg-rose-500/15 text-rose-100 ring-rose-300/30" : balance < 0 ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/30" : "bg-white/10 text-white/80 ring-white/20"
                    }`}
                  >
                    {balanceTag(balance)}
                  </span>
                )}
              </div>
              <div className="mt-5 text-[12px] font-medium text-emerald-50/70">{balance < 0 ? "Advance with you" : "Outstanding balance"}</div>
              <div className={`mt-1 text-[32px] sm:text-[38px] font-bold tracking-tight leading-none tabular text-white ${loading ? "opacity-40 animate-pulse" : ""}`}>
                {customerLedgerData ? inr(balance) : "—"}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                <HeroFig label={`This shop${activeShop?.name ? ` · ${activeShop.name}` : ""}`} value={customerLedgerData ? `${inr(shopBalance)}${shopBalance !== 0 ? (shopBalance > 0 ? " Dr" : " Cr") : ""}` : "—"} />
                <HeroFig label="Total billed" value={customerLedgerData ? inr(Number(customerLedgerData.totalDebit || 0)) : "—"} />
                <HeroFig label="Total paid" value={customerLedgerData ? inr(Number(customerLedgerData.totalCredit || 0)) : "—"} accent="text-emerald-200" />
              </div>
              {customerLedgerData && balance > 0 && can("ledger", "create") && (
                <button type="button" onClick={openPayment} className="mt-5 btn bg-white text-navy-900 hover:bg-emerald-50 shadow-sm">
                  <Icon name="wallet" /> Collect {inr(balance)}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Statement */}
          <section className="card overflow-hidden">
            <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="card-title text-[14.5px]">Statement</h2>
              <Segmented size="sm" value={entryFilter} onChange={setEntryFilter} options={tabs.map((t) => ({ key: t.key, label: t.label, count: t.count, tone: t.key === "debit" ? "rose" : t.key === "credit" ? "emerald" : undefined }))} />
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-slate-100" />
                    <div className="flex-1 h-3 rounded bg-slate-100" />
                    <div className="w-20 h-3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : !selectedCustomerId ? (
              <EmptyState icon="users" tone="brand" title="Pick a customer" text="Choose someone from the list to see their bills and payments." />
            ) : !customerLedgerData || filteredEntries.length === 0 ? (
              <EmptyState icon="file" title="No ledger entries" text="Nothing recorded for this customer in the selected scope." />
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
                                <DateTile date={entry.entry_date} debit={isDebit} />
                                <span className="text-[12px] text-slate-500">{fmtMonth(entry.entry_date)}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-[13px] text-navy-900">{entry.description || entry.reference_type}</span>
                                {!isDebit && entry.payment_method && <span className="badge-inactive uppercase text-[10px]">{entry.payment_method.replace("_", " ")}</span>}
                              </div>
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
                            <td className="text-right font-semibold text-rose-600 whitespace-nowrap tabular">{isDebit ? inr(amt) : <span className="text-slate-300">—</span>}</td>
                            <td className="text-right font-semibold text-emerald-600 whitespace-nowrap tabular">{!isDebit ? inr(amt) : <span className="text-slate-300">—</span>}</td>
                            <td className="text-right whitespace-nowrap">
                              <span className="font-bold text-navy-900 tabular">{inr(bal)}</span>
                              <span className={`ml-1.5 text-[11px] font-semibold ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>{bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}</span>
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
                        <DateTile date={entry.entry_date} debit={isDebit} withMonth />
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
                              {!isDebit && entry.payment_method && <span className="badge-inactive uppercase text-[10px]">{entry.payment_method.replace("_", " ")}</span>}
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
        </div>
      </div>

      {/* Record payment */}
      {showPaymentModal && (
        <Modal
          size="sm"
          icon="wallet"
          title="Record payment"
          subtitle={selectedCustomer?.name}
          onClose={() => setShowPaymentModal(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="ledger-pay-form" disabled={submittingPay} className="btn-primary">{submittingPay ? "Saving…" : "Save payment"}</button>
            </>
          }
        >
          <form id="ledger-pay-form" onSubmit={handleRecordPayment} className="space-y-4">
            {balance > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <span className="text-[12.5px] font-medium text-rose-700">Current due</span>
                <span className="text-[15px] font-bold text-rose-700 tabular">{inr(balance)}</span>
              </div>
            )}
            <div>
              <label className="label">Amount received (₹)</label>
              <input type="number" step="0.01" min="0.01" required autoFocus className="input text-[16px] font-semibold tabular" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" />
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
              <label className="label">Notes (optional)</label>
              <input type="text" className="input" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Receipt note or reference" />
            </div>
            <p className="text-[11.5px] text-slate-500">Credits the customer&apos;s ledger and settles unpaid bills automatically.</p>
            {payError && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {payError}</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

function HeroFig({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] ring-1 ring-inset ring-white/10 px-3 py-2.5 min-w-0">
      <div className="text-[10.5px] sm:text-[11px] text-emerald-50/70 truncate">{label}</div>
      <div className={`mt-0.5 text-[13px] sm:text-[16px] font-semibold tabular truncate ${accent || "text-white"}`}>{value}</div>
    </div>
  );
}

function DateTile({ date, debit, withMonth }: { date: string; debit: boolean; withMonth?: boolean }) {
  return (
    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center leading-none shrink-0 ring-1 ring-inset ${debit ? "bg-rose-50 text-rose-600 ring-rose-600/10" : "bg-emerald-50 text-emerald-600 ring-emerald-600/10"}`}>
      <span className="text-[14px] font-bold">{new Date(date).toLocaleDateString("en-IN", { day: "2-digit" })}</span>
      {withMonth && <span className="text-[9px] font-semibold uppercase mt-0.5">{new Date(date).toLocaleDateString("en-IN", { month: "short" })}</span>}
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
