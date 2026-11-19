import type { ReactNode } from "react";
import BusinessHeader from "../layouts/BusinessHeader";
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
      {/* 1. Website Header at Top */}
      <BusinessHeader />

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
