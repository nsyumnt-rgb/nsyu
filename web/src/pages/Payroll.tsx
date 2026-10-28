import { useEffect, useState } from "react";
import { listPayrolls, previewPayroll, runPayroll, paySalary } from "../api/payroll";
import { listEmployees } from "../api/employees";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { PayrollRecord, Employee } from "../types";

function PayrollInner() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner, can } = usePermission();

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Run Payroll Modal
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Pay Salary Modal
  const [payingPayroll, setPayingPayroll] = useState<PayrollRecord | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank");
  const [paySaving, setPaySaving] = useState(false);

  function loadData() {
    setLoading(true);
    const params = {
      allShops: isOwner && allShopsToggle ? true : undefined,
    };

    listPayrolls(params)
      .then((res) => setPayrolls(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load payrolls")))
      .finally(() => setLoading(false));

    listEmployees().then((res) => setEmployees(res.data.data ?? []));
  }

  useEffect(() => {
    loadData();
  }, [shopId, allShopsToggle]);

  async function handlePreview() {
    if (!selectedEmpId || !periodStart || !periodEnd) {
      setRunError("Please select employee and period start/end");
      return;
    }
    setCalculating(true);
    setRunError(null);
    try {
      const res = await previewPayroll({
        employeeId: Number(selectedEmpId),
        periodStart,
        periodEnd,
      });
      setPreviewData(res.data.data);
    } catch (err) {
      setRunError(apiErrorMessage(err, "Calculation preview failed"));
    } finally {
      setCalculating(false);
    }
  }

  async function handleRunSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmpId || !periodStart || !periodEnd) return;
    setSubmitting(true);
    setRunError(null);
    try {
      await runPayroll({
        employeeId: Number(selectedEmpId),
        periodStart,
        periodEnd,
      });
      setShowRunModal(false);
      setPreviewData(null);
      loadData();
    } catch (err) {
      setRunError(apiErrorMessage(err, "Could not run payroll"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaySalary(e: React.FormEvent) {
    e.preventDefault();
    if (!payingPayroll) return;
    setPaySaving(true);
    try {
      await paySalary(payingPayroll.id, {
        amount: Number(payAmount),
        method: payMethod,
      });
      setPayingPayroll(null);
      setPayAmount("");
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not record salary payment"));
    } finally {
      setPaySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Payroll & Salary Processing</h1>
          <p className="text-sm text-muted mt-1">
            Automated attendance-based salary calculations, advances, and disbursement ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2 mr-2">
              <input
                type="checkbox"
                checked={allShopsToggle}
                onChange={(e) => setAllShopsToggle(e.target.checked)}
                className="rounded border-border text-accent-600 focus:ring-accent-500"
              />
              Consolidated (All Shops)
            </label>
          )}

          {(isOwner || can("payroll", "create")) && (
            <button className="btn-primary" onClick={() => setShowRunModal(true)}>
              + Run Payroll
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Payroll Records Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Employee</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Gross Salary</th>
              <th>Incentives</th>
              <th>Deductions</th>
              <th>Adv Recovered</th>
              <th>Net Salary</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 12 : 11} className="text-center py-8 text-muted">
                  Loading payroll records…
                </td>
              </tr>
            ) : payrolls.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 12 : 11} className="text-center py-8 text-muted">
                  No payroll runs found. Click "+ Run Payroll" to process monthly salaries.
                </td>
              </tr>
            ) : (
              payrolls.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs font-mono">
                    <ReferenceLink type="payroll" id={p.id} refNumber={`PAYROLL-${p.id}`}>
                      {p.period_start} to {p.period_end}
                    </ReferenceLink>
                  </td>
                  <td className="font-medium text-ink-900">
                    <ReferenceLink type="employee" id={p.employee_id}>
                      {p.employee?.name || `Emp #${p.employee_id}`}
                    </ReferenceLink>
                  </td>
                  {allShopsToggle && (
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                        {p.shop?.name || `Shop #${p.shop_id}`}
                      </span>
                    </td>
                  )}
                  <td className="font-mono text-xs">₹{Number(p.gross_salary).toFixed(2)}</td>
                  <td className="font-mono text-xs text-accent-600">
                    {Number(p.incentive_amount) > 0 ? `+₹${Number(p.incentive_amount).toFixed(2)}` : "—"}
                  </td>
                  <td className="font-mono text-xs text-danger">
                    {Number(p.deductions) > 0 ? `-₹${Number(p.deductions).toFixed(2)}` : "—"}
                  </td>
                  <td className="font-mono text-xs text-amber-600">
                    {Number(p.advance_deduction) > 0 ? `-₹${Number(p.advance_deduction).toFixed(2)}` : "—"}
                  </td>
                  <td className="font-mono font-bold text-ink-900">₹{Number(p.net_salary).toFixed(2)}</td>
                  <td className="font-mono text-accent-600 font-medium">₹{Number(p.paid_amount).toFixed(2)}</td>
                  <td className="font-mono text-danger font-medium">
                    {Number(p.due_amount) > 0 ? `₹${Number(p.due_amount).toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === "paid"
                          ? "bg-accent-100 text-accent-700"
                          : p.status === "finalized" || p.status === "partially_paid"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    <ReferenceLink
                      type="payroll"
                      id={p.id}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium inline-block"
                    >
                      Voucher
                    </ReferenceLink>
                    {Number(p.due_amount) > 0 && p.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          setPayingPayroll(p);
                          setPayAmount(String(p.due_amount));
                        }}
                        className="btn-primary py-1 px-2.5 text-xs"
                      >
                        Pay Salary
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Run Payroll Modal */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">Process Payroll — {activeShop?.name}</h2>
              <button onClick={() => setShowRunModal(false)} className="text-muted hover:text-ink-900">
                ✕
              </button>
            </div>

            <form onSubmit={handleRunSubmit} className="space-y-4">
              <div>
                <label className="label">Employee *</label>
                <select
                  required
                  className="input"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(Number(e.target.value) || "")}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Period Start *</label>
                  <input
                    type="date"
                    required
                    className="input font-mono"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Period End *</label>
                  <input
                    type="date"
                    required
                    className="input font-mono"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={calculating || !selectedEmpId || !periodStart || !periodEnd}
                className="btn-secondary w-full text-xs py-2"
              >
                {calculating ? "Calculating from Attendance & Rules…" : "⚡ Preview Figures from Attendance"}
              </button>

              {/* Preview Box */}
              {previewData && (
                <div className="bg-canvas p-4 rounded space-y-2 text-xs font-mono border">
                  <div className="font-semibold font-sans text-sm text-ink-900 border-b pb-1">
                    Calculation Summary for {previewData.employee.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted">
                    <div>Days in Period: {previewData.totalDaysInPeriod}</div>
                    <div>Present Days: {previewData.attendance.presentDays}</div>
                    <div>Basic: ₹{previewData.basicComponent}</div>
                    <div>Allowances: ₹{previewData.allowancesComponent}</div>
                    <div>Overtime: ₹{previewData.overtimeAmount} ({previewData.attendance.overtimeHours}h)</div>
                    <div>Incentives: ₹{previewData.incentiveAmount}</div>
                    <div>Deductions: -₹{previewData.otherDeduction}</div>
                    <div>Adv Recovery: -₹{previewData.advanceDeduction}</div>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-sm text-ink-900">
                    <span>Net Salary Payable:</span>
                    <span className="text-accent-700">₹{previewData.netSalary.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {runError && <p className="text-sm text-danger">{runError}</p>}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" className="btn-secondary" onClick={() => setShowRunModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !previewData} className="btn-primary">
                  {submitting ? "Finalizing Payroll…" : "Confirm & Finalize Payroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {payingPayroll && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Disburse Salary to {payingPayroll.employee?.name}</h2>
            <form onSubmit={handlePaySalary} className="space-y-4">
              <div>
                <label className="label">Disbursement Amount (Due: ₹{payingPayroll.due_amount})</label>
                <input
                  type="number"
                  step="0.01"
                  max={payingPayroll.due_amount}
                  required
                  className="input font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="bank">Direct Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPayingPayroll(null)}>
                  Cancel
                </button>
                <button disabled={paySaving} className="btn-primary">
                  {paySaving ? "Disbursing…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Payroll() {
  return (
    <RequireModule module="payroll">
      <PayrollInner />
    </RequireModule>
  );
}
