import { useEffect, useState } from "react";
import { listPortalLedgerApi, getPortalLedgerSummaryApi, listPortalPaymentsApi } from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

export default function PortalLedger() {
  const customer = usePortalStore((s) => s.customer);

  const [activeTab, setActiveTab] = useState<"statement" | "payments">("statement");
  const [summary, setSummary] = useState<any | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, ledRes, payRes] = await Promise.allSettled([
        getPortalLedgerSummaryApi(),
        listPortalLedgerApi({
          from: from || undefined,
          to: to || undefined,
          page,
          limit: 15,
        }),
        listPortalPaymentsApi(),
      ]);

      if (sumRes.status === "fulfilled" && sumRes.value) {
        setSummary(sumRes.value);
      }
      if (ledRes.status === "fulfilled" && ledRes.value) {
        setLedgerEntries(ledRes.value.data || []);
        setTotalPages(ledRes.value.pagination?.pages || 1);
      }
      if (payRes.status === "fulfilled" && payRes.value) {
        setPayments(payRes.value);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    setPage(1);
  };

  const currentBal = Number(summary?.currentBalance ?? customer?.currentBalance ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Account Statement & Ledger</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time chronological financial transaction history and running balance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-sm flex items-center gap-1.5 self-start md:self-auto"
        >
          <PrintIcon className="w-4 h-4" />
          <span>Print Statement</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Total Invoiced (Debit)
          </span>
          <div className="text-2xl font-black text-gray-900">
            ₹{Number(summary?.totalDebits ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">All purchases and invoices billed</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Total Settled (Credit)
          </span>
          <div className="text-2xl font-black text-emerald-600">
            ₹{Number(summary?.totalCredits ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">Total payments received by shop</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Current Outstanding Balance
          </span>
          <div
            className={`text-2xl font-black ${
              currentBal > 0 ? "text-rose-600" : currentBal < 0 ? "text-emerald-600" : "text-gray-900"
            }`}
          >
            ₹{Math.abs(currentBal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block font-medium">
            {currentBal > 0 ? "Amount payable to the shop" : currentBal < 0 ? "Advance balance" : "All cleared"}
          </span>
        </div>
      </div>

      {/* Tab Switcher & Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("statement")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "statement"
                  ? "bg-[#047857] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Chronological Statement
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "payments"
                  ? "bg-[#047857] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Payment Receipts ({payments.length})
            </button>
          </div>

          {activeTab === "statement" && (
            <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                title="From date"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                title="To date"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#047857] text-white font-bold rounded-lg hover:bg-emerald-700 transition"
              >
                Filter
              </button>
              {(from || to) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 py-1.5 text-gray-500 hover:text-gray-700 font-semibold"
                >
                  Reset
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Loading statement...</p>
          </div>
        ) : activeTab === "statement" ? (
          ledgerEntries.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">No ledger transactions in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#047857] text-white uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Type / Particulars</th>
                    <th className="p-3.5">Reference</th>
                    <th className="p-3.5 text-right">Debit (+)</th>
                    <th className="p-3.5 text-right">Credit (-)</th>
                    <th className="p-3.5 text-right pr-4">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerEntries.map((row) => {
                    const isDebit = Number(row.debit_amount) > 0;
                    const runningBal = Number(row.running_balance ?? 0);

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition">
                        <td className="p-3.5 text-gray-500 whitespace-nowrap">
                          {new Date(row.entry_date || row.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 ${
                              isDebit ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {row.entry_type || (isDebit ? "Debit" : "Credit")}
                          </span>
                          <span className="font-medium text-gray-800">{row.description || "—"}</span>
                        </td>
                        <td className="p-3.5 font-mono text-gray-500">{row.reference_number || "—"}</td>
                        <td className="p-3.5 text-right font-bold text-gray-900">
                          {isDebit
                            ? `₹${Number(row.debit_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="p-3.5 text-right font-bold text-emerald-600">
                          {!isDebit && Number(row.credit_amount) > 0
                            ? `₹${Number(row.credit_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td
                          className={`p-3.5 text-right font-black pr-4 ${
                            runningBal > 0 ? "text-rose-600" : runningBal < 0 ? "text-emerald-600" : "text-gray-700"
                          }`}
                        >
                          ₹{Math.abs(runningBal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          <span className="text-[10px] font-medium ml-1 text-gray-400">
                            {runningBal > 0 ? "Dr" : runningBal < 0 ? "Cr" : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Payments Table */
          payments.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">No payment records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#047857] text-white uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference #</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5 text-right pr-4">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="p-3.5 text-gray-500 whitespace-nowrap">
                        {new Date(p.payment_date || p.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-gray-800 uppercase tracking-wide">{p.payment_method}</td>
                      <td className="p-3.5 font-mono text-gray-500">{p.reference_number || "—"}</td>
                      <td className="p-3.5 text-gray-600">{p.notes || "—"}</td>
                      <td className="p-3.5 text-right font-black text-emerald-600 text-sm pr-4">
                        ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Pagination for statement */}
      {activeTab === "statement" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-xs font-semibold text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

