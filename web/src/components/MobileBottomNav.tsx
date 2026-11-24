import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { usePosStore } from "../store/posStore";
import { FEATURES } from "../config/features";

interface MobileBottomNavProps {
  mode: "dashboard" | "portal" | "market";
}

export default function MobileBottomNav({ mode }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Stores
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
      to: "/app/products",
      label: "Products",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
    },
    {
      to: "/app/customers",
      label: "Customers",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 transition-transform ${active ? "scale-110 text-emerald-800" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl border-t border-border/80 shadow-[0_-10px_30px_-18px_rgba(15,42,35,0.35)] md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-[64px] px-1.5 py-1.5">
          {currentItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`mobile-nav-btn flex-1 ${isActive ? "active" : ""}`}
              >
                <span className={`mb-0.5 flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300 ease-smooth ${isActive ? "bg-brand-50 ring-1 ring-inset ring-brand-600/10" : ""}`}>
                  {item.icon(isActive)}
                </span>
                <span className="truncate max-w-[64px] leading-tight">{item.label}</span>
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
              <div className={`mb-0.5 flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300 ${moreOpen ? "bg-brand-50" : ""}`}>
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
            className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm transition-opacity"
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
              {/* Sales invoices */}
              <button
                type="button"
                onClick={() => { navigate("/app/sales"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Sales invoices</div>
                  <div className="text-[11px] text-slate-500 truncate">Bill history & PDFs</div>
                </div>
              </button>

              {/* Messages (WhatsApp + Email) */}
              <button
                type="button"
                onClick={() => { navigate("/app/messaging"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Messages</div>
                  <div className="text-[11px] text-slate-500 truncate">WhatsApp & email</div>
                </div>
              </button>

              {/* Settings › Inventory */}
              <button
                type="button"
                onClick={() => { navigate("/app/settings/inventory"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Inventory</div>
                  <div className="text-[11px] text-slate-500 truncate">Stock in/out & alerts</div>
                </div>
              </button>

              {/* Settings › Shop profile */}
              <button
                type="button"
                onClick={() => { navigate("/app/settings/shop"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l1.5-5h15L21 9" />
                    <path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9" />
                    <path d="M5 13v8h14v-8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Shop profile</div>
                  <div className="text-[11px] text-slate-500 truncate">Shops, banner & details</div>
                </div>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => { navigate("/app/settings"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Settings</div>
                  <div className="text-[11px] text-slate-500 truncate">Preferences, tax & more</div>
                </div>
              </button>

              {/* Orders: only when the menu flag is on */}
              {FEATURES.showOrdersMenu && (
              <button
                type="button"
                onClick={() => { navigate("/app/orders"); setMoreOpen(false); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border shadow-xs active:scale-[0.98] active:bg-brand-50 hover:border-brand-200 text-left transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-navy-900 leading-snug">Orders</div>
                  <div className="text-[11px] text-slate-500 truncate">Online orders</div>
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
