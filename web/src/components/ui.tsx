import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   Shared page kit used by Dashboard, Products, Inventory, Sales.
   Pure presentation — no data fetching here.
   ───────────────────────────────────────────────────────────── */

const PATHS: Record<string, ReactNode> = {
  box: (<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>),
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: (<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  alert: (<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
  archive: (<><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>),
  rupee: <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10" />,
  cart: (<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></>),
  trend: (<><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>),
  upload: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>),
  trash: (<><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>),
  wallet: (<><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  refresh: (<><path d="M1 4v6h6" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></>),
  layers: (<><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>),
  truck: (<><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>),
  receipt: (<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><path d="M16 8H8M16 12H8M13 16H8" /></>),
  terminal: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 9h12M6 13h6" /></>),
  sliders: (<><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>),
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  ban: (<><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></>),
  card: (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  globe: (<><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>),
  store: (<><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  eyeOff: (<><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></>),
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>),
  mapPin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  book: (<><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h8M8 11h6" /></>),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "w-4 h-4", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/* ── Tones ─────────────────────────────────────────────────── */

export type Tone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

export const TONE: Record<Tone, { tile: string; text: string; bar: string; soft: string }> = {
  brand: { tile: "bg-brand-50 text-brand-600 ring-brand-600/10", text: "text-brand-700", bar: "bg-brand-500", soft: "bg-brand-50" },
  emerald: { tile: "bg-emerald-50 text-emerald-600 ring-emerald-600/10", text: "text-emerald-600", bar: "bg-emerald-500", soft: "bg-emerald-50" },
  amber: { tile: "bg-amber-50 text-amber-600 ring-amber-600/15", text: "text-amber-600", bar: "bg-amber-400", soft: "bg-amber-50" },
  rose: { tile: "bg-rose-50 text-rose-600 ring-rose-600/10", text: "text-rose-600", bar: "bg-rose-500", soft: "bg-rose-50" },
  sky: { tile: "bg-sky-50 text-sky-600 ring-sky-600/10", text: "text-sky-600", bar: "bg-sky-500", soft: "bg-sky-50" },
  violet: { tile: "bg-violet-50 text-violet-600 ring-violet-600/10", text: "text-violet-600", bar: "bg-violet-500", soft: "bg-violet-50" },
  slate: { tile: "bg-slate-100 text-slate-600 ring-slate-500/10", text: "text-slate-700", bar: "bg-slate-400", soft: "bg-slate-50" },
};

/* ── Page header ───────────────────────────────────────────── */

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <div className="section-label mb-1.5 text-brand-700/80">{eyebrow}</div>}
        <h1 className="text-[22px] sm:text-[28px] font-extrabold text-navy-900 tracking-tight leading-[1.15] break-words">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 [&>*]:max-w-full">{actions}</div>}
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────── */

export function StatCard({
  label, value, icon, tone = "brand", hint, footer, loading, onClick, to, active, valueClass,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone?: Tone;
  hint?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  to?: string;
  active?: boolean;
  valueClass?: string;
}) {
  const t = TONE[tone];
  const interactive = Boolean(onClick || to);
  const cls = `group relative overflow-hidden text-left w-full min-w-0 bg-white border rounded-card shadow-card p-4 sm:p-5 transition-all duration-300 ease-smooth ${
    active ? "border-brand-400 ring-4 ring-brand-500/10" : "border-border/90"
  } ${interactive ? "hover:shadow-lift hover:-translate-y-0.5 hover:border-brand-200 cursor-pointer" : ""}`;
  const body = (
    <>
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.bar} opacity-80`} />
      <span className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${t.soft} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-500 truncate">{label}</div>
          <div className={`mt-2.5 text-[20px] sm:text-[26px] font-extrabold tracking-tight tabular leading-none truncate ${valueClass || "text-navy-900"} ${loading ? "opacity-40 animate-pulse" : ""}`}>
            {value}
          </div>
        </div>
        <span className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${t.tile}`}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </span>
      </div>
      {(hint || footer) && <div className="mt-3 text-[12px] font-medium text-slate-500 truncate">{hint}{footer}</div>}
    </>
  );
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** Small ▲/▼ percentage pill. */
export function DeltaPill({ cur, prev, hasPrev = true }: { cur: number; prev: number; hasPrev?: boolean }) {
  if (!hasPrev) return <span className="text-slate-400">All time</span>;
  if (prev === 0) return <span className="text-slate-400">{cur === 0 ? "No change vs previous" : "New this period"}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
        <Icon name={up ? "arrowUp" : "arrowDown"} className="w-3 h-3" strokeWidth={2.6} />
        {Math.abs(pct)}%
      </span>
      <span className="text-slate-400 font-normal">vs previous</span>
    </span>
  );
}

/* ── Segmented tabs ────────────────────────────────────────── */

export function Segmented<K extends string>({
  options, value, onChange, size = "md",
}: { options: { key: K; label: string; count?: number; tone?: Tone }[]; value: K; onChange: (k: K) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex max-w-full p-1 rounded-xl bg-slate-100/90 ring-1 ring-inset ring-slate-200/60 overflow-x-auto no-scrollbar">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12.5px]"} ${
              on ? "bg-white text-navy-900 shadow-soft ring-1 ring-slate-200/70" : "text-slate-500 hover:text-navy-900 hover:bg-white/60"
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`min-w-[20px] px-1.5 rounded-full text-[10.5px] font-bold tabular ${on ? (o.tone ? `${TONE[o.tone].soft} ${TONE[o.tone].text}` : "bg-brand-50 text-brand-700") : "bg-white/70 text-slate-500"}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Search input ──────────────────────────────────────────── */

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
        <Icon name="search" />
      </span>
      <input className="input pl-9 pr-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700" aria-label="Clear search">
          <Icon name="x" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────── */

export function EmptyState({ icon = "box", title, text, action, tone = "slate", compact }: { icon?: IconName; title: string; text?: ReactNode; action?: ReactNode; tone?: Tone; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center px-6 ${compact ? "py-8" : "py-14"}`}>
      <span className="relative">
        <span className={`absolute inset-0 -m-2 rounded-3xl opacity-60 blur-md ${TONE[tone].soft}`} aria-hidden />
        <span className={`relative w-14 h-14 rounded-2xl ring-1 ring-inset flex items-center justify-center bg-white ${TONE[tone].tile}`}>
          <Icon name={icon} className="w-6 h-6" />
        </span>
      </span>
      <div className="mt-4 text-[15px] font-bold text-navy-900">{title}</div>
      {text && <div className="mt-1 text-[12.5px] text-slate-500 max-w-sm">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────────── */

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export function Pagination({ page, pages, total, pageSize, onPage, noun = "items", left }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; noun?: string; left?: ReactNode }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/40 text-[12.5px] text-slate-500">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {left}
        <span>
          Showing <b className="text-navy-900 tabular">{from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")}</b> of <b className="text-navy-900 tabular">{total.toLocaleString("en-IN")}</b> {noun}
        </span>
      </div>
      {pages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:hover:bg-white" aria-label="Previous page">
            <Icon name="left" className="w-3.5 h-3.5" />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="w-6 text-center text-slate-400">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-[12.5px] font-semibold tabular transition ${p === page ? "bg-brand-600 text-white shadow-brand" : "border border-border bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {p}
              </button>
            )
          )}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:hover:bg-white" aria-label="Next page">
            <Icon name="right" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Avatar (initials) ─────────────────────────────────────── */

const AVATAR_TONES = ["bg-brand-100 text-brand-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const parts = (name || "?").trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={`${size === "sm" ? "w-7 h-7 text-[10.5px]" : "w-9 h-9 text-[12px]"} rounded-full font-bold flex items-center justify-center shrink-0 ${AVATAR_TONES[h % AVATAR_TONES.length]}`}>
      {initials}
    </span>
  );
}

/* ── Modal shell ───────────────────────────────────────────── */

export function Modal({ title, subtitle, icon, onClose, children, footer, size = "md" }: { title: ReactNode; subtitle?: ReactNode; icon?: IconName; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const w = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-2xl";
  return (
    <div className="fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`bg-white w-full ${w} rounded-t-4xl sm:rounded-2xl shadow-pop ring-1 ring-black/5 max-h-[92dvh] flex flex-col animate-slide-up sm:animate-scale-in`}>
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto my-2.5 shrink-0" />
        <div className="flex items-start gap-3 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
          {icon && (
            <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center shrink-0">
              <Icon name={icon} className="w-[18px] h-[18px]" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] sm:text-[17px] font-bold text-navy-900 truncate">{title}</h2>
            {subtitle && <p className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 -mr-1 rounded-xl flex items-center justify-center text-slate-400 transition duration-200 hover:bg-slate-100 hover:text-slate-700 hover:rotate-90" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto overscroll-contain min-h-0">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-3.5 pb-safe sm:pb-3.5 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Meter bar ─────────────────────────────────────────────── */

export function Meter({ value, max, tone = "brand", className = "" }: { value: number; max: number; tone?: Tone; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${TONE[tone].bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Icon button (row actions) ─────────────────────────────── */

export function IconButton({ title, icon, onClick, to, tone }: { title: string; icon: IconName; onClick?: () => void; to?: string; tone?: "brand" | "rose" }) {
  const cls = `w-8 h-8 rounded-lg flex items-center justify-center transition ${
    tone === "rose" ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : tone === "brand" ? "text-brand-600 hover:bg-brand-50" : "text-slate-500 hover:bg-slate-100 hover:text-navy-900"
  }`;
  if (to)
    return (
      <Link to={to} title={title} aria-label={title} className={cls}>
        <Icon name={icon} className="w-4 h-4" />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cls}>
      <Icon name={icon} className="w-4 h-4" />
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-600 cursor-pointer select-none">
      <span className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-brand-600" : "bg-slate-300"}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ease-smooth ${checked ? "translate-x-4" : ""}`} />
      </span>
      {label}
    </label>
  );
}

/** Pill-style choice buttons (payment method etc.). */
export function ChoiceGroup<K extends string>({ value, onChange, options, cols = 4 }: { value: K; onChange: (k: K) => void; options: [K, string][]; cols?: 2 | 3 | 4 | 5 }) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-3 sm:grid-cols-5" }[cols];
  return (
    <div className={`grid ${grid} gap-2`}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-xl px-3 py-2.5 text-[12.5px] font-semibold ring-1 transition-all duration-200 active:scale-[0.97] ${value === k ? "ring-2 ring-brand-500 bg-brand-50 text-brand-800 shadow-xs" : "ring-border bg-white text-slate-600 hover:ring-slate-300 hover:bg-slate-50"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Toast({ text, ok = true }: { text: string; ok?: boolean }) {
  return (
    <div role="status" className={`fixed bottom-24 md:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-pop ring-1 ring-white/10 text-[13px] font-medium animate-fade-up ${ok ? "bg-navy-900 text-white" : "bg-rose-600 text-white"}`}>
      <Icon name={ok ? "checkCircle" : "alert"} className="w-4 h-4 shrink-0" />
      {text}
    </div>
  );
}
