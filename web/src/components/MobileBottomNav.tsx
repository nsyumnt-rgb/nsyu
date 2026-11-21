import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { usePortalStore } from "../store/portalStore";
import { usePosStore } from "../store/posStore";

interface MobileBottomNavProps {
  mode: "dashboard" | "portal" | "market";
}

export default function MobileBottomNav({ mode }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Stores
  const accountType = useAuthStore((s) => s.accountType);
  const isOwner = accountType === "owner" || (useAuthStore.getState().owner !== null);
  const portalCart = usePortalStore((s) => s.cart);
  const posCartItems = usePosStore((s) => s.items);

  // Close more drawer on location change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const posCount = posCartItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const portalCount = portalCart?.itemCount || 0;

  // 1. Dashboard Navigation Items (for Owner & Staff)
  const dashboardItems = [
    {
      to: "/app",
      label: "Home",
      exact: true,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "1" : "2"}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      to: "/app/billing",
      label: "POS Bill",
      icon: (active: boolean) => (
        <div className="relative">
          <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {posCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-emerald-700 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
              {posCount > 9 ? "9+" : posCount}
            </span>
          )}
        </div>
      ),
    },
    {
      to: "/app/inventory",
      label: "Inventory",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      to: "/app/orders",
      label: "Orders",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
  ];

  // 2. Customer Portal Navigation Items
  const portalItems = [
    {
      to: "/portal",
      label: "Home",
      exact: true,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "1" : "2"}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      ),
    },
    {
      to: "/portal/store",
      label: "Catalog",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      to: "/portal/cart",
      label: "Cart",
      icon: (active: boolean) => (
        <div className="relative">
          <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {portalCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-emerald-700 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
              {portalCount > 9 ? "9+" : portalCount}
            </span>
          )}
        </div>
      ),
    },
    {
      to: "/portal/orders",
      label: "My Orders",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
        </svg>
      ),
    },
    {
      to: "/portal/profile",
      label: "Account",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  // 3. Marketplace Navigation Items
  const marketItems = [
    {
      to: "/",
      label: "Home",
      exact: true,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "1" : "2"}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      ),
    },
    {
      to: "/market/search",
      label: "Search",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      to: "/market/cart",
      label: "Cart",
      icon: (active: boolean) => (
        <div className="relative">
          <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
      ),
    },
    {
      to: "/market/shops",
      label: "Shops",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9" />
          <path d="M5 13v8h14v-8" />
        </svg>
      ),
    },
    {
      to: "/login",
      label: "Sign In",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-emerald-800 scale-110" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      ),
    },
  ];

  const currentItems =
    mode === "portal" ? portalItems : mode === "market" ? marketItems : dashboardItems;

  return (
    <>
      {/* ── Fixed Native App Bottom Navigation ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden">
        <div className="flex items-center justify-around h-[62px] px-1 pb-safe">
          {currentItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`mobile-nav-btn flex-1 ${isActive ? "active" : ""}`}
              >
                <div className="mb-0.5">{item.icon(isActive)}</div>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            );
          })}

          {/* More Button (Only on Dashboard mode) */}
          {mode === "dashboard" && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`mobile-nav-btn flex-1 ${moreOpen ? "active" : ""}`}
            >
              <div className="mb-0.5">
                <svg className={`w-5 h-5 transition-transform ${moreOpen ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </div>
              <span className="truncate">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Native Mobile "More" Drawer / Action Bottom Sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMoreOpen(false)}
          />

          {/* Slide-Up Sheet */}
          <div className="mobile-sheet max-h-[85vh]">
            {/* Sheet Handle */}
            <div className="sticky top-0 bg-white pt-3 pb-2 px-6 flex flex-col items-center border-b border-slate-100 z-10">
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3" />
              <div className="flex items-center justify-between w-full">
                <div>
                  <h3 className="text-base font-bold text-navy-900">All Modules & Tools</h3>
                  <p className="text-xs text-slate-500">Quick access to all shop operations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Grid of Action Links */}
            <div className="p-4 grid grid-cols-2 gap-3">
              {/* Products */}
              <button
                type="button"
                onClick={() => { navigate("/app/products"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Products</div>
                  <div className="text-[11px] text-slate-500 truncate">Master catalog</div>
                </div>
              </button>

              {/* Customers */}
              <button
                type="button"
                onClick={() => { navigate("/app/customers"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Customers</div>
                  <div className="text-[11px] text-slate-500 truncate">Clients & balances</div>
                </div>
              </button>

              {/* Customer Ledger */}
              <button
                type="button"
                onClick={() => { navigate("/app/ledger"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Ledger (Khata)</div>
                  <div className="text-[11px] text-slate-500 truncate">Debits & credits</div>
                </div>
              </button>

              {/* Sales Invoices */}
              <button
                type="button"
                onClick={() => { navigate("/app/sales"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Invoices</div>
                  <div className="text-[11px] text-slate-500 truncate">Bill history & PDFs</div>
                </div>
              </button>

              {/* Categories */}
              <button
                type="button"
                onClick={() => { navigate("/app/categories"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Categories</div>
                  <div className="text-[11px] text-slate-500 truncate">Catalog groups</div>
                </div>
              </button>

              {/* POS Cart */}
              <button
                type="button"
                onClick={() => { navigate("/app/cart"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">POS Cart</div>
                  <div className="text-[11px] text-slate-500 truncate">{posCount} items pending</div>
                </div>
              </button>

              {/* Shop Settings */}
              <button
                type="button"
                onClick={() => { navigate("/app/settings"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Shop Settings</div>
                  <div className="text-[11px] text-slate-500 truncate">Store profile & taxes</div>
                </div>
              </button>

              {/* My Shops (Owner only) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => { navigate("/app/shops"); setMoreOpen(false); }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 active:bg-emerald-50 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-800 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l1.5-5h15L21 9" />
                      <path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9" />
                      <path d="M5 13v8h14v-8" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold text-navy-900 leading-snug">My Shops</div>
                    <div className="text-[11px] text-slate-500 truncate">Branch management</div>
                  </div>
                </button>
              )}
            </div>

            {/* Quick App Info & Close */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-600">NSYU Business v1.0.17</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-emerald-700 font-bold hover:underline"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
