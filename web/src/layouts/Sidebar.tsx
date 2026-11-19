import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import type { ModuleName } from "../types";

export type NavGroup = "BUSINESS" | "ADMIN";

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
    className={clsx("w-[18px] h-[18px] shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-white")}
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
 * Owner panel modules in the order of the Marketplace wireframe (board 7):
 * Dashboard, Products, Inventory, Sales, Purchases, Customers, Reports, Storefront settings.
 * Suppliers and Ledger sit next to the module they belong to.
 */
const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", module: "dashboard", group: "BUSINESS", icon: ico("M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z") },
  { to: "/app/products", label: "Products", module: "products", group: "BUSINESS", icon: ico("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01") },
  { to: "/app/inventory", label: "Inventory", module: "inventory", group: "BUSINESS", icon: ico("M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5") },
  { to: "/app/billing", label: "Sales", module: "billing", group: "BUSINESS", icon: ico("M4 2h16v20l-3-2-3 2-3-2-3 2-4-2z", "M8 7h8", "M8 11h8", "M8 15h5") },
  { to: "/app/orders", label: "Online orders", module: "orders", group: "BUSINESS", icon: ico("M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0") },
  { to: "/app/purchase", label: "Purchases", module: "purchase", group: "BUSINESS", icon: ico("M1 3h15v13H1z", "M16 8h4l3 3v5h-7z", "M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z") },
  { to: "/app/suppliers", label: "Suppliers", module: "suppliers", group: "BUSINESS", icon: ico("M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-6h6v6") },
  { to: "/app/customers", label: "Customers", module: "customers", group: "BUSINESS", icon: ico("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75") },
  { to: "/app/ledger", label: "Customer ledger", module: "ledger", group: "BUSINESS", icon: ico("M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z", "M9 7h6", "M9 11h4") },
  { to: "/app/reports", label: "Reports", module: "reports", group: "BUSINESS", icon: ico("M3 3v18h18", "M7 15l4-4 3 3 5-6") },
  { to: "/app/settings", label: "Storefront & settings", module: "settings", group: "ADMIN", icon: ico("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z") },
  { to: "/app/staff", label: "Staff", module: "employees", group: "ADMIN", ownerOnly: true, icon: ico("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M19 8v6", "M22 11h-6") },
  { to: "/app/roles", label: "Roles & permissions", module: "role_permissions", group: "ADMIN", icon: ico("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z") },
];

const GROUPS: NavGroup[] = ["BUSINESS", "ADMIN"];

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
        className="fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-[2px] lg:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
    )}
    <aside
      className={clsx(
        "w-64 lg:w-60 shrink-0 bg-navy-950 bg-gradient-to-b from-navy-900 to-navy-950 text-white flex flex-col h-screen select-none",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:z-20 lg:translate-x-0",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-white/[0.06] shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-900/50 ring-1 ring-white/10">
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-white tracking-tight leading-none truncate">
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
                className="w-full flex items-center justify-between px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300 transition-colors group/hdr rounded cursor-pointer"
                title={isCollapsed ? `Expand ${group}` : `Collapse ${group}`}
              >
                <span>{group}</span>
                <svg
                  className={clsx(
                    "w-3 h-3 text-slate-600 group-hover/hdr:text-slate-400 transition-transform duration-200",
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
                            ? "bg-white/[0.09] text-white font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-brand-400"
                            : "text-slate-300/90 hover:bg-white/[0.05] hover:text-white"
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
      <div className="p-3 border-t border-white/[0.06] shrink-0 space-y-2">
        {useAuthStore.getState().isSuperAdmin() && (
          <NavLink
            to="/admin"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.06] text-violet-200 hover:bg-white/10 text-[11.5px] font-semibold ring-1 ring-white/10 transition"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              Super Admin Panel
            </span>
            <span className="font-mono text-[10px]">→</span>
          </NavLink>
        )}
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-200 flex items-center gap-2 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ring-4 ring-emerald-400/15" />
            {activeShop?.code || "NSYU-01"}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
    </>
  );
}
