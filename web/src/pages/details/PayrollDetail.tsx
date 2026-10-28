import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPayroll, paySalary } from "../../api/payroll";
import ReferenceLink from "../../components/ReferenceLink";

export default function PayrollDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [payroll, setPayroll] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getPayroll(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setPayroll(res.data.data);
        } else {
          setError("Payroll record not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load payroll details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDisburseSalary() {
    if (!payroll) return;
    const amount = Number(prompt(`Enter disbursement amount (Net salary: ₹${payroll.net_salary}):`, String(payroll.net_salary)));
    if (!amount || isNaN(amount) || amount <= 0) return;

    setPaying(true);
    try {
      await paySalary(payroll.id, {
        amount,
        method: "bank_transfer",
        notes: `Salary disbursement for period ${payroll.period_start} to ${payroll.period_end}`,
      });
      const res = await getPayroll(payroll.id);
      setPayroll(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to disburse salary");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading payroll voucher...</p>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Payroll Voucher Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No payroll matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/payroll")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Payroll
        </button>
      </div>
    );
  }

  const isPaid = payroll.status === "paid";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
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
              <h1 className="text-xl font-bold font-mono text-slate-900">PAYROLL-{payroll.id}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  isPaid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {payroll.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: {new Date(payroll.period_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} to{" "}
              {new Date(payroll.period_end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPaid && (
            <button
              onClick={handleDisburseSalary}
              disabled={paying}
              className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              {paying ? "Disbursing..." : "Disburse Salary"}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Payslip
          </button>
        </div>
      </div>

      {/* Employee & Shop Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Employee Profile</span>
          {payroll.employee ? (
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                <ReferenceLink type="employee" id={payroll.employee.id}>
                  {payroll.employee.name}
                </ReferenceLink>
              </p>
              <p className="text-xs text-slate-500">{payroll.employee.email}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Employee #{payroll.employee_id}</p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Store / Branch</span>
          <p className="font-semibold text-slate-800 text-sm">{payroll.shop?.name || "Main Store"}</p>
          <p className="text-xs font-mono text-slate-500">{payroll.shop?.code}</p>
        </div>
      </div>

      {/* Salary Breakdown Voucher */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
          Earnings & Deductions Statement
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
          {/* Earnings */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block border-b border-slate-100 pb-1">
              Gross Earnings
            </span>
            <div className="flex justify-between text-slate-600">
              <span>Basic Salary (Base Rate)</span>
              <span>₹{Number(payroll.basic_salary || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Attendance ({payroll.present_days || 0} / {payroll.working_days || 0} days)</span>
              <span className="font-medium text-slate-800">₹{Number(payroll.earned_salary || 0).toLocaleString("en-IN")}</span>
            </div>
            {Number(payroll.incentive_amount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Incentives / Commission</span>
                <span>+₹{Number(payroll.incentive_amount).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block border-b border-slate-100 pb-1">
              Deductions
            </span>
            <div className="flex justify-between text-slate-600">
              <span>Advance Recovery</span>
              <span className="text-rose-600">-₹{Number(payroll.advance_deduction || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Other Deductions</span>
              <span className="text-rose-600">-₹{Number(payroll.other_deduction || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Net Salary Total */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block">Net Payable Salary</span>
            <span className="text-xs text-slate-400">Total compensation disbursed</span>
          </div>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
            ₹{Number(payroll.net_salary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Payment History */}
        {payroll.payments && payroll.payments.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">Disbursement Log</span>
            <div className="space-y-2">
              {payroll.payments.map((p: any) => (
                <div key={p.id} className="p-3 bg-slate-50/60 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 uppercase">{p.payment_method}</span>
                    <span className="text-slate-400 ml-2 font-mono">{p.transaction_id || "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700">₹{Number(p.amount).toLocaleString("en-IN")}</span>
                    <span className="text-slate-400 block text-[11px]">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
