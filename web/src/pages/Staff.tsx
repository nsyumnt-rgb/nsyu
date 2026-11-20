import { useEffect, useMemo, useState } from "react";
import { apiErrorMessage } from "../api/client";
import {
  assignShopRole,
  createEmployee,
  listEmployees,
  removeShopAssignment,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployee,
} from "../api/employees";
import { listRoles } from "../api/roles";
import { listShops } from "../api/shops";
import { usePermission } from "../hooks/usePermission";
import type { Employee, Role, Shop } from "../types";

type StaffRow = Employee & {
  shopAssignments?: Array<{
    id: number;
    shop_id: number;
    role_id: number;
    shop?: Shop;
    role?: Role;
  }>;
};

// Distinct badge colors for roles matching market style
function getRoleBadgeStyle(roleName: string) {
  const r = roleName.toLowerCase();
  if (r.includes("manager")) {
    return { bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80", icon: "👑" };
  }
  if (r.includes("cashier") || r.includes("billing")) {
    return { bg: "bg-indigo-50 text-indigo-700 border-indigo-200/80", icon: "💳" };
  }
  if (r.includes("sales")) {
    return { bg: "bg-sky-50 text-sky-800 border-sky-200/80", icon: "💼" };
  }
  if (r.includes("tech") || r.includes("service")) {
    return { bg: "bg-amber-50 text-amber-800 border-amber-200/80", icon: "🔧" };
  }
  if (r.includes("stock") || r.includes("inventory")) {
    return { bg: "bg-teal-50 text-teal-800 border-teal-200/80", icon: "📦" };
  }
  return { bg: "bg-slate-50 text-slate-700 border-slate-200/80", icon: "👤" };
}

// Gradient themes for staff card covers
const CARD_COVER_GRADIENTS = [
  "from-emerald-700 via-teal-700 to-emerald-900",
  "from-teal-700 via-emerald-800 to-cyan-900",
  "from-emerald-800 via-green-800 to-teal-900",
  "from-cyan-800 via-teal-800 to-emerald-800",
];

export default function Staff() {
  const { isOwner } = usePermission();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [resettingPwStaff, setResettingPwStaff] = useState<StaffRow | null>(null);

  // Filters & View Controls
  const [query, setQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedShop, setSelectedShop] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "recent" | "status">("name");
  const [isListView, setIsListView] = useState(false);

  // Platform, owner and customer roles are not staff roles
  const staffRoles = useMemo(
    () => roles.filter((r) => !["Owner", "Super Admin", "User"].includes(r.name)),
    [roles]
  );

  async function load() {
    try {
      const [s, r, sh] = await Promise.all([listEmployees(), listRoles(), listShops()]);
      setStaff((s.data.data || []) as StaffRow[]);
      setRoles((r.data.data || []) as Role[]);
      setShops((sh.data.data || []) as Shop[]);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load staff"));
      setStaff([]);
    }
  }

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Quick Live Toggle Status
  const handleToggleStatus = async (employee: StaffRow) => {
    const nextStatus = employee.status === "active" ? "inactive" : "active";
    // Optimistic update
    setStaff((prev) =>
      prev
        ? prev.map((s) => (s.id === employee.id ? { ...s, status: nextStatus } : s))
        : prev
    );

    try {
      await setEmployeeStatus(employee.id, nextStatus);
      flash(
        nextStatus === "active"
          ? `${employee.name} is now Active and can sign in.`
          : `${employee.name} was deactivated.`
      );
    } catch (err) {
      // Revert on error
      setStaff((prev) =>
        prev
          ? prev.map((s) => (s.id === employee.id ? { ...s, status: employee.status } : s))
          : prev
      );
      setError(apiErrorMessage(err, "Failed to update staff status"));
    }
  };

  // Filter & Sort Logic
  const filteredStaff = useMemo(() => {
    if (!staff) return [];
    let list = staff.filter((s) => {
      // Search query
      if (query.trim()) {
        const q = query.toLowerCase();
        const inName = s.name.toLowerCase().includes(q);
        const inEmail = s.email.toLowerCase().includes(q);
        const inPhone = (s.phone || "").toLowerCase().includes(q);
        const inRoles = (s.shopAssignments || []).some((a) =>
          (a.role?.name || "").toLowerCase().includes(q)
        );
        const inShops = (s.shopAssignments || []).some((a) =>
          (a.shop?.name || "").toLowerCase().includes(q)
        );
        if (!inName && !inEmail && !inPhone && !inRoles && !inShops) return false;
      }

      // Role filter
      if (selectedRole !== "all") {
        const hasRole = (s.shopAssignments || []).some((a) => a.role?.name === selectedRole);
        if (!hasRole) return false;
      }

      // Shop filter
      if (selectedShop !== "all") {
        const shopIdNum = Number(selectedShop);
        const hasShop = (s.shopAssignments || []).some((a) => a.shop_id === shopIdNum);
        if (!hasShop) return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        if (s.status !== selectedStatus) return false;
      }

      return true;
    });

    // Sort
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "status") {
      list.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === "active" ? -1 : 1;
      });
    } else if (sortBy === "recent") {
      list.sort((a, b) => b.id - a.id);
    }

    return list;
  }, [staff, query, selectedRole, selectedShop, selectedStatus, sortBy]);

  // Statistics
  const totalCount = staff?.length || 0;
  const activeCount = (staff || []).filter((s) => s.status === "active").length;
  const inactiveCount = totalCount - activeCount;
  const coveredShopsCount = useMemo(() => {
    const set = new Set<number>();
    (staff || []).forEach((s) => {
      (s.shopAssignments || []).forEach((a) => set.add(a.shop_id));
    });
    return set.size;
  }, [staff]);

  if (!isOwner) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-4 border border-amber-200">
          🔒
        </div>
        <h1 className="text-xl font-bold text-gray-900">Owner Access Required</h1>
        <p className="text-xs text-gray-500 mt-2">
          Only the store owner has permission to manage staff accounts, roles, and branch credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 flex items-center justify-between shadow-xs animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center justify-between shadow-xs animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-semibold">{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN TWO-COLUMN LAYOUT: CATEGORY SIDEBAR (LEFT) + CONTENT (RIGHT) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT SIDEBAR: ROLES, BRANCHES & STATUS (Market-Style)        */}
        {/* ============================================================ */}
        <aside className="space-y-5 lg:sticky lg:top-20 z-10">
          {/* 1. All Staff & Roles Sidebar Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-black text-gray-900 uppercase tracking-wider mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span>👥</span> Team Roles
                </span>
                <span className="text-[10px] text-gray-400 font-bold">({totalCount})</span>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedRole("all")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left ${
                    selectedRole === "all"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🌟</span> All Staff Roles
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">{totalCount}</span>
                </button>

                {staffRoles.map((role) => {
                  const count = (staff || []).filter((s) =>
                    (s.shopAssignments || []).some((a) => a.role?.name === role.name)
                  ).length;
                  const style = getRoleBadgeStyle(role.name);
                  const isSelected = selectedRole === role.name;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(isSelected ? "all" : role.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left ${
                        isSelected
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{style.icon}</span>
                        <span className="truncate">{role.name}</span>
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Shop / Branch Filter */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs font-black text-gray-900 uppercase tracking-wider mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span>🏪</span> Branches
                </span>
                <span className="text-[10px] text-gray-400 font-bold">({shops.length})</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedShop("all")}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold transition text-left ${
                    selectedShop === "all"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>All Branches</span>
                  <span className="text-[10px] text-gray-400 font-normal">{totalCount}</span>
                </button>
                {shops.map((shop) => {
                  const count = (staff || []).filter((s) =>
                    (s.shopAssignments || []).some((a) => a.shop_id === shop.id)
                  ).length;
                  const isSelected = selectedShop === String(shop.id);
                  return (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => setSelectedShop(isSelected ? "all" : String(shop.id))}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold transition text-left truncate ${
                        isSelected
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span className="text-[11px]">📍</span>
                        <span className="truncate">{shop.name}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal shrink-0">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Account Status Filter */}
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2.5">
                Account Status
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Off" },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStatus(st.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-center transition ${
                      selectedStatus === st.id
                        ? "bg-[#047857] text-white shadow-xs"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Filters Button if any active */}
            {(selectedRole !== "all" ||
              selectedShop !== "all" ||
              selectedStatus !== "all" ||
              query.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("all");
                  setSelectedShop("all");
                  setSelectedStatus("all");
                  setQuery("");
                }}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:text-emerald-900 pt-2 border-t border-gray-100"
              >
                Reset All Filters ↺
              </button>
            )}
          </div>
        </aside>

        {/* ============================================================ */}
        {/* RIGHT CONTENT AREA: HERO BANNER, KPIS, SEARCH & STAFF CARDS  */}
        {/* ============================================================ */}
        <div className="space-y-6 min-w-0">
          {/* 1. HERO BANNER FOR STAFF (Exact Image 2 Market Style) */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-100/90 via-emerald-50 to-teal-50 border border-emerald-100 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 min-h-[220px]">
            {/* Left Hero Content */}
            <div className="max-w-xl space-y-3 z-10 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/10 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>NSYU Team Hub & Staff Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-black text-[#064E3B] leading-tight tracking-tight">
                Manage Your Store Staff
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                Assign managers, cashiers, technicians and team roles across all shops with
                individual logins and custom permissions.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Add Staff Member</span>
                </button>
              </div>
            </div>

            {/* Right 3D Team & Storefront Illustration */}
            <div className="relative z-10 flex items-center justify-center shrink-0">
              <div className="relative w-60 sm:w-72 h-40 sm:h-44 rounded-2xl overflow-hidden flex items-center justify-center">
                {/* 3D Visual Hub Graphic */}
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <div className="w-52 h-6 bg-emerald-700 rounded-t-xl flex justify-between px-2 items-center shadow-md border-b-2 border-emerald-900">
                    <span className="text-[9.5px] font-black text-white tracking-widest uppercase">
                      NSYU Staff Portal
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                  </div>
                  <div className="w-52 h-28 bg-white/95 backdrop-blur-xs rounded-b-xl border border-gray-200/90 p-3 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          M
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-gray-900">Store Team</div>
                          <div className="text-[9px] text-emerald-700 font-semibold">Active & Live</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[9px]">
                        ONLINE
                      </span>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-gray-100">
                      <div className="flex justify-between text-[9.5px] font-medium text-gray-500">
                        <span>Coverage</span>
                        <span className="font-bold text-emerald-700">
                          {coveredShopsCount}/{shops.length || 1} Branches
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((coveredShopsCount / (shops.length || 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. MARKET KPI STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-md transition">
              <div className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Staff Accounts</span>
                <span className="text-base">👥</span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
                {staff?.length ?? "—"}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Total registered staff</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-md transition">
              <div className="text-[11.5px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                <span>Active & Live</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">
                {staff ? activeCount : "—"}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">Ready to sign in</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-md transition">
              <div className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Inactive / Off</span>
                <span className="text-base">⏸️</span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-gray-700">
                {staff ? inactiveCount : "—"}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Sign-in suspended</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-md transition">
              <div className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Covered Shops</span>
                <span className="text-base">🏪</span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
                {coveredShopsCount}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Out of {shops.length} shops</div>
            </div>
          </div>

          {/* 3. SEARCH, SORT & VIEW SWITCHER BAR */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-gray-900 flex items-center gap-2">
                <span>Our Staff Members</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200/80">
                  {filteredStaff.length}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Search, inspect permissions, reset passwords and toggle live access
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-800 focus:bg-white focus:border-emerald-600 outline-none transition"
                />
                <span className="absolute left-2.5 top-2.5 text-xs text-gray-400">🔍</span>
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 focus:bg-white focus:border-emerald-600 outline-none"
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="status">Sort: Active First</option>
                <option value="recent">Sort: Newest Added</option>
              </select>

              {/* Grid / List View Toggle */}
              <div className="flex items-center rounded-xl border border-gray-200 p-0.5 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsListView(false)}
                  title="Grid View"
                  className={`p-1.5 rounded-lg text-xs transition ${
                    !isListView
                      ? "bg-white text-emerald-700 shadow-xs font-bold"
                      : "text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setIsListView(true)}
                  title="List View"
                  className={`p-1.5 rounded-lg text-xs transition ${
                    isListView
                      ? "bg-white text-emerald-700 shadow-xs font-bold"
                      : "text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 4. STAFF CARDS (GRID VIEW & LIST VIEW) */}
          {staff === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-10 bg-gray-100 rounded-xl" />
                  <div className="h-9 bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl mx-auto border border-emerald-100">
                👥
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {staff.length ? "No staff match your current search" : "No staff accounts added yet"}
              </h2>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                {staff.length
                  ? "Try clearing filters or searching with a different name, email, or role."
                  : "Add branch managers, cashiers and team members so they can log into NSYU with their own email and password."}
              </p>
              <div className="pt-2">
                {staff.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole("all");
                      setSelectedShop("all");
                      setSelectedStatus("all");
                      setQuery("");
                    }}
                    className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="px-6 py-2.5 rounded-full bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs transition shadow-md"
                  >
                    + Add First Staff Member
                  </button>
                )}
              </div>
            </div>
          ) : isListView ? (
            /* ==================== LIST VIEW ==================== */
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider text-[10px] font-bold border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Shop & Role Assignments</th>
                      <th className="py-3 px-4 text-center">Live Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredStaff.map((s) => {
                      const initials = s.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();
                      const assignments = s.shopAssignments || [];

                      return (
                        <tr key={s.id} className="hover:bg-emerald-50/30 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-xs ${
                                  s.status === "active"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-gray-200 text-gray-500"
                                }`}
                              >
                                {initials}
                              </span>
                              <div>
                                <div className="font-bold text-gray-900 text-xs">{s.name}</div>
                                <div className="text-[10px] text-gray-400">ID #{s.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-gray-800">{s.email}</div>
                            {s.phone && (
                              <div className="text-[11px] text-gray-400">{s.phone}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {assignments.length === 0 ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10.5px] font-bold">
                                  ⚠️ No shop assigned
                                </span>
                              ) : (
                                assignments.map((a) => {
                                  const style = getRoleBadgeStyle(a.role?.name || "");
                                  return (
                                    <span
                                      key={a.id}
                                      className={`px-2 py-0.5 rounded-md border text-[10.5px] font-semibold flex items-center gap-1 ${style.bg}`}
                                    >
                                      <span>🏪 {a.shop?.name || `Shop #${a.shop_id}`}</span>
                                      <span className="font-bold text-gray-900">· {a.role?.name || "Role"}</span>
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              title={s.status === "active" ? "Click to deactivate" : "Click to activate"}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                                s.status === "active"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  s.status === "active" ? "bg-emerald-600 animate-pulse" : "bg-gray-400"
                                }`}
                              />
                              <span>{s.status === "active" ? "Active" : "Inactive"}</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setResettingPwStaff(s)}
                                title="Reset Password"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 text-xs transition"
                              >
                                🔑
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(s)}
                                className="px-3 py-1.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs transition shadow-xs"
                              >
                                Manage
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ==================== GRID VIEW (Market Shop Cards Style) ==================== */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((s, idx) => {
                const initials = s.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const assignments = s.shopAssignments || [];
                const primaryRole = assignments[0]?.role?.name || "Staff Member";
                const roleStyle = getRoleBadgeStyle(primaryRole);
                const gradient = CARD_COVER_GRADIENTS[idx % CARD_COVER_GRADIENTS.length];

                return (
                  <div
                    key={s.id}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Banner with Role Pill & Status Switch */}
                      <div className={`h-24 w-full bg-gradient-to-r ${gradient} relative p-3 flex items-start justify-between`}>
                        {/* Role Badge */}
                        <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-gray-900 font-extrabold text-[10.5px] shadow-xs flex items-center gap-1">
                          <span>{roleStyle.icon}</span>
                          <span className="truncate max-w-[120px]">{primaryRole}</span>
                        </span>

                        {/* Live Toggle Switch (Directly on Card!) */}
                        <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-xs px-2 py-1 rounded-full border border-white/20">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                            {s.status === "active" ? "LIVE" : "OFF"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(s);
                            }}
                            aria-label={`Toggle live status for ${s.name}`}
                            className={`w-7 h-4 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                              s.status === "active" ? "bg-emerald-400 justify-end" : "bg-gray-400 justify-start"
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>
                      </div>

                      {/* Card Body with Avatar & Details */}
                      <div className="p-4 pt-0 relative">
                        {/* Floating Avatar */}
                        <div className="-mt-8 mb-3 flex items-end justify-between">
                          <div
                            className={`w-14 h-14 rounded-2xl ring-4 ring-white shadow-md flex items-center justify-center text-lg font-black ${
                              s.status === "active"
                                ? "bg-[#064E3B] text-white"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {initials}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-mono">ID #{s.id}</span>
                          </div>
                        </div>

                        {/* Name & Contact */}
                        <div className="space-y-1">
                          <h3 className="font-bold text-gray-900 text-[15px] truncate group-hover:text-emerald-700 transition">
                            {s.name}
                          </h3>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                            <span className="text-gray-400">✉️</span>
                            <span className="truncate">{s.email}</span>
                          </div>
                          {s.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                              <span className="text-gray-400">📞</span>
                              <span>{s.phone}</span>
                            </div>
                          )}
                        </div>

                        {/* Shop Assignments Pills */}
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Branch Access ({assignments.length})
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto scrollbar-thin">
                            {assignments.length === 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10.5px] font-bold">
                                ⚠️ No branch assigned
                              </span>
                            ) : (
                              assignments.map((a) => (
                                <span
                                  key={a.id}
                                  className="px-2 py-0.5 rounded-md bg-gray-50 text-gray-700 border border-gray-200 text-[10.5px] font-medium flex items-center gap-1"
                                >
                                  <span>🏪</span>
                                  <span className="font-bold text-gray-900 truncate max-w-[100px]">
                                    {a.shop?.name || `Shop #${a.shop_id}`}
                                  </span>
                                  <span className="text-gray-400">({a.role?.name || "Role"})</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions (Market Style buttons) */}
                    <div className="p-4 pt-0 mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="flex-1 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs hover:scale-[1.02] active:scale-95 cursor-pointer"
                      >
                        <span>Manage Staff</span>
                        <span>→</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResettingPwStaff(s)}
                        title="Reset Password"
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                      >
                        🔑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ADD STAFF MODAL DIALOG                                         */}
      {/* ============================================================== */}
      {creating && (
        <CreateDialog
          shops={shops}
          roles={staffRoles}
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false);
            flash(`${name} created successfully! They can now sign in with their email.`);
            load();
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MANAGE STAFF MODAL DIALOG                                      */}
      {/* ============================================================== */}
      {editing && (
        <ManageDialog
          staff={editing}
          shops={shops}
          roles={staffRoles}
          onClose={() => setEditing(null)}
          onChanged={(msg, updated) => {
            flash(msg);
            if (updated) setEditing(updated);
            load();
          }}
        />
      )}

      {/* ============================================================== */}
      {/* QUICK RESET PASSWORD MODAL DIALOG                              */}
      {/* ============================================================== */}
      {resettingPwStaff && (
        <ResetPasswordDialog
          staff={resettingPwStaff}
          onClose={() => setResettingPwStaff(null)}
          onSuccess={(msg) => {
            flash(msg);
            setResettingPwStaff(null);
          }}
        />
      )}
    </div>
  );
}

// ====================================================================
// MODAL DIALOG SHELL
// ====================================================================
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-navy-950/50 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100"
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 h-16 border-b border-gray-100 z-10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm">
              👥
            </span>
            <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}

// ====================================================================
// CREATE STAFF MEMBER MODAL
// ====================================================================
function CreateDialog({
  shops,
  roles,
  onClose,
  onCreated,
}: {
  shops: Shop[];
  roles: Role[];
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    shopId: shops[0]?.id ? String(shops[0].id) : "",
    roleId: roles[0]?.id ? String(roles[0].id) : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.roleId || !form.shopId) {
      return setError("Choose the shop and the role for this staff member.");
    }
    setBusy(true);
    try {
      await createEmployee({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        shopId: Number(form.shopId),
        roleId: Number(form.roleId),
      });
      onCreated(form.name.trim());
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create the staff account"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add Staff Member" onClose={onClose}>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
          <input
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none transition"
            required
            placeholder="e.g. Rahul Sharma"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Email (Sign-in ID)</label>
          <input
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none transition"
            type="email"
            required
            placeholder="rahul@store.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
          <input
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none transition"
            type="tel"
            placeholder="98765 43210"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Initial Password
          </label>
          <input
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none transition"
            type="text"
            minLength={8}
            required
            placeholder="Min 8 characters (e.g. Rahul@1234)"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
          />
          <span className="block mt-1 text-[11px] text-gray-400">
            Share this privately; you can reset it anytime from the dashboard.
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Shop</label>
          <select
            className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-800 focus:bg-white focus:border-emerald-600 outline-none"
            value={form.shopId}
            onChange={(e) => set("shopId", e.target.value)}
            required
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Role in Shop</label>
          <select
            className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-800 focus:bg-white focus:border-emerald-600 outline-none"
            value={form.roleId}
            onChange={(e) => set("roleId", e.target.value)}
            required
          >
            <option value="">Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs transition shadow-md disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ====================================================================
// MANAGE STAFF MEMBER MODAL
// ====================================================================
function ManageDialog({
  staff,
  shops,
  roles,
  onClose,
  onChanged,
}: {
  staff: StaffRow;
  shops: Shop[];
  roles: Role[];
  onClose: () => void;
  onChanged: (msg: string, updated?: StaffRow) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: staff.name, phone: staff.phone || "" });
  const [password, setPassword] = useState("");
  const assigned = staff.shopAssignments || [];
  const unassigned = shops.filter((s) => !assigned.some((a) => a.shop_id === s.id));
  const [add, setAdd] = useState({
    shopId: unassigned[0]?.id ? String(unassigned[0].id) : "",
    roleId: roles[0]?.id ? String(roles[0].id) : "",
  });

  const run = async (key: string, fn: () => Promise<any>, msg: string) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      const updated =
        res?.data?.data && res.data.data.shopAssignments
          ? (res.data.data as StaffRow)
          : undefined;
      onChanged(msg, updated);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save the change"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog title={`Manage ${staff.name}`} onClose={onClose}>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {error}
        </p>
      )}

      {/* 1. Profile Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
            Profile Details
          </h3>
          <span className="text-xs text-gray-400">
            Signs in as <b className="text-gray-900">{staff.email}</b>
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
            <input
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:border-emerald-600 outline-none"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
            <input
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:border-emerald-600 outline-none"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition disabled:opacity-50"
          disabled={busy !== null}
          onClick={() =>
            run(
              "profile",
              () => updateEmployee(staff.id, { name: profile.name, phone: profile.phone }),
              "Profile updated successfully."
            )
          }
        >
          {busy === "profile" ? "Saving…" : "Save Profile"}
        </button>
      </section>

      {/* 2. Shops & Roles Section */}
      <section className="space-y-3 pt-4 border-t border-gray-100">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
          Branch & Role Assignments
        </h3>
        {assigned.length === 0 && (
          <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            ⚠️ Not assigned to any shop yet — this person cannot sign in until a branch is assigned.
          </p>
        )}
        <div className="space-y-2">
          {assigned.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5 bg-gray-50/50"
            >
              <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                <span>🏪</span>
                <span>{a.shop?.name || `Shop #${a.shop_id}`}</span>
              </span>
              <div className="flex items-center gap-2">
                <select
                  className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs font-bold text-emerald-800 focus:border-emerald-600 outline-none"
                  aria-label={`Role in ${a.shop?.name || "shop"}`}
                  value={a.role_id}
                  disabled={busy !== null}
                  onChange={(e) =>
                    run(
                      `role-${a.id}`,
                      () =>
                        assignShopRole({
                          employeeId: staff.id,
                          shopId: a.shop_id,
                          roleId: Number(e.target.value),
                        }),
                      "Role updated — applies immediately."
                    )
                  }
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition"
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      `rm-${a.id}`,
                      () =>
                        removeShopAssignment({
                          employeeId: staff.id,
                          shopId: a.shop_id,
                        }),
                      "Removed from shop branch."
                    )
                  }
                  title="Remove from branch"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {unassigned.length > 0 && (
          <div className="pt-2">
            <div className="text-[11px] font-bold text-gray-500 mb-1.5">Assign To Another Branch:</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-800 flex-1 min-w-[130px]"
                value={add.shopId}
                onChange={(e) => setAdd({ ...add, shopId: e.target.value })}
              >
                {unassigned.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-800 flex-1 min-w-[120px]"
                value={add.roleId}
                onChange={(e) => setAdd({ ...add, roleId: e.target.value })}
              >
                <option value="">Choose role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="h-9 px-4 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs transition disabled:opacity-50"
                disabled={busy !== null || !add.roleId || !add.shopId}
                onClick={() =>
                  run(
                    "add",
                    () =>
                      assignShopRole({
                        employeeId: staff.id,
                        shopId: Number(add.shopId),
                        roleId: Number(add.roleId),
                      }),
                    "Branch and role assigned."
                  )
                }
              >
                + Assign
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Password Reset Section */}
      <section className="space-y-2 pt-4 border-t border-gray-100">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
          Reset Password
        </h3>
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
            type="text"
            placeholder="New password (8+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition disabled:opacity-50"
            disabled={busy !== null || password.length < 8}
            onClick={() =>
              run(
                "pw",
                () => resetEmployeePassword(staff.id, password),
                "Password changed successfully. Existing sessions terminated."
              ).then(() => setPassword(""))
            }
          >
            {busy === "pw" ? "Saving…" : "Set Password"}
          </button>
        </div>
      </section>

      {/* 4. Live Status Section */}
      <section className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-gray-900">
            Account Status:{" "}
            <span
              className={staff.status === "active" ? "text-emerald-700 font-black" : "text-gray-500 font-bold"}
            >
              {staff.status === "active" ? "Active" : "Deactivated"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {staff.status === "active"
              ? "Deactivating signs them out at once and blocks future logins."
              : "Reactivating allows them to log in again with their password."}
          </p>
        </div>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            staff.status === "active"
              ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
          }`}
          disabled={busy !== null}
          onClick={() =>
            run(
              "status",
              () =>
                setEmployeeStatus(
                  staff.id,
                  staff.status === "active" ? "inactive" : "active"
                ),
              staff.status === "active"
                ? `${staff.name} was deactivated.`
                : `${staff.name} can sign in again.`
            ).then(onClose)
          }
        >
          {staff.status === "active" ? "Deactivate Account" : "Re-activate Account"}
        </button>
      </section>
    </Dialog>
  );
}

// ====================================================================
// QUICK PASSWORD RESET MODAL
// ====================================================================
function ResetPasswordDialog({
  staff,
  onClose,
  onSuccess,
}: {
  staff: StaffRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setBusy(true);
    setError(null);
    try {
      await resetEmployeePassword(staff.id, password);
      onSuccess(`Password updated for ${staff.name}. They have been signed out of other devices.`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not reset password"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={`Reset Password: ${staff.name}`} onClose={onClose}>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            New Password for {staff.email}
          </label>
          <input
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
            type="text"
            minLength={8}
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Setting a new password will terminate any existing active sessions for this account.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs shadow-md disabled:opacity-50"
            disabled={busy || password.length < 8}
          >
            {busy ? "Saving…" : "Update Password"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
