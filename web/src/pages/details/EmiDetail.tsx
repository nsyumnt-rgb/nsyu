import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEmiPlan, payInstallment } from "../../api/emi";
import ReferenceLink from "../../components/ReferenceLink";

export default function EmiDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getEmiPlan(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setPlan(res.data.data);
        } else {
          setError("EMI plan not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load EMI plan");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay(installment: any) {
    const amount = Number(prompt(`Enter payment amount (Expected: ₹${installment.remaining_amount}):`, String(installment.remaining_amount)));
    if (!amount || isNaN(amount) || amount <= 0) return;

    setPayingId(installment.id);
    try {
      await payInstallment(installment.id, {
        amount,
        method: "cash",
        notes: `Installment #${installment.installment_number} payment`,
      });
      const res = await getEmiPlan(plan.id);
      setPlan(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to record installment payment");
    } finally {
      setPayingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading EMI plan details...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">EMI Plan Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No EMI plan matching reference "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/emi")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to EMI
        </button>
      </div>
    );
  }

  const remainingFinancedDue = Math.max(0, Number(plan.total_payable || 0) - Number(plan.paid_amount || 0));

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
              <h1 className="text-xl font-bold font-mono text-slate-900">EMI-{plan.id}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  plan.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : plan.status === "active"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {plan.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tenure: {plan.tenure_months} Months • Rate: {plan.interest_rate_percent}% p.a.
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Schedule
        </button>
      </div>

      {/* Overview Cards: Financials, Customer, Sale */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Financed</span>
          <p className="text-2xl font-extrabold text-purple-700">
            ₹{Number(plan.total_payable || plan.financed_amount || 0).toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-slate-400">
            Monthly: ₹{Number(plan.monthly_installment || 0).toLocaleString("en-IN")}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Down Payment</span>
          <p className="text-2xl font-extrabold text-emerald-700">
            ₹{Number(plan.down_payment || 0).toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-slate-400">Paid upfront at purchase</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Remaining Balance</span>
          <p className={`text-2xl font-extrabold ${remainingFinancedDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            ₹{remainingFinancedDue.toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-slate-400">
            {remainingFinancedDue > 0 ? "Outstanding balance" : "Fully Paid"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Linked Records</span>
          <p className="text-xs text-slate-700">
            <span className="text-slate-400">Customer: </span>
            {plan.customer ? (
              <ReferenceLink type="customer" id={plan.customer.id}>
                {plan.customer.name}
              </ReferenceLink>
            ) : (
              "—"
            )}
          </p>
          <p className="text-xs text-slate-700">
            <span className="text-slate-400">Invoice: </span>
            {plan.sale ? (
              <ReferenceLink type="sale" id={plan.sale.id} refNumber={plan.sale.invoice_number} />
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {/* Installments Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Installment Schedule</span>
          <span className="text-xs text-slate-500">{plan.installments?.length || 0} installment(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Inst #</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4">Expected Amount</th>
                <th className="py-2.5 px-4">Remaining Balance</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plan.installments && plan.installments.length > 0 ? (
                plan.installments.map((inst: any) => {
                  const isPaid = inst.status === "paid" || Number(inst.remaining_amount) <= 0;
                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        #{inst.installment_number}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {new Date(inst.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        ₹{Number(inst.expected_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        ₹{Number(inst.remaining_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inst.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isPaid ? "paid" : inst.status || "due"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isPaid && (
                          <button
                            onClick={() => handlePay(inst)}
                            disabled={payingId === inst.id}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-2xs transition-colors disabled:opacity-50"
                          >
                            {payingId === inst.id ? "Processing..." : "Pay Inst"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">No installments generated for this plan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
