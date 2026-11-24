import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { logout as logoutApi } from "../api/auth";
import { FEATURES } from "../config/features";
import type { ModuleName } from "../types";

export interface NavItem {
  to: string;
  label: string;
  module: ModuleName;
  icon: (active: boolean) => ReactNode;
  hidden?: boolean;
}

/** Stroke icon from one or more SVG path strings. */
const ico = (...paths: string[]) => (active: boolean) => (
  <svg
    className={clsx("w-[18px] h-[18px] shrink-0 transition-all duration-200", active ? "text-brand-700" : "text-slate-400 group-hover:text-navy-900 group-hover:scale-110")}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

/**
 * Main menu. Everything else lives inside these pages:
 * - Products → Products | Categories tabs
 * - Customers → Details | Ledger tabs
 * - POS Billing → the cart opens as a right-side panel
 * - Settings (below the menu) → Shop profile, Inventory, Preferences, …
 */
const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", module: "dashboard", icon: ico("M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z") },
  { to: "/app/billing", label: "POS Billing", module: "billing", icon: ico("M13 2L4 14h7l-1 8 9-12h-7z") },
  { to: "/app/sales", label: "Sales invoices", module: "sales", icon: ico("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8") },
  { to: "/app/products", label: "Products", module: "products", icon: ico("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01") },
  { to: "/app/customers", label: "Customers", module: "customers", icon: ico("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75") },
  { to: "/app/messaging", label: "Messages", module: "customers", icon: ico("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M8 9h8", "M8 13h5") },
  {
    to: "/app/orders",
    label: "Orders",
    module: "orders",
    hidden: !FEATURES.showOrdersMenu,
    icon: ico("M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"),
  },
];

const SETTINGS_ITEM: NavItem = {
  to: "/app/settings",
  label: "Settings",
  module: "settings",
  icon: ico(
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  ),
};

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/app"}
      className={({ isActive }) =>
        clsx("group nav-link", isActive && "nav-link-active")
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" aria-hidden />}
          <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors", isActive ? "bg-white shadow-xs ring-1 ring-brand-600/10" : "bg-transparent group-hover:bg-white")}>
            {item.icon(isActive)}
          </span>
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  /** Mobile drawer visibility */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Close the mobile drawer after navigating. Only the path is a dependency:
  // the parent passes a new onClose on every render, which would otherwise
  // close the drawer the moment it opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    onCloseRef.current?.();
  }, [location.pathname]);

  const accountType = useAuthStore((s) => s.accountType);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const roleName = useAuthStore((s) => s.roleName);
  const activeShop = useAuthStore((s) => s.activeShop);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);

  const userName = accountType === "owner" ? owner?.name || "Store Owner" : employee?.name || "Staff";
  const userRole = accountType === "owner" ? "Store Owner" : roleName || "Staff Member";

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {}
    }
    storeLogout();
    navigate("/login");
  }

  const items = NAV_ITEMS.filter((i) => !i.hidden);

  const navList = (
    <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
      <div className="hidden lg:flex items-center gap-2.5 mb-4 p-2.5 rounded-xl bg-gradient-to-br from-brand-50 to-white ring-1 ring-inset ring-brand-600/10">
        <span className="w-9 h-9 rounded-lg bg-brand-gradient text-white flex items-center justify-center font-extrabold text-[13px] shadow-brand shrink-0">
          {(activeShop?.name || "N").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-navy-900 truncate">{activeShop?.name || "NSYU Store"}</div>
          <div className="text-[10.5px] text-slate-500 font-mono truncate">{activeShop?.code || "NSYU-01"}</div>
        </div>
      </div>
      <div className="px-3 pb-2 section-label">Menu</div>
      <div className="space-y-1">
        {items.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </div>
      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="px-3 pb-2 section-label">Account</div>
        <NavItemLink item={SETTINGS_ITEM} />
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
        <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl border-r border-border">{navList}</div>
      </aside>

      {/* Mobile drawer (opened from the header's hamburger button) */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
          <div className="relative w-80 max-w-[85vw] h-full bg-white shadow-2xl z-10 animate-slide-right flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-brand-50/80 to-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-black text-sm shadow-brand shrink-0">N</span>
                <div className="min-w-0">
                  <div className="font-bold text-navy-900 text-sm truncate">{activeShop?.name || "NSYU Store"}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{activeShop?.code || "NSYU-01"}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 flex items-center justify-center transition shrink-0"
                aria-label="Close menu"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {navList}

            <div className="p-3.5 border-t border-gray-100 bg-slate-50/60 space-y-2">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-navy-900 truncate">{userName}</div>
                  <div className="text-[10.5px] text-slate-400 truncate">{userRole}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
