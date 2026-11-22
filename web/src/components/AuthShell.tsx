import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const FEATURES = {
  owner: [
    { title: "Fast POS billing", text: "Scan, bill and print GST invoices at the counter.", d: "M13 2L4 14h7l-1 8 9-12h-7z" },
    { title: "Customer khata", text: "Dues, payments and statements for every customer.", d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" },
    { title: "Live inventory", text: "Stock levels and low-stock alerts across your shops.", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  ],
  customer: [
    { title: "Order online", text: "Browse your shop's catalogue and place orders.", d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
    { title: "Your bills", text: "Every invoice from the shop, ready to download.", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" },
    { title: "Khata ledger", text: "See what you owe and every payment you've made.", d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" },
  ],
} as const;

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="NSYU home">
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-[17px] ${
          inverted ? "bg-white text-[#064E3B]" : "bg-[#064E3B] text-white"
        }`}
      >
        N
      </span>
      <span className="leading-none">
        <span className={`block text-[19px] font-extrabold tracking-tight ${inverted ? "text-white" : "text-navy-950"}`}>
          NSYU<span className={inverted ? "text-emerald-300" : "text-emerald-600"}>.</span>
        </span>
        <span className={`block mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase ${inverted ? "text-emerald-200/80" : "text-slate-500"}`}>
          Business
        </span>
      </span>
    </Link>
  );
}

/**
 * Sign-in / sign-up frame: a brand panel on the left (desktop) and the form on
 * the right. On phones only the form column is shown.
 */
export default function AuthShell({
  children,
  headline,
  extra,
  variant = "owner",
}: {
  children: ReactNode;
  headline?: string;
  extra?: ReactNode;
  variant?: "owner" | "customer";
}) {
  const features = FEATURES[variant];
  const title =
    headline ||
    (variant === "customer" ? "Your orders, bills and khata — all in one place." : "Billing, stock and khata for your shop — in one place.");

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-white">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#053B2E] text-white px-12 py-10 xl:px-16 xl:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 w-[480px] h-[480px] rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative max-w-[460px]">
          <h2 className="text-[34px] xl:text-[40px] font-bold leading-[1.12] tracking-[-0.02em] text-white">{title}</h2>
          <ul className="mt-10 space-y-6">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.d} />
                  </svg>
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{f.title}</span>
                  <span className="block mt-0.5 text-[13.5px] text-emerald-100/75 leading-relaxed">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[12.5px] text-emerald-100/70">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secure sign-in · Each shop's data is kept separate
        </div>
      </aside>

      {/* Form column */}
      <div className="flex min-h-screen flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 px-5 sm:px-10 py-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-navy-900 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Marketplace
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-5 sm:px-10 py-6 sm:py-10">
          <div className="w-full max-w-[420px] animate-fadeIn">
            {children}
            {extra && <div className="mt-6">{extra}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export const AUTH_FIELD =
  "w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[14px] text-gray-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15";
export const AUTH_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#047857] hover:bg-[#065F46] active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white font-semibold shadow-sm transition";
export const AUTH_LABEL = "block text-[13px] font-semibold text-slate-700 mb-1.5";
