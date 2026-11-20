import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
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
  { to: "/app/inventory", label: "Inventory", module: "inventory", group: "PRODUCTS & STOCK", icon: ico("M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5") },

  // Billing & Orders
  { to: "/app/billing", label: "POS Billing", module: "billing", group: "BILLING & ORDERS", icon: ico("M13 2L4 14h7l-1 8 9-12h-7z") },
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

  useEffect(() => {
    onClose?.();
  }, [location.pathname, onClose]);

  const accountType = useAuthStore((s) => s.accountType);
  const isOwner = accountType === "owner" || (useAuthStore.getState().owner !== null);

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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
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
                          "group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
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
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-xs" onClick={onClose} />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
