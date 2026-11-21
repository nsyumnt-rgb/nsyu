import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { logout as logoutApi } from "../api/auth";
import type { ModuleName } from "../types";

export type NavGroup = "DASHBOARD" | "PRODUCTS & STOCK" | "BILLING & ORDERS" | "CUSTOMERS & LEDGER" | "SETTINGS";

export interface NavItem {
  to: string;
  label: string;
  module: ModuleName;
  group: NavGroup;
  icon: (active: boolean) => ReactNode;
  /** Shown only to the owner account. */
  ownerOnly?: boolean;
}

/** Stroke icon from one or more SVG path strings. */
const ico = (...paths: string[]) => (active: boolean) => (
  <svg
    className={clsx("w-[18px] h-[18px] shrink-0 transition-colors", active ? "text-emerald-700 font-bold" : "text-slate-400 group-hover:text-navy-900")}
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
 * 6 Core Shop Modules: Bill, Ledger, Inventory, Customer, Product, Order.
 */
const NAV_ITEMS: NavItem[] = [
  // Dashboard & Shops
  { to: "/app", label: "Dashboard", module: "dashboard", group: "DASHBOARD", icon: ico("M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z") },
  { to: "/app/shops", label: "My shops", module: "shops", group: "DASHBOARD", ownerOnly: true, icon: ico("M3 9l1.5-5h15L21 9", "M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9", "M5 13v8h14v-8") },

  // Products & Inventory
  { to: "/app/products", label: "Products", module: "products", group: "PRODUCTS & STOCK", icon: ico("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01") },
  { to: "/app/categories", label: "Categories", module: "products", group: "PRODUCTS & STOCK", icon: ico("M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z") },
  { to: "/app/inventory", label: "Inventory", module: "inventory", group: "PRODUCTS & STOCK", icon: ico("M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5") },

  // Billing & Orders
  { to: "/app/billing", label: "POS Billing", module: "billing", group: "BILLING & ORDERS", icon: ico("M13 2L4 14h7l-1 8 9-12h-7z") },
  { to: "/app/cart", label: "POS Cart", module: "billing", group: "BILLING & ORDERS", icon: ico("M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6", "M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z") },
  { to: "/app/sales", label: "Sales invoices", module: "sales", group: "BILLING & ORDERS", icon: ico("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8") },
  { to: "/app/orders", label: "Orders", module: "orders", group: "BILLING & ORDERS", icon: ico("M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0") },

  // Customers & Ledger
  { to: "/app/customers", label: "Customers", module: "customers", group: "CUSTOMERS & LEDGER", icon: ico("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75") },
  { to: "/app/ledger", label: "Customer ledger", module: "ledger", group: "CUSTOMERS & LEDGER", icon: ico("M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z", "M9 7h6", "M9 11h4") },

  // Settings
  { to: "/app/settings", label: "Shop settings", module: "settings", group: "SETTINGS", icon: ico("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z") },
];

const GROUPS: NavGroup[] = ["DASHBOARD", "PRODUCTS & STOCK", "BILLING & ORDERS", "CUSTOMERS & LEDGER", "SETTINGS"];

const STORAGE_KEY = "nsyu_sidebar_collapsed_groups";

interface SidebarProps {
  /** Mobile drawer visibility */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    onClose?.();
  }, [location.pathname, onClose]);

  const accountType = useAuthStore((s) => s.accountType);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const roleName = useAuthStore((s) => s.roleName);
  const activeShop = useAuthStore((s) => s.activeShop);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);
  const isOwner = accountType === "owner" || (useAuthStore.getState().owner !== null);

  const userName = accountType === "owner" ? (owner?.name || "Store Owner") : (employee?.name || "Staff");
  const userRole = accountType === "owner" ? "Store Owner" : (roleName || "Staff Member");

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {}
    }
    storeLogout();
    navigate("/login");
  }

  const [collapsed, setCollapsed] = useState<Record<NavGroup, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : ({} as Record<NavGroup, boolean>);
    } catch {
      return {} as Record<NavGroup, boolean>;
    }
  });

  const toggleGroup = (group: NavGroup) => {
    setCollapsed((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    return true;
  });

  const renderNavList = () => (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {GROUPS.map((group) => {
        const items = visibleItems.filter((i) => i.group === group);
        if (items.length === 0) return null;
        const isCollapsed = Boolean(collapsed[group]);

        return (
          <div key={group} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase hover:text-gray-700 transition"
            >
              <span>{group}</span>
              <span className="text-gray-300 text-[10px]">{isCollapsed ? "+" : "−"}</span>
            </button>

            {!isCollapsed && (
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/app"}
                    className={({ isActive }) =>
                      clsx(
                        "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]",
                        isActive
                          ? "bg-emerald-50 text-emerald-900 font-bold shadow-2xs border border-emerald-100/80"
                          : "text-gray-600 hover:bg-gray-50 hover:text-navy-950"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.icon(isActive)}
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
          {renderNavList()}
        </div>
      </aside>

      {/* Mobile Drawer (Native App Slide-out) */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-navy-950/50 backdrop-blur-xs animate-fade-in" onClick={onClose} />
          <div className="relative w-80 max-w-[85vw] h-full bg-white shadow-2xl z-10 animate-slide-right flex flex-col justify-between">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#064E3B] text-white flex items-center justify-center font-black text-sm shadow-sm">
                  N
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-navy-900 text-sm truncate">
                    {activeShop?.name || "NSYU Store"}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {activeShop?.code || "NSYU-01"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 flex items-center justify-center transition"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Drawer Navigation List */}
            {renderNavList()}

            {/* Drawer Footer (User Info & Logout) */}
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
                className="w-full py-2 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
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
