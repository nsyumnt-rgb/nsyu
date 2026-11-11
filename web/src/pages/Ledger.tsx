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
    try {
      await recordLedgerPayment({
        customerId: Number(selectedCustomerId),
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes.trim() || `Payment received (${payMethod.toUpperCase()})`,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Customer Ledger &amp; Payments</h1>
          <p className="text-sm text-muted mt-1">
            Single unified ledger: invoices (debit), payments received (credit), and real-time running balance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={allShopsToggle}
                onChange={(e) => setAllShopsToggle(e.target.checked)}
                className="rounded border-border text-accent-600 focus:ring-accent-500"
              />
              Consolidated (All Shops)
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
              className="btn-primary text-xs px-4 py-2"
            >
              + Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setEntryFilter("all")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            entryFilter === "all"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          All Ledger Entries ({allEntries.length})
        </button>
        <button
          onClick={() => setEntryFilter("debit")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            entryFilter === "debit"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Bills / Debits ({allEntries.filter((e: any) => e.entry_type === "debit").length})
        </button>
        <button
          onClick={() => setEntryFilter("credit")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            entryFilter === "credit"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Payments / Credits ({allEntries.filter((e: any) => e.entry_type === "credit").length})
        </button>
      </div>

      {/* Selector & Balances Summary Bar */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-80">
            <label className="label">Select Customer</label>
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

          {customerLedgerData && (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-3 sm:pt-0">
              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Shop Balance ({activeShop?.name})</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    customerLedgerData.shopBalance > 0
                      ? "text-danger"
                      : customerLedgerData.shopBalance < 0
                      ? "text-accent-600"
                      : "text-ink-900"
                  }`}
                >
                  ₹{Math.abs(customerLedgerData.shopBalance).toFixed(2)}
                  <span className="text-[10px] ml-1 font-normal">
                    {customerLedgerData.shopBalance > 0 ? "Due" : customerLedgerData.shopBalance < 0 ? "Adv" : ""}
                  </span>
                </div>
              </div>

              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Total Balance (Global)</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    customerLedgerData.currentBalance > 0
                      ? "text-danger"
                      : customerLedgerData.currentBalance < 0
                      ? "text-accent-600"
                      : "text-ink-900"
                  }`}
                >
                  ₹{Math.abs(customerLedgerData.currentBalance).toFixed(2)}
                  <span className="text-[10px] ml-1 font-normal">
                    {customerLedgerData.currentBalance > 0 ? "Due" : customerLedgerData.currentBalance < 0 ? "Adv" : ""}
                  </span>
                </div>
              </div>

              <div className="bg-canvas p-3 rounded col-span-2 sm:col-span-1">
                <div className="text-[11px] text-muted font-medium">Total Billed / Paid</div>
                <div className="text-xs font-mono mt-1 text-ink-800">
                  <span className="text-danger font-semibold">Dr: ₹{customerLedgerData.totalDebit}</span> |{" "}
                  <span className="text-accent-600 font-semibold">Cr: ₹{customerLedgerData.totalCredit}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Ledger Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Reference</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Type / Method</th>
              <th className="text-right">Debit (Dr)</th>
              <th className="text-right">Credit (Cr)</th>
              <th className="text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 7 : 6} className="text-center py-8 text-muted">
                  Loading statement…
                </td>
              </tr>
            ) : !customerLedgerData || filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 7 : 6} className="text-center py-8 text-muted">
                  No ledger entries found in selected scope.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry: any) => {
                const amt = Number(entry.amount);
                const bal = Number(entry.running_balance ?? 0);
                const isReversed = entry.status === "reversed";

                return (
                  <tr key={entry.id} className={isReversed ? "opacity-50 line-through" : ""}>
                    <td className="text-xs text-muted">
                      {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="font-medium text-xs">{entry.description || entry.reference_type}</div>
                      <div className="font-mono text-[11px] text-muted">
                        Ref:{" "}
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
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {entry.shop?.name || `Shop #${entry.shop_id}`}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`badge ${
                            entry.entry_type === "debit"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {entry.entry_type === "debit" ? "Invoice / Debit" : "Payment / Credit"}
                        </span>
                        {entry.entry_type === "credit" && entry.payment_method && (
                          <span className="badge bg-slate-100 text-slate-700 text-[10px] uppercase">
                            {entry.payment_method.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-mono font-medium text-danger">
                      {entry.entry_type === "debit" ? `₹${amt.toFixed(2)}` : "—"}
                    </td>
                    <td className="text-right font-mono font-medium text-accent-600">
                      {entry.entry_type === "credit" ? `₹${amt.toFixed(2)}` : "—"}
                    </td>
                    <td className="text-right font-mono font-bold">
                      ₹{Math.abs(bal).toFixed(2)} {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Record Customer Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">
              Credits the customer&apos;s single ledger directly and reconciles unpaid bills automatically.
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="input font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select
                  className="input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
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
              {payError && <p className="text-xs text-danger">{payError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {submittingPay ? "Saving..." : "Save to Ledger"}
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
