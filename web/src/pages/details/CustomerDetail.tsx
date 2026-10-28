import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCustomer } from "../../api/customers";
import ReferenceLink from "../../components/ReferenceLink";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "ledger" | "emi">("sales");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getCustomer(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setCustomer(res.data.data);
        } else {
          setError("Customer not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load customer profile");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading customer profile...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Customer Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No customer matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/customers")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Customers
        </button>
      </div>
    );
  }

  const currentBalance = Number(customer.current_balance || 0);

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
              <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
              <span className="text-xs font-mono font-medium text-slate-400">ID: {customer.id}</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                  customer.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {customer.status || "active"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {customer.phone || "No phone"} • {customer.email || "No email"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/billing")}
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Invoice
          </button>
        </div>
      </div>

      {/* Customer Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Current Balance</span>
          <p className={`text-2xl font-extrabold ${currentBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            ₹{Math.abs(currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">
            {currentBalance > 0 ? "Outstanding Due by Customer" : "No Due (Clear)"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Opening Balance</span>
          <p className="text-2xl font-extrabold text-slate-800">
            ₹{Number(customer.opening_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">Account opening balance</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contact & GSTIN</span>
          <p className="text-xs text-slate-700 truncate">{customer.address || "Address not provided"}</p>
          <p className="text-xs font-mono text-slate-500 mt-1">GSTIN: {customer.gstin || "—"}</p>
        </div>
      </div>

      {/* Tabs Section: Sales, Ledger, EMI */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("sales")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "sales"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Invoices & Sales ({customer.sales?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "ledger"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Ledger History ({customer.ledgerEntries?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("emi")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "emi"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            EMI Plans ({customer.emiPlans?.length || 0})
          </button>
        </div>

        {/* Tab 1: Sales Invoices */}
        {activeTab === "sales" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.sales && customer.sales.length > 0 ? (
                  customer.sales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        <ReferenceLink type="sale" id={s.id} refNumber={s.invoice_number} />
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(s.invoice_date || s.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        ₹{Number(s.total_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        ₹{Number(s.paid_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        ₹{Number(s.due_amount || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">No sales recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Customer Ledger */}
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
                {customer.ledgerEntries && customer.ledgerEntries.length > 0 ? (
                  customer.ledgerEntries.map((le: any) => (
                    <tr key={le.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(le.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{le.description || "Ledger Entry"}</td>
                      <td className="py-3 px-4 font-mono">
                        {le.reference_type === "Sale" ? (
                          <ReferenceLink type="sale" id={le.reference_id} refNumber={`Sale #${le.reference_id}`} />
                        ) : le.reference_type === "Payment" ? (
                          <ReferenceLink type="payment" id={le.reference_id} refNumber={`PAY-${le.reference_id}`} />
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

        {/* Tab 3: EMI Plans */}
        {activeTab === "emi" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Plan #</th>
                  <th className="py-2.5 px-4">Linked Sale</th>
                  <th className="py-2.5 px-4">Total Financed</th>
                  <th className="py-2.5 px-4">Down Payment</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.emiPlans && customer.emiPlans.length > 0 ? (
                  customer.emiPlans.map((ep: any) => (
                    <tr key={ep.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        <ReferenceLink type="emi" id={ep.id} refNumber={`EMI-${ep.id}`} />
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <ReferenceLink type="sale" id={ep.sale_id} refNumber={`Sale #${ep.sale_id}`} />
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        ₹{Number(ep.total_payable || ep.financed_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-emerald-700">
                        ₹{Number(ep.down_payment || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                          {ep.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ReferenceLink type="emi" id={ep.id} className="text-xs">
                          View Schedule →
                        </ReferenceLink>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">No EMI plans found for this customer</td>
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
