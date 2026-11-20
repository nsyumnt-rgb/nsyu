import { useState } from "react";
import { useAuthStore } from "../store/authStore";

interface LedgerEntry {
  id: string;
  date: string;
  po: string;
  counterparty: string;
  type: "PO Bill" | "Payment";
  note: string;
  dr: number;
  cr: number;
}

const SAMPLE_PAYABLES: LedgerEntry[] = [
  { id: "l1", date: "2026-11-08", po: "PO-3001", counterparty: "Verma Distributors", type: "PO Bill", note: "Net 15 terms", dr: 18100, cr: 0 },
  { id: "l2", date: "2026-11-12", po: "PO-3001", counterparty: "Verma Distributors", type: "Payment", note: "Advance · UPI", dr: 0, cr: 5000 },
  { id: "l3", date: "2026-11-19", po: "PO-3002", counterparty: "Verma Distributors", type: "PO Bill", note: "Net 30 terms", dr: 48250, cr: 0 },
];

const SAMPLE_RECEIVABLES: LedgerEntry[] = [
  { id: "r1", date: "2026-11-14", po: "PO-3003", counterparty: "Gupta Electronics", type: "PO Bill", note: "Advance terms", dr: 13800, cr: 0 },
  { id: "r2", date: "2026-11-14", po: "PO-3003", counterparty: "Gupta Electronics", type: "Payment", note: "Full advance · NEFT", dr: 0, cr: 13800 },
];

export default function B2BLedger() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const [tab, setTab] = useState<"pay" | "rec">("pay");

  const entries = tab === "pay" ? SAMPLE_PAYABLES : SAMPLE_RECEIVABLES;
  const totalBilled = entries.reduce((s, e) => s + e.dr, 0);
  const totalPaid = entries.reduce((s, e) => s + e.cr, 0);
  const totalBalance = totalBilled - totalPaid;

  let running = 0;
  const computedEntries = entries.map((e) => {
    running += e.dr - e.cr;
    return { ...e, balance: running };
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Payables & receivables
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Separate wholesale ledgers for what {activeShop?.name || "your shop"} owes suppliers and what other shops owe you.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("pay")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            tab === "pay"
              ? "bg-[#047857] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Payable (I owe suppliers)
        </button>
        <button
          type="button"
          onClick={() => setTab("rec")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            tab === "rec"
              ? "bg-[#047857] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Receivable (owed to me by shops)
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">
            {tab === "pay" ? "Total amount payable" : "Total amount receivable"}
          </div>
          <div className={`text-2xl font-black mt-1 ${tab === "pay" ? "text-rose-700" : "text-emerald-800"}`}>
            ₹{totalBalance.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Outstanding balance</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Total billed</div>
          <div className="text-2xl font-black text-gray-900 mt-1">
            ₹{totalBilled.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Approved PO bills</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Total settled</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            ₹{totalPaid.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Payments cleared</div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-900">
            Ledger transactions ({computedEntries.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">{tab === "pay" ? "Supplier" : "Buyer Shop"}</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Note</th>
                <th className="py-3 px-4 text-right">Debit (Dr)</th>
                <th className="py-3 px-4 text-right">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {computedEntries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/60 transition">
                  <td className="py-3.5 px-4 text-gray-500 font-medium">{e.date}</td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">{e.po}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-800">{e.counterparty}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                        e.type === "PO Bill"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 font-medium">{e.note}</td>
                  <td className="py-3.5 px-4 text-right font-black text-rose-700">
                    {e.dr ? `₹${e.dr.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-800">
                    {e.cr ? `₹${e.cr.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-gray-900">
                    ₹{e.balance.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
