import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import BusinessFooter from "../layouts/BusinessFooter";

export default function AuthShell({
  children,
  extra,
}: {
  children: ReactNode;
  headline?: string;
  extra?: ReactNode;
  variant?: "owner" | "customer";
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB]">
      {/* 1. Top Auth Header Banner */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-2xs">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#064E3B] to-[#047857] text-white flex items-center justify-center font-black text-lg shadow-xs">
            N
          </div>
          <div>
            <div className="text-xl font-black text-navy-950 tracking-tight leading-none">
              NSYU<span className="text-emerald-700">.</span>
            </div>
            <div className="text-[10px] font-bold text-gray-500 tracking-wider uppercase leading-none mt-0.5">
              Commerce
            </div>
          </div>
        </Link>
        <Link to="/" className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1">
          ← Marketplace
        </Link>
      </header>

      {/* 2. Main Centered Workspace with Login Popup / Card in the Center */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 md:py-16 bg-gradient-to-b from-emerald-50/40 via-white to-gray-50/60">
        <div className="w-full max-w-[450px]">
          {/* Centered Popup / Card with Premium Styling */}
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl p-6 sm:p-8 relative backdrop-blur-sm animate-fadeIn">
            {children}
          </div>
          {extra && <div className="mt-4">{extra}</div>}
        </div>
      </main>

      {/* 3. Website Footer at Bottom */}
      <BusinessFooter />
    </div>
  );
}

export const AUTH_FIELD =
  "w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-gray-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15";
export const AUTH_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#047857] hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white font-bold shadow-sm transition";
export const AUTH_LABEL = "block text-xs font-bold text-gray-700 mb-1.5";
