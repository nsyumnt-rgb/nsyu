import { useEffect, useState } from "react";
import type { Sale } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI PARTICLES COMPONENT (SVG-BASED)
// ─────────────────────────────────────────────────────────────────────────────
function ConfettiExplosion() {
  const particles = [
    { x: -45, y: -40, color: "#3B82F6", size: 6, shape: "circle" },
    { x: 42, y: -38, color: "#EF4444", size: 7, shape: "rect" },
    { x: -55, y: -10, color: "#F59E0B", size: 5, shape: "circle" },
    { x: 50, y: -12, color: "#10B981", size: 6, shape: "rect" },
    { x: -35, y: -52, color: "#8B5CF6", size: 5, shape: "star" },
    { x: 30, y: -55, color: "#EC4899", size: 6, shape: "circle" },
    { x: -20, y: -60, color: "#10B981", size: 7, shape: "rect" },
    { x: 18, y: -58, color: "#3B82F6", size: 5, shape: "star" },
    { x: -50, y: 22, color: "#F59E0B", size: 6, shape: "circle" },
    { x: 48, y: 25, color: "#8B5CF6", size: 5, shape: "rect" },
    { x: -30, y: 40, color: "#EC4899", size: 6, shape: "circle" },
    { x: 32, y: 38, color: "#10B981", size: 5, shape: "star" },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            transform: `translate(${p.x}px, ${p.y}px)`,
            borderRadius: p.shape === "circle" ? "50%" : p.shape === "rect" ? "2px" : "30%",
            boxShadow: `0 0 6px ${p.color}88`,
            animation: `fadeIn 0.4s ease-out`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUCCESS CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
export interface SuccessModalProps {
  sale: Sale;
  onClose: () => void;
  onViewBill: () => void;
  onDownloadPdf?: () => void;
}

export function SuccessModal({ sale, onClose, onViewBill, onDownloadPdf }: SuccessModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
        {/* Top Right Close 'x' */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Animated Checkmark + Confetti */}
        <div className="flex flex-col items-center text-center relative pt-2">
          <div className="relative flex items-center justify-center mb-3">
            <ConfettiExplosion />
            <div className="w-20 h-20 rounded-full bg-emerald-100 animate-pulse-glow absolute" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 relative z-10">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Bill Saved Successfully!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Invoice <span className="font-mono font-bold text-slate-800">#{sale.invoice_number}</span> has been created and verified in Supabase.
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold text-slate-800">{sale.customer?.name || "Walk-in Customer"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Total Amount:</span>
            <span className="font-mono font-bold text-slate-900">₹{sale.total_amount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Amount Paid:</span>
            <span className="font-mono font-bold text-emerald-600">₹{sale.paid_amount}</span>
          </div>
          {Number(sale.due_amount) > 0 && (
            <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 text-rose-600 font-bold">
              <span>Balance Due:</span>
              <span className="font-mono">₹{sale.due_amount}</span>
            </div>
          )}
        </div>

        {/* Buttons matching Reference Design */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onViewBill}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>View Bill</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {onDownloadPdf && (
              <button
                type="button"
                onClick={onDownloadPdf}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Print / PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                !onDownloadPdf ? "col-span-2" : ""
              }`}
            >
              <span>Continue Billing</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FAILURE MODAL (RED X WITH VIBRATION WAVES & RETRY)
// ─────────────────────────────────────────────────────────────────────────────
export interface FailureModalProps {
  reason: string;
  onRetry: () => void;
  onClose: () => void;
}

export function FailureModal({ reason, onRetry, onClose }: FailureModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
        {/* Top Right Close 'x' */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Animated Red X with Vibration Soundwaves */}
        <div className="flex flex-col items-center text-center relative pt-2">
          <div className="relative flex items-center justify-center mb-3 animate-shake">
            {/* Left and Right Vibration Arcs */}
            <svg className="absolute -left-7 w-6 h-12 text-rose-500 opacity-70" viewBox="0 0 24 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6 A 20 20 0 0 0 18 42" />
              <path d="M10 12 A 14 14 0 0 0 10 36" opacity="0.5" />
            </svg>
            <svg className="absolute -right-7 w-6 h-12 text-rose-500 opacity-70" viewBox="0 0 24 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6 A 20 20 0 0 1 6 42" />
              <path d="M14 12 A 14 14 0 0 1 14 36" opacity="0.5" />
            </svg>

            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/35 z-10">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Failed to Save Bill</h3>
          <p className="text-xs text-slate-500 mt-1">Unable to save bill. Please try again.</p>
        </div>

        {/* Reason Box */}
        <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs flex items-start gap-2.5">
          <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="text-rose-800 font-medium">
            <span className="font-bold">Reason:</span> {reason}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VALIDATION WARNING MODAL (AMBER WITH BULLET POINTS)
// ─────────────────────────────────────────────────────────────────────────────
export interface ValidationModalProps {
  errors: string[];
  onClose: () => void;
}

export function ValidationModal({ errors, onClose }: ValidationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
        {/* Top Right Close 'x' */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Amber Triangle Icon */}
        <div className="flex flex-col items-center text-center relative pt-2">
          <div className="relative flex items-center justify-center mb-3">
            <div className="w-20 h-20 rounded-full bg-amber-100 animate-pulse-glow absolute" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/35 relative z-10">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Validation Error</h3>
          <p className="text-xs text-slate-500 mt-1">Please check the highlighted fields.</p>
        </div>

        {/* Bullet List Box */}
        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80 space-y-2 text-xs">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-amber-900">
              <span className="font-bold text-amber-600 mt-0.5">•</span>
              <span className="font-medium">{err}</span>
            </div>
          ))}
        </div>

        {/* OK Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/25 transition-all cursor-pointer"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SAVING BILL PROGRESS MODAL (SPINNER + STEP CHECKLIST + 70% PROGRESS)
// ─────────────────────────────────────────────────────────────────────────────
export interface SavingProgressModalProps {
  currentStep?: number;
}

export function SavingProgressModal({ currentStep = 3 }: SavingProgressModalProps) {
  const [step, setStep] = useState(currentStep);

  const steps = [
    "Validating items…",
    "Calculating totals…",
    "Updating stock…",
    "Saving invoice…",
    "Finalizing…",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s < 4 ? s + 1 : s));
    }, 450);
    return () => clearInterval(timer);
  }, []);

  const progress = Math.min(100, Math.round(((step + 1) / steps.length) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-5 animate-scale-up">
        {/* Animated Circular Spinner */}
        <div className="relative flex items-center justify-center pt-2">
          <div className="w-18 h-18 rounded-full border-4 border-slate-100 border-t-blue-600 border-r-blue-400 animate-spin" />
          <svg className="w-8 h-8 text-blue-600 absolute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>

        <div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Saving Bill…</h3>
          <p className="text-xs text-slate-500 mt-1">Please wait, we are processing your request.</p>
        </div>

        {/* Step checklist */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs text-left">
          {steps.map((st, i) => {
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <div key={i} className="flex items-center gap-2.5">
                {isDone ? (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                )}
                <span
                  className={
                    isDone
                      ? "text-emerald-700 font-semibold"
                      : isCurrent
                      ? "text-slate-900 font-bold"
                      : "text-slate-400"
                  }
                >
                  {st}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar + Percentage */}
        <div className="space-y-1">
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[11px] font-mono font-bold text-blue-700 text-right">{progress}%</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TOAST NOTIFICATIONS (AUTO HIDE)
// ─────────────────────────────────────────────────────────────────────────────
export interface ToastProps {
  type: "success" | "error" | "warning" | "info";
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function ToastNotification({ type, title, subtitle, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: {
      bg: "bg-emerald-600 text-white shadow-emerald-600/25",
      icon: (
        <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    error: {
      bg: "bg-rose-600 text-white shadow-rose-600/25",
      icon: (
        <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
    },
    warning: {
      bg: "bg-amber-500 text-white shadow-amber-500/25",
      icon: (
        <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    info: {
      bg: "bg-blue-600 text-white shadow-blue-600/25",
      icon: (
        <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-scale-up max-w-sm w-full">
      <div className={`p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 relative overflow-hidden ${config.bg}`}>
        <div className="flex items-center gap-3">
          {config.icon}
          <div>
            <div className="font-bold text-xs">{title}</div>
            {subtitle && <div className="text-[11px] opacity-90 font-mono mt-0.5">{subtitle}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-black/10 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {/* Countdown line */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-toast-countdown" />
      </div>
    </div>
  );
}
