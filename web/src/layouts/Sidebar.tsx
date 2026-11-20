import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import type { ModuleName } from "../types";

export type NavGroup = "DASHBOARD" | "CATALOG" | "SALES & KHATA" | "B2B WHOLESALE" | "SETTINGS";

export interface NavItem {
  to: string;
  label: string;
  module: ModuleName;
  group: NavGroup;
  icon: (active: boolean) => ReactNode;
  /** Shown only to the owner account (the API is owner-only too). */
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
 * Navigation items matching NSYU Commerce Platform.html navItems() exactly.
 */
const NAV_ITEMS: NavItem[] = [
  // Dashboard & Shops
  { to: "/app", label: "Dashboard", module: "dashboard", group: "DASHBOARD", icon: ico("M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z") },
  { to: "/app/shops", label: "My shops", module: "shops", group: "DASHBOARD", ownerOnly: true, icon: ico("M3 9l1.5-5h15L21 9", "M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9", "M5 13v8h14v-8") },

  // Catalog
  { to: "/app/inventory", label: "Inventory", module: "inventory", group: "CATALOG", icon: ico("M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5") },
  { to: "/app/catalog", label: "Product catalog", module: "products", group: "CATALOG", icon: ico("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01") },
  { to: "/app/products", label: "Add product", module: "products", group: "CATALOG", icon: ico("M12 5v14M5 12h14") },
  { to: "/app/low-stock", label: "Low stock alerts", module: "inventory", group: "CATALOG", icon: ico("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z") },

  // Sales & Khata
  { to: "/app/orders", label: "Orders", module: "orders", group: "SALES & KHATA", icon: ico("M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0") },
  { to: "/app/billing", label: "POS / Create order", module: "billing", group: "SALES & KHATA", icon: ico("M13 2L4 14h7l-1 8 9-12h-7z") },
  { to: "/app/customers", label: "Customers", module: "customers", group: "SALES & KHATA", icon: ico("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75") },
  { to: "/app/ledger", label: "Customer ledger", module: "ledger", group: "SALES & KHATA", icon: ico("M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z", "M9 7h6", "M9 11h4") },
  { to: "/app/khata", label: "Udhaar / Khata", module: "ledger", group: "SALES & KHATA", icon: ico("M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2zM3 7l2-3h12M16 13h2") },
  { to: "/app/expenses", label: "Expenses & cash book", module: "billing", group: "SALES & KHATA", icon: ico("M4 2h16v20l-3-2-3 2-3-2-3 2-4-2z", "M8 7h8", "M8 11h8", "M8 15h5") },

  // Buying & B2B
  { to: "/app/b2b-market", label: "B2B marketplace", module: "purchase", group: "B2B WHOLESALE", icon: ico("M3 21V9l6 4V9l6 4V5h4v16z") },
  { to: "/app/b2b-po", label: "Purchase orders", module: "purchase", group: "B2B WHOLESALE", icon: ico("M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01") },
  { to: "/app/b2b-ledger", label: "Payables & receivables", module: "purchase", group: "B2B WHOLESALE", icon: ico("M4 8h14l-3-3M20 16H6l3 3") },
  { to: "/app/purchase", label: "Purchases", module: "purchase", group: "B2B WHOLESALE", icon: ico("M1 3h15v13H1z", "M16 8h4l3 3v5h-7z", "M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z") },
  { to: "/app/suppliers", label: "Suppliers", module: "suppliers", group: "B2B WHOLESALE", icon: ico("M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-6h6v6") },

  // Business Settings
  { to: "/app/reports", label: "Reports", module: "reports", group: "SETTINGS", icon: ico("M3 3v18h18", "M7 15l4-4 3 3 5-6") },
  { to: "/app/settings", label: "Storefront & settings", module: "settings", group: "SETTINGS", icon: ico("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z") },
  { to: "/app/staff", label: "Staff", module: "employees", group: "SETTINGS", ownerOnly: true, icon: ico("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M19 8v6", "M22 11h-6") },
  { to: "/app/roles", label: "Roles & permissions", module: "role_permissions", group: "SETTINGS", icon: ico("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z") },
];

const GROUPS: NavGroup[] = ["DASHBOARD", "CATALOG", "SALES & KHATA", "B2B WHOLESALE", "SETTINGS"];

const STORAGE_KEY = "nsyu_sidebar_collapsed_groups";

interface SidebarProps {
  /** Mobile drawer visibility (ignored on large screens where the sidebar is always shown) */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const { can, isOwner } = usePermission();
  const activeShop = useAuthStore((s) => s.activeShop);

  // Persistent collapsed state for each section
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (group: NavGroup) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  // Filter items by role-based permissions
  const visibleItems = NAV_ITEMS.filter((item) => (item.ownerOnly ? isOwner : isOwner || can(item.module, "view")));

  return (
    <>
    {open && (
      <div
        className="fixed inset-0 z-40 bg-navy-950/20 backdrop-blur-[2px] lg:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
    )}
    <aside
      className={clsx(
        "w-64 lg:w-60 shrink-0 bg-white text-navy-900 flex flex-col h-screen select-none border-r border-slate-200/80",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:z-20 lg:translate-x-0",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shadow-sm ring-1 ring-inset ring-brand-100">
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-navy-900 tracking-tight leading-none truncate">
            NSYU Business
          </div>
          <div className="text-[11px] text-slate-400 font-medium leading-none mt-1.5 truncate">
            {activeShop ? `${activeShop.name} (${activeShop.code})` : "Multi-Shop Management"}
          </div>
        </div>
      </div>

      {/* Nav List - Compact, Collapsible, Clean */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GROUPS.map((group) => {
          const itemsInGroup = visibleItems.filter((i) => i.group === group);
          if (itemsInGroup.length === 0) return null;

          const isCollapsed = Boolean(collapsedGroups[group]);

          return (
            <div key={group} className="space-y-0.5">
              {/* Section Header with Collapse Chevron */}
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-navy-900 transition-colors group/hdr rounded cursor-pointer"
                title={isCollapsed ? `Expand ${group}` : `Collapse ${group}`}
              >
                <span>{group}</span>
                <svg
                  className={clsx(
                    "w-3 h-3 text-slate-300 group-hover/hdr:text-slate-500 transition-transform duration-200",
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Group Nav Items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {itemsInGroup.map((item) => {
                    const isExactMatch = location.pathname === item.to;
                    const isSubRoute = item.to !== "/app" && location.pathname.startsWith(item.to);
                    const isActive = isExactMatch || isSubRoute;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/app"}
                        className={clsx(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                          isActive
                            ? "bg-brand-50 text-brand-800 font-semibold shadow-[inset_0_0_0_1px_rgba(0,132,95,0.12)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-brand-600"
                            : "text-slate-600 hover:bg-slate-50 hover:text-navy-900"
                        )}
                      >
                        {item.icon(isActive)}
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Compact Bottom Footer */}
      <div className="p-3 border-t border-slate-100 shrink-0 space-y-2">
        {useAuthStore.getState().isSuperAdmin() && (
          <NavLink
            to="/admin"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[11.5px] font-semibold ring-1 ring-violet-100 transition"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              Super Admin Panel
            </span>
            <span className="font-mono text-[10px]">→</span>
          </NavLink>
        )}
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-700 flex items-center gap-2 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 ring-4 ring-brand-500/15" />
            {activeShop?.code || "NSYU-01"}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
    </>
  );
}
