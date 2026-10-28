import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listEmiPlans, listDueInstallments, payInstallment, cancelEmiPlan } from "../api/emi";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { EMIPlan } from "../types";

function EMIInner() {
  const shopId = useAuthStore((s) => s.shopId);
  const { isOwner } = usePermission();

  const [activeTab, setActiveTab] = useState<"plans" | "due">("plans");
  const [plans, setPlans] = useState<EMIPlan[]>([]);
  const [dueInstallments, setDueInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Pay Installment Modal
  const [payingInst, setPayingInst] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paySaving, setPaySaving] = useState(false);

  function loadData() {
    setLoading(true);
    const params = {
      allShops: isOwner && allShopsToggle ? true : undefined,
    };

    if (activeTab === "plans") {
      listEmiPlans(params)
        .then((res) => setPlans(res.data.data ?? []))
        .catch((err) => setError(apiErrorMessage(err, "Could not load EMI plans")))
        .finally(() => setLoading(false));
    } else {
      listDueInstallments(params)
        .then((res) => setDueInstallments(res.data.data ?? []))
        .catch((err) => setError(apiErrorMessage(err, "Could not load due installments")))
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    loadData();
  }, [shopId, activeTab, allShopsToggle]);

  async function handlePayInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInst) return;
    setPaySaving(true);
    try {
      await payInstallment(payingInst.id, {
        amount: Number(payAmount),
        method: payMethod,
      });
      setPayingInst(null);
      setPayAmount("");
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not record installment payment"));
    } finally {
      setPaySaving(false);
    }
  }

  async function handleCancelPlan(planId: number) {
    const reason = prompt("Enter cancellation reason for this EMI plan:");
    if (!reason) return;
    try {
      await cancelEmiPlan(planId, reason);
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not cancel plan"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">EMI & Installment Plans</h1>
          <p className="text-sm text-muted mt-1">
            Customer installment schedules, collections tracker, and late fee processing.
          </p>
        </div>

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
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "plans"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          All EMI Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("due")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "due"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Due & Overdue Collections ({dueInstallments.length})
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            {activeTab === "plans" ? (
              <tr>
                <th>Plan #</th>
                <th>Customer</th>
                <th>Invoice</th>
                {allShopsToggle && <th>Shop</th>}
                <th>Financed</th>
                <th>Tenure</th>
                <th>Monthly EMI</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Due Date</th>
                <th>Customer</th>
                <th>Invoice</th>
                {allShopsToggle && <th>Shop</th>}
                <th>Inst #</th>
                <th>Expected</th>
                <th>Late Fee</th>
                <th>Remaining</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted">
                  Loading EMI data…
                </td>
              </tr>
            ) : activeTab === "plans" ? (
              plans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted">
                    No EMI plans found. Enable EMI when creating an invoice in Sales.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs font-medium">
                      <ReferenceLink type="emi" id={p.id} refNumber={`EMI-${p.id}`} />
                    </td>
                    <td className="font-medium text-ink-900">
                      {p.customer ? (
                        <ReferenceLink type="customer" id={p.customer.id}>
                          {p.customer.name}
                        </ReferenceLink>
                      ) : (
                        "Customer"
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      {p.sale ? (
                        <ReferenceLink type="sale" id={p.sale.id} refNumber={p.sale.invoice_number} />
                      ) : (
                        `Sale #${p.sale_id}`
                      )}
                    </td>
                    {allShopsToggle && (
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {p.shop?.name || `Shop #${p.shop_id}`}
                        </span>
                      </td>
                    )}
                    <td className="font-mono">₹{Number(p.financed_amount).toFixed(2)}</td>
                    <td className="font-mono">{p.tenure_months} mo</td>
                    <td className="font-mono font-medium text-indigo-700">₹{Number(p.monthly_installment).toFixed(2)}</td>
                    <td className="font-mono font-bold text-danger">₹{Number(p.outstanding_amount).toFixed(2)}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.status === "completed"
                            ? "bg-accent-100 text-accent-700"
                            : p.status === "active"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-ink-100 text-ink-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      <Link
                        to={`/app/emi/${p.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        View Schedule
                      </Link>
                      {p.status === "active" && (
                        <button
                          onClick={() => handleCancelPlan(p.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )
            ) : dueInstallments.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted">
                  No upcoming or overdue installments pending!
                </td>
              </tr>
            ) : (
              dueInstallments.map((row) => {
                const inst = row.installment;
                return (
                  <tr key={inst.id}>
                    <td className="text-xs text-muted font-medium">
                      {new Date(inst.due_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="font-medium text-ink-900">
                      {row.customer?.name}
                      <span className="block text-[11px] font-mono text-muted">{row.customer?.phone}</span>
                    </td>
                    <td className="font-mono text-xs">{row.sale?.invoice_number}</td>
                    {allShopsToggle && (
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {row.plan?.shop?.name || "Shop"}
                        </span>
                      </td>
                    )}
                    <td className="font-mono">#{inst.installment_number}</td>
                    <td className="font-mono">₹{Number(inst.expected_amount).toFixed(2)}</td>
                    <td className="font-mono text-amber-600">
                      {Number(inst.late_fee) > 0 ? `₹${Number(inst.late_fee).toFixed(2)}` : "—"}
                    </td>
                    <td className="font-mono font-bold text-danger">₹{Number(inst.remaining_amount).toFixed(2)}</td>
                    <td>
                      <span
                        className={`badge ${
                          inst.status === "Overdue"
                            ? "bg-danger/10 text-danger"
                            : inst.status === "Due"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-ink-100 text-ink-700"
                        }`}
                      >
                        {inst.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          setPayingInst(inst);
                          setPayAmount(String(inst.remaining_amount));
                        }}
                        className="btn-primary py-1 px-2.5 text-xs"
                      >
                        Collect EMI
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Collect EMI Payment Modal */}
      {payingInst && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Collect EMI Installment #{payingInst.installment_number}</h2>
            <form onSubmit={handlePayInstallment} className="space-y-4">
              <div>
                <label className="label">
                  Collection Amount * (Remaining: ₹{payingInst.remaining_amount})
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={payingInst.remaining_amount}
                  required
                  className="input font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPayingInst(null)}>
                  Cancel
                </button>
                <button disabled={paySaving} className="btn-primary">
                  {paySaving ? "Recording…" : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EMI() {
  return (
    <RequireModule module="emi">
      <EMIInner />
    </RequireModule>
  );
}
