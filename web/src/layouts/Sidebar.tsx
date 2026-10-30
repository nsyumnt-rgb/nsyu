import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { usePermission } from "../hooks/usePermission";
import type { ModuleName } from "../types";

interface NavItem {
  to: string;
  label: string;
  module: ModuleName;
  group?: "BUSINESS" | "PEOPLE" | "REPORTS" | "ADMIN";
  icon: (active: boolean) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  // Dashboard is top-level above groups
  {
    to: "/app",
    label: "Dashboard",
    module: "dashboard",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },

  // BUSINESS
  {
    to: "/app/products",
    label: "Products",
    module: "products",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    to: "/app/inventory",
    label: "Inventory",
    module: "inventory",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    to: "/app/purchase",
    label: "Purchase",
    module: "purchase",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    to: "/app/sales",
    label: "Sales",
    module: "sales",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: "/app/orders",
    label: "Orders",
    module: "orders",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    to: "/app/billing",
    label: "Billing",
    module: "billing",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
      </svg>
    ),
  },
  {
    to: "/app/customers",
    label: "Customers",
    module: "customers",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/app/suppliers",
    label: "Suppliers",
    module: "suppliers",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    to: "/app/payments",
    label: "Payments",
    module: "payments",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    to: "/app/ledger",
    label: "Customer Ledger",
    module: "ledger",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    to: "/app/emi",
    label: "EMI / Installments",
    module: "emi",
    group: "BUSINESS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" />
        <line x1="12" y1="14" x2="12" y2="14" />
        <line x1="16" y1="14" x2="16" y2="14" />
      </svg>
    ),
  },

  // PEOPLE
  {
    to: "/app/employees",
    label: "Employees",
    module: "employees",
    group: "PEOPLE",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    to: "/app/attendance",
    label: "Attendance",
    module: "attendance",
    group: "PEOPLE",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: "/app/payroll",
    label: "Salary / Payroll",
    module: "payroll",
    group: "PEOPLE",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },

  // BUSINESS INTELLIGENCE & REPORTS
  {
    to: "/app/reports",
    label: "Reports",
    module: "reports",
    group: "REPORTS",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },

  // ADMIN
  {
    to: "/app/shops",
    label: "Shops",
    module: "shops",
    group: "ADMIN",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: "/app/roles",
    label: "Roles & Permissions",
    module: "role_permissions",
    group: "ADMIN",
    icon: (active) => (
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg className={clsx("w-4 h-4", active ? "text-white" : "text-slate-500")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { can, isOwner } = usePermission();
  const [reportsExpanded, setReportsExpanded] = useState<boolean | null>(null);

  const businessItems = NAV_ITEMS.filter((i) => i.group === "BUSINESS" && (isOwner || can(i.module, "view")));
  const peopleItems = NAV_ITEMS.filter((i) => i.group === "PEOPLE" && (isOwner || can(i.module, "view")));
  const reportItems = NAV_ITEMS.filter((i) => i.group === "REPORTS" && (isOwner || can(i.module, "view")));
  const adminItems = NAV_ITEMS.filter((i) => i.group === "ADMIN" && (isOwner || can(i.module, "view")));

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-screen sticky top-0 z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold text-slate-900 leading-tight">NSY Business</div>
          <div className="text-[11px] text-slate-400 font-medium leading-tight">Multi-Shop Management</div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {/* Dashboard Top Pill */}
        <div>
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all group",
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                {NAV_ITEMS[0].icon(isActive)}
                <span>Dashboard</span>
              </>
            )}
          </NavLink>
        </div>

        {/* BUSINESS Group */}
        {businessItems.length > 0 && (
          <div>
            <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BUSINESS
            </div>
            <div className="space-y-0.5">
              {businessItems.map((item) => {
                const isInventory = item.to === "/app/inventory";
                const isInventoryActive = location.pathname.startsWith("/app/inventory");
                const currentTab = searchParams.get("tab") || "Current Stock";

                return (
                  <div key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            {item.icon(isActive)}
                            <span>{item.label}</span>
                          </div>
                          <svg
                            className={clsx(
                              "w-3 h-3 transition-transform",
                              isActive ? "text-white/80" : "text-slate-300 group-hover:text-slate-400",
                              isInventory && isInventoryActive && "rotate-90"
                            )}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </>
                      )}
                    </NavLink>

                    {/* Inventory Sub-menu */}
                    {isInventory && isInventoryActive && (
                      <div className="pl-9 pr-2 py-1.5 space-y-1 text-xs">
                        {[
                          "Current Stock",
                          "Stock Movements",
                          "Stock Transfer",
                          "Stock Adjustment",
                          "Low Stock Alerts",
                        ].map((sub) => {
                          const isSubActive = currentTab === sub;
                          return (
                            <NavLink
                              key={sub}
                              to={`/app/inventory?tab=${encodeURIComponent(sub)}`}
                              className={clsx(
                                "flex items-center gap-2 py-1 px-2 rounded-md font-medium transition-colors",
                                isSubActive
                                  ? "text-blue-600 font-bold bg-blue-50/60"
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                              )}
                            >
                              {isSubActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                              <span className={isSubActive ? "" : "pl-3.5"}>{sub}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PEOPLE Group */}
        {peopleItems.length > 0 && (
          <div>
            <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              PEOPLE
            </div>
            <div className="space-y-0.5">
              {peopleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        {item.icon(isActive)}
                        <span>{item.label}</span>
                      </div>
                      <svg
                        className={clsx("w-3 h-3 transition-transform", isActive ? "text-white/80" : "text-slate-300 group-hover:text-slate-400")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* BUSINESS INTELLIGENCE & REPORTS Group */}
        {reportItems.length > 0 && (
          <div>
            <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BUSINESS INTELLIGENCE & REPORTS
            </div>
            <div className="space-y-0.5">
              {reportItems.map((item) => {
                const isReports = item.to === "/app/reports";
                const isReportsActive = location.pathname.startsWith("/app/reports");
                const currentReportTab = searchParams.get("tab") || "sales";
                const showReportsSub = reportsExpanded ?? isReportsActive;

                return (
                  <div key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            {item.icon(isActive)}
                            <span>{item.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setReportsExpanded(!showReportsSub);
                            }}
                            className="p-1 rounded hover:bg-black/10 transition-colors"
                            aria-label="Toggle Reports Menu"
                          >
                            <svg
                              className={clsx(
                                "w-3 h-3 transition-transform",
                                isActive ? "text-white/80" : "text-slate-300 group-hover:text-slate-400",
                                isReports && showReportsSub && "rotate-90"
                              )}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </>
                      )}
                    </NavLink>

                    {/* Reports Sub-menu */}
                    {isReports && showReportsSub && (
                      <div className="pl-9 pr-2 py-1.5 space-y-1 text-xs">
                        {[
                          { id: "sales", label: "Sales Analytics" },
                          { id: "purchases", label: "Purchases" },
                          { id: "profit", label: "Gross Profit & Margins" },
                          { id: "inventory", label: "Inventory Valuation" },
                          { id: "outstanding", label: "Customer Outstanding" },
                          ...(isOwner ? [{ id: "performance", label: "Shop Performance" }] : []),
                        ].map((sub) => {
                          const isSubActive = isReportsActive && currentReportTab === sub.id;
                          return (
                            <NavLink
                              key={sub.id}
                              to={`/app/reports?tab=${sub.id}`}
                              className={clsx(
                                "flex items-center gap-2 py-1 px-2 rounded-md font-medium transition-colors",
                                isSubActive
                                  ? "text-blue-600 font-bold bg-blue-50/60"
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                              )}
                            >
                              {isSubActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                              <span className={isSubActive ? "" : "pl-3.5"}>{sub.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ADMIN Group */}
        {adminItems.length > 0 && (
          <div>
            <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ADMIN
            </div>
            <div className="space-y-0.5">
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        {item.icon(isActive)}
                        <span>{item.label}</span>
                      </div>
                      <svg
                        className={clsx("w-3 h-3 transition-transform", isActive ? "text-white/80" : "text-slate-300 group-hover:text-slate-400")}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
