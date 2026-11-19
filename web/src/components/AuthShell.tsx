import { Link } from "react-router-dom";

/* Shared frame for sign-in, owner registration and shop selection:
   brand panel on large screens, a clean single column on phones. */

const FEATURES = [
  { t: "Sales & billing", d: "GST invoices, POS and online orders in one queue", i: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></> },
  { t: "Inventory & purchases", d: "Live stock, low-stock alerts and supplier bills", i: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></> },
  { t: "Customers & khata", d: "Ledgers, dues and a portal for your customers", i: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
];

const CUSTOMER_FEATURES = [
  { t: "Order from your shop", d: "Browse the live catalog and order for delivery or pickup", i: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></> },
  { t: "Track every order", d: "From placed to delivered, with your bills in one place", i: <><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></> },
  { t: "Your khata, always up to date", d: "See dues, payments and statements any time", i: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
];

export default function AuthShell({
  children,
  headline = "Run your whole shop from one place.",
  extra,
  variant = "owner",
}: {
  children: React.ReactNode;
  headline?: string;
  extra?: React.ReactNode;
  variant?: "owner" | "customer";
}) {
  const features = variant === "customer" ? CUSTOMER_FEATURES : FEATURES;
  return (
    <div className="min-h-[100dvh] bg-white text-navy-900 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="hidden lg:flex relative flex-col justify-between overflow-hidden p-10 xl:p-14 bg-white text-navy-900 border-r border-slate-200/80">
        <div aria-hidden className="absolute right-[-7rem] top-[-7rem] h-[26rem] w-[26rem] rounded-full bg-brand-50" />
        <div aria-hidden className="absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full border border-brand-100" />
        <div aria-hidden className="absolute left-[18%] top-[48%] h-px w-[55%] bg-gradient-to-r from-transparent via-brand-200 to-transparent" />

        <Link to="/" className="relative inline-flex items-center gap-3 w-fit">
          <span className="w-11 h-11 rounded-xl bg-white p-1.5 shadow-lg"><img src="./nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
          <span className="text-[19px] font-bold tracking-tight text-navy-900">{variant === "customer" ? "NSYU" : "NSYU Business"}</span>
        </Link>

        <div className="relative max-w-[460px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">{variant === "customer" ? "Customer portal" : "Shop management"}</p>
          <h2 className="mt-3 max-w-[620px] font-serif text-[44px] xl:text-[58px] font-semibold leading-[0.98] tracking-[-0.04em] text-navy-900">{headline}</h2>
          <p className="mt-5 max-w-[500px] text-[15px] leading-relaxed text-slate-600">
            {variant === "customer" ? "Order, track deliveries and check your khata with the shops you buy from." : "Billing, stock, suppliers, customer khata and online orders — on the web and on your phone."}
          </p>
          <ul className="relative mt-9 grid max-w-[620px] grid-cols-2 gap-3">
            {features.map((f) => (
              <li key={f.t} className="flex min-h-[112px] items-start gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_12px_30px_-20px_rgba(16,42,67,0.35)] transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_18px_36px_-20px_rgba(0,132,95,0.28)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.i}</svg>
                </span>
                <span>
                  <span className="block text-[14px] font-semibold leading-tight text-navy-900">{f.t}</span>
                  <span className="block text-[12px] text-slate-500 mt-1 leading-snug">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-[12.5px] text-slate-500">
          <span>© {new Date().getFullYear()} NSYU</span>
          <Link to="/" className="inline-flex items-center gap-1.5 font-semibold text-navy-900 hover:text-brand-700">
            Browse the marketplace
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </div>
      </aside>

      <main className="min-h-[100dvh] flex flex-col bg-white lg:bg-slate-50/60">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
          <Link to="/" className="lg:invisible inline-flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-white p-1 ring-1 ring-slate-200 shadow-xs"><img src="./nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
            <span className="text-[16px] font-bold tracking-tight">{variant === "customer" ? "NSYU" : "NSYU Business"}</span>
          </Link>
          <Link to="/" className="text-[13px] font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 min-h-[40px]">
            Marketplace
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </header>
        <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-8 pb-8 pt-2 sm:pt-0">
          <div className="w-full max-w-[420px]">
            <div className="lg:bg-white lg:rounded-2xl lg:ring-1 lg:ring-slate-200/80 lg:shadow-[0_24px_60px_-28px_rgba(4,38,29,0.25)] lg:p-8">{children}</div>
            {extra}
          </div>
        </div>
      </main>
    </div>
  );
}

export const AUTH_FIELD =
  "w-full h-12 rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
export const AUTH_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white font-semibold shadow-brand transition";
export const AUTH_LABEL = "block text-[13px] font-semibold text-slate-700 mb-1.5";
