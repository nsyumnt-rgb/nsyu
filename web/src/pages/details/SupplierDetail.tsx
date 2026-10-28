import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSupplier } from "../../api/suppliers";
import ReferenceLink from "../../components/ReferenceLink";

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"purchases" | "ledger">("purchases");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getSupplier(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setSupplier(res.data.data);
        } else {
          setError("Supplier not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load supplier profile");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading supplier profile...</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Supplier Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No supplier matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/suppliers")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Suppliers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go Back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{supplier.name}</h1>
              <span className="text-xs font-mono font-medium text-slate-400">ID: {supplier.id}</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                  supplier.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {supplier.status || "active"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {supplier.phone || "No phone"} • {supplier.email || "No email"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/purchase")}
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Purchase Bill
          </button>
        </div>
      </div>

      {/* Info Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Purchases</span>
          <p className="text-2xl font-extrabold text-slate-800">
            {supplier.purchases?.length || 0} Bills
          </p>
          <span className="text-[11px] text-slate-400">Recorded vendor bills</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">GSTIN Number</span>
          <p className="text-lg font-mono font-bold text-slate-800">
            {supplier.gstin || "Not Registered"}
          </p>
          <span className="text-[11px] text-slate-400">Tax identification number</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Address</span>
          <p className="text-xs text-slate-700 truncate">{supplier.address || "No address provided"}</p>
        </div>
      </div>

      {/* Tabs Section: Purchases, Ledger */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("purchases")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "purchases"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Purchase Bills ({supplier.purchases?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "ledger"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Ledger History ({supplier.ledgerEntries?.length || 0})
          </button>
        </div>

        {/* Tab 1: Purchase Bills */}
        {activeTab === "purchases" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Bill #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplier.purchases && supplier.purchases.length > 0 ? (
                  supplier.purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        <ReferenceLink type="purchase" id={p.id} refNumber={p.purchase_number} />
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(p.purchase_date || p.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        ₹{Number(p.total_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        ₹{Number(p.paid_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        ₹{Number(p.due_amount || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">No purchase bills recorded for this supplier</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Supplier Ledger */}
        {activeTab === "ledger" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Reference</th>
                  <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                  <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplier.ledgerEntries && supplier.ledgerEntries.length > 0 ? (
                  supplier.ledgerEntries.map((le: any) => (
                    <tr key={le.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(le.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{le.description || "Ledger Entry"}</td>
                      <td className="py-3 px-4 font-mono">
                        {le.reference_type === "Purchase" ? (
                          <ReferenceLink type="purchase" id={le.reference_id} refNumber={`Purchase #${le.reference_id}`} />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-rose-600">
                        {le.entry_type === "debit" ? `₹${Number(le.amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">
                        {le.entry_type === "credit" ? `₹${Number(le.amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{Number(le.balance_after || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">No ledger entries recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
