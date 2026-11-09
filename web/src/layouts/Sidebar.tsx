import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import type { ModuleName } from "../types";

export type NavGroup = "MAIN" | "BUSINESS MANAGEMENT" | "MANAGEMENT" | "ADMIN";

export interface NavItem {
  to: string;
  label: string;
  module: ModuleName;
  group: NavGroup;
  icon: (active: boolean) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  // =========================================================================
  // 1. MAIN (Follows Mobile App Navigation: Home, Bills, Ledger, Catalog, Orders)
  // =========================================================================
  {
    to: "/app",
    label: "Dashboard",
    module: "dashboard",
    group: "MAIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/app/billing",
    label: "Billing",
    module: "billing",
    group: "MAIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
      </svg>
    ),
  },
  {
    to: "/app/ledger",
    label: "Ledger",
    module: "ledger",
    group: "MAIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="13" y2="11" />
      </svg>
    ),
  },
  {
    to: "/app/products",
    label: "Catalog",
    module: "products",
    group: "MAIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    to: "/app/orders",
    label: "Orders",
    module: "orders",
    group: "MAIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },

  // =========================================================================
  // 2. BUSINESS MANAGEMENT
  // =========================================================================
  {
    to: "/app/inventory",
    label: "Inventory",
    module: "inventory",
    group: "BUSINESS MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    to: "/app/customers",
    label: "Customers",
    module: "customers",
    group: "BUSINESS MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/app/payments",
    label: "Payments",
    module: "payments",
    group: "BUSINESS MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    to: "/app/emi",
    label: "EMI / Installments",
    module: "emi",
    group: "BUSINESS MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="13" y2="18" />
      </svg>
    ),
  },

  // =========================================================================
  // 3. MANAGEMENT
  // =========================================================================
  {
    to: "/app/employees",
    label: "Employees",
    module: "employees",
    group: "MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    to: "/app/attendance",
    label: "Attendance",
    module: "attendance",
    group: "MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: "/app/payroll",
    label: "Salary / Payroll",
    module: "payroll",
    group: "MANAGEMENT",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },

  // =========================================================================
  // 4. ADMIN
  // =========================================================================
  {
    to: "/app/roles",
    label: "Roles & Permissions",
    module: "role_permissions",
    group: "ADMIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    to: "/app/settings",
    label: "Settings",
    module: "settings",
    group: "ADMIN",
    icon: (active) => (
      <svg
        className={clsx("w-4 h-4 shrink-0 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const GROUPS: NavGroup[] = [
  "MAIN",
  "BUSINESS MANAGEMENT",
  "MANAGEMENT",
  "ADMIN",
];

const STORAGE_KEY = "nsyu_sidebar_collapsed_groups";

export default function Sidebar() {
  const location = useLocation();
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
  const visibleItems = NAV_ITEMS.filter((item) => isOwner || can(item.module, "view"));

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-screen sticky top-0 z-20 select-none">
      {/* Brand Header */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-100/90 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900 tracking-tight leading-none truncate">
            NSYU Business
          </div>
          <div className="text-[10.5px] text-slate-400 font-medium leading-none mt-1 truncate">
            {activeShop ? `${activeShop.name} (${activeShop.code})` : "Multi-Shop Management"}
          </div>
        </div>
      </div>

      {/* Nav List - Compact, Collapsible, Clean */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
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
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors group/hdr rounded cursor-pointer"
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
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-all group",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold"
                            : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
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
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-1.5">
        {useAuthStore.getState().isSuperAdmin() && (
          <NavLink
            to="/admin"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 text-[11px] font-bold border border-purple-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              Super Admin Panel
            </span>
            <span className="font-mono text-[10px]">→</span>
          </NavLink>
        )}
        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            {activeShop?.code || "NSYU-01"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
