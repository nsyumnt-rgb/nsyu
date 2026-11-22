import { useRef, useState } from "react";
import { recordSalePayment } from "../api/sales";
import { apiErrorMessage } from "../api/client";
import { Icon, Modal } from "./ui";
import type { Sale } from "../types";

const inr = (n: unknown) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHODS: [string, string][] = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank_transfer", "Bank"],
];

/**
 * Collect money against an unpaid / partly paid bill. Uses the existing
 * sale-payment API, which records the payment and credits the customer's ledger.
 */
export default function ReceivePaymentModal({ sale, onClose, onSaved }: { sale: Sale; onClose: () => void; onSaved: (amount: number) => void }) {
  const due = Math.max(0, Number(sale.due_amount) || 0);
  const [amount, setAmount] = useState(due.toFixed(2));
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // One key per modal opening, so a double click never records the payment twice.
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pos-pay-${sale.id}-${Date.now()}`
  ).current;

  const amt = Number(amount);
  const full = Math.abs(amt - due) < 0.005;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!amt || amt <= 0) return setErr("Enter an amount greater than zero.");
    if (amt > due + 0.01) return setErr(`Amount can't be more than the due ${inr(due)}.`);
    setErr(null);
    setSaving(true);
    try {
      await recordSalePayment(sale.id, { amount: Math.round(amt * 100) / 100, method, notes: note.trim() || undefined, idempotencyKey });
      onSaved(amt);
    } catch (e2) {
      setErr(apiErrorMessage(e2, "Could not record the payment."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      size="sm"
      icon="wallet"
      title="Receive payment"
      subtitle={`${sale.invoice_number}${sale.customer?.name ? ` · ${sale.customer.name}` : ""}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="receive-payment-form" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : full ? `Mark paid · ${inr(amt)}` : `Save payment · ${inr(amt || 0)}`}
          </button>
        </div>
      }
    >
      <form id="receive-payment-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Bill total", inr(sale.total_amount), "text-navy-900"],
            ["Paid", inr(sale.paid_amount), "text-emerald-600"],
            ["Due", inr(due), "text-rose-600"],
          ].map(([l, v, tone]) => (
            <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2.5">
              <div className="text-[11px] text-slate-500">{l}</div>
              <div className={`mt-0.5 text-[13.5px] font-bold tabular ${tone}`}>{v}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label !mb-0" htmlFor="rp-amount">Amount received</label>
            {!full && (
              <button type="button" onClick={() => setAmount(due.toFixed(2))} className="text-[12px] font-semibold text-brand-700 hover:underline">
                Full due
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
            <input
              id="rp-amount"
              type="number"
              step="0.01"
              min="0"
              max={due}
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input pl-7 text-[16px] font-semibold tabular"
            />
          </div>
          {!full && amt > 0 && amt < due && (
            <p className="mt-1.5 text-[12px] text-amber-700">
              Part payment — {inr(due - amt)} will still be due.
            </p>
          )}
        </div>

        <div>
          <span className="label">Method</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={method === k}
                onClick={() => setMethod(k)}
                className={`rounded-lg px-2 py-2 text-[12.5px] font-semibold ring-1 transition ${
                  method === k ? "ring-2 ring-brand-500 bg-brand-50 text-brand-800" : "ring-border text-slate-600 hover:ring-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="rp-note">Note (optional)</label>
          <input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UPI ref no." className="input" />
        </div>

        {err && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600">
            <Icon name="alert" className="w-3.5 h-3.5" /> {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
