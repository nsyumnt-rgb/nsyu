import { useEffect, useState } from "react";
import { getCustomer, setCustomerPassword } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import type { Customer } from "../types";
import { Avatar, Icon, Modal } from "./ui";

/** Mirrors the backend rule in customerController.validateCustomerPassword. */
export function customerPasswordProblem(pw: string): string | null {
  if (!pw) return "Enter a new password";
  if (pw !== pw.trim()) return "Password cannot start or end with a space";
  if (pw.length < 8) return "Use at least 8 characters";
  if (new TextEncoder().encode(pw).length > 72) return "Password is too long (max 72 characters)";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Include at least one letter and one number";
  return null;
}

const inr = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BalanceText({ value, className = "" }: { value: number; className?: string }) {
  const tone = value > 0 ? "text-rose-600" : value < 0 ? "text-emerald-600" : "text-slate-500";
  const tag = value > 0 ? "Due" : value < 0 ? "Advance" : "Settled";
  return (
    <span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span className={`font-bold tabular ${tone}`}>{value < 0 ? "-" : ""}{inr(value)}</span>
      <span className={`text-[10.5px] font-semibold uppercase tracking-wide ${tone} opacity-80`}>{tag}</span>
    </span>
  );
}

export function CustomerStatusBadge({ status }: { status?: string }) {
  return status === "inactive" ? (
    <span className="badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive</span>
  ) : (
    <span className="badge-active"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</span>
  );
}

function Detail({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-[13.5px] text-navy-900 [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, show, onToggle, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          className="input pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          <Icon name={show ? "eyeOff" : "eye"} className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Customer details with an optional "Set password" section for staff who can edit customers.
 * The existing password is never fetched or shown — only a new one can be set.
 */
export default function CustomerViewModal({ customerId, onClose, onOpenLedger }: { customerId: number; onClose: () => void; onOpenLedger?: (id: number) => void }) {
  const { can } = usePermission();
  const canSetPassword = can("customers", "edit");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCustomer(customerId)
      .then((res) => !cancelled && setCustomer(res.data.data ?? null))
      .catch((err) => !cancelled && setLoadError(apiErrorMessage(err, "Could not load customer")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function resetPasswordForm() {
    setPw("");
    setPw2("");
    setShow(false);
    setConfirming(false);
    setPwError(null);
  }

  function requestChange(e: React.FormEvent) {
    e.preventDefault();
    setPwSuccess(null);
    const problem = customerPasswordProblem(pw);
    if (problem) return setPwError(problem);
    if (pw !== pw2) return setPwError("Passwords do not match");
    setPwError(null);
    setConfirming(true);
  }

  async function confirmChange() {
    setSaving(true);
    setPwError(null);
    try {
      const res = await setCustomerPassword(customerId, pw, pw2);
      resetPasswordForm();
      setPwOpen(false);
      setPwSuccess(res.data.message || "Password updated.");
    } catch (err) {
      setConfirming(false);
      setPwError(apiErrorMessage(err, "Could not update the password"));
    } finally {
      setSaving(false);
    }
  }

  const balance = Number(customer?.current_balance ?? 0);
  const createdRaw = customer?.created_at ?? (customer as any)?.createdAt;
  const created = createdRaw ? new Date(createdRaw) : null;

  return (
    <Modal
      size="sm"
      icon="users"
      title="Customer details"
      subtitle={customer?.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          {onOpenLedger && customer && (
            <button type="button" onClick={() => onOpenLedger(customer.id)} className="btn-primary">
              <Icon name="book" /> Open ledger
            </button>
          )}
        </>
      }
    >
      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
          <div className="h-4 w-3/4 rounded bg-slate-100" />
        </div>
      ) : loadError || !customer ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <Icon name="alert" className="w-4 h-4 shrink-0" /> {loadError || "Customer not found"}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={customer.name} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-navy-900 [overflow-wrap:anywhere]">{customer.name}</div>
              {customer.shop_name && <div className="text-[12px] text-slate-500 truncate">{customer.shop_name}</div>}
            </div>
            <CustomerStatusBadge status={customer.status} />
          </div>

          <div className="rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-slate-500">Current balance</span>
            <BalanceText value={balance} className="text-[16px]" />
          </div>

          <div className="divide-y divide-slate-100">
            <Detail icon="phone" label="Mobile">{customer.phone || "—"}</Detail>
            <Detail icon="mail" label="Email">{customer.email || <span className="text-slate-400">Not added</span>}</Detail>
            <Detail icon="mapPin" label="Address">{customer.address || <span className="text-slate-400">Not added</span>}</Detail>
            <Detail icon="calendar" label="Customer since">
              {created ? created.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </Detail>
          </div>

          {pwSuccess && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
              <Icon name="checkCircle" className="w-4 h-4 shrink-0" /> {pwSuccess}
            </div>
          )}

          {canSetPassword && (
            <section className="rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => {
                  setPwOpen((v) => !v);
                  resetPasswordForm();
                  setPwSuccess(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                aria-expanded={pwOpen}
              >
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15 flex items-center justify-center shrink-0">
                  <Icon name="lock" className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-navy-900">Set password</span>
                  <span className="block text-[11.5px] text-slate-500">Set or reset the customer&apos;s portal sign-in password</span>
                </span>
                <Icon name={pwOpen ? "x" : "right"} className="w-4 h-4 text-slate-400" />
              </button>

              {pwOpen && (
                <form onSubmit={requestChange} className="px-4 pb-4 space-y-3.5 border-t border-slate-100 pt-3.5" noValidate>
                  <PasswordField id="cust-new-pw" label="New password" value={pw} onChange={(v) => { setPw(v); setConfirming(false); }} show={show} onToggle={() => setShow((v) => !v)} autoFocus />
                  <PasswordField id="cust-confirm-pw" label="Confirm password" value={pw2} onChange={(v) => { setPw2(v); setConfirming(false); }} show={show} onToggle={() => setShow((v) => !v)} />
                  <p className="text-[11.5px] text-slate-500">At least 8 characters, with a letter and a number. The current password is never shown.</p>

                  {pwError && (
                    <p role="alert" className="flex items-center gap-1.5 text-[12.5px] text-rose-600">
                      <Icon name="alert" className="w-3.5 h-3.5 shrink-0" /> {pwError}
                    </p>
                  )}

                  {confirming ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2.5">
                      <p className="text-[12.5px] text-amber-900">
                        Change the portal password for <b>{customer.name}</b>? They will be signed out of the portal on all devices.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={confirmChange} disabled={saving} className="btn-primary btn-sm">
                          {saving ? "Saving…" : "Yes, change password"}
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="btn-secondary btn-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="submit" className="btn-primary w-full sm:w-auto">
                      <Icon name="lock" /> Set password
                    </button>
                  )}
                </form>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
