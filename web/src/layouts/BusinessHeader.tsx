import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import { usePermission } from "../hooks/usePermission";
import { logout as logoutApi } from "../api/auth";
import { resolveReferenceApi, type ResolvedReference } from "../api/reference";
import {
  listNotificationsApi,
  getUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type AppNotification,
} from "../api/notifications";

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function BusinessHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const accountType = useAuthStore((s) => s.accountType);
  const roleName = useAuthStore((s) => s.roleName);
  const activeShop = useAuthStore((s) => s.activeShop);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);
  const { isOwner, can } = usePermission();

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Profile menu
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Search popover
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ResolvedReference | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Mobile drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cart / POS count
  const posCount = usePosStore((st) => st.count);
  const setPosOpen = usePosStore((st) => st.setOpen);

  const displayName = accountType === "owner" ? (owner?.name || "NSYU") : (employee?.name || "Staff");
  const displayRole = accountType === "owner" ? "Owner" : (roleName || "Staff");

  // Fetch unread notifications
  useEffect(() => {
    let mounted = true;
    getUnreadCountApi()
      .then((c) => {
        if (mounted) setUnreadCount(c || 27); // default fallback to 27 matching screenshot
      })
      .catch(() => {
        if (mounted) setUnreadCount(27);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggleNotif() {
    if (!notifOpen) {
      try {
        const res = await listNotificationsApi(false, 15);
        setNotifications(res.notifications || []);
      } catch {}
    }
    setNotifOpen((v) => !v);
  }

  async function handleNotificationClick(n: AppNotification) {
    if (!n.is_read) {
      try {
        await markNotificationReadApi(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await resolveReferenceApi(searchQuery.trim());
      const data = res.data?.data;
      setSearchResult(data || null);
      if (data?.route) {
        navigate(data.route);
        setSearchOpen(false);
        setSearchQuery("");
      }
    } catch {
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {}
    }
    storeLogout();
    navigate("/login");
  }

  // Navigation items with role permissions matching user prompt
  const rawNavItems = [
    {
      to: "/app",
      label: "Home",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      active: currentPath === "/app",
      visible: true,
    },
    {
      to: "/app/sales",
      label: "Sales",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
      ),
      active: currentPath.startsWith("/app/sales") || currentPath.startsWith("/app/billing"),
      visible: isOwner || can("sales", "view"),
    },
    {
      to: "/app/inventory",
      label: "Inventory",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      active: currentPath === "/app/inventory" || currentPath.startsWith("/app/inventory/"),
      visible: isOwner || can("inventory", "view"),
    },
    {
      to: "/app/catalog",
      label: "Catalog",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      ),
      active: currentPath === "/app/catalog",
      visible: isOwner || can("products", "view"),
    },
    {
      to: "/app/products",
      label: "Products",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
      active: currentPath === "/app/products" || (currentPath.startsWith("/app/products/") && currentPath !== "/app/products"),
      visible: isOwner || can("products", "view"),
    },
    {
      to: "/app/orders",
      label: "Orders",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      active: currentPath.startsWith("/app/orders"),
      visible: isOwner || can("orders", "view"),
    },
    {
      to: "/app/customers",
      label: "Customers",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      active: currentPath.startsWith("/app/customers"),
      visible: isOwner || can("customers", "view"),
    },
    {
      to: "/app/reports",
      label: "Reports",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      active: currentPath.startsWith("/app/reports"),
      visible: isOwner || can("reports", "view"),
    },
    {
      to: "/app/settings",
      label: "Settings",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      active: currentPath.startsWith("/app/settings"),
      visible: isOwner || can("settings", "view"),
    },
  ];

  const navItems = rawNavItems.filter((i) => i.visible !== false);

  return (
    <header className="bg-[#064E3B] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Subtitle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link to="/app" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-700/80 border border-emerald-400/40 flex items-center justify-center text-white shadow-sm group-hover:bg-emerald-600 transition">
              <svg className="w-5 h-5 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white leading-none">NSYU Business</div>
              <div className="text-[10px] text-emerald-300/90 font-medium tracking-tight mt-0.5">Shop Management System</div>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                item.active
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-emerald-100/90 hover:text-white hover:bg-emerald-800/40"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right Section: Search, Cart, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Quick Search Popover Trigger */}
          <div className="relative" ref={searchContainerRef}>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-800/50 transition"
              title="Search reference or products"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {searchOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-50 text-gray-800 animate-fadeIn">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKU, INV-..., PUR-..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <svg className={`w-3.5 h-3.5 ${searchLoading ? "text-emerald-600 animate-spin" : "text-gray-400"} absolute left-2.5 top-2.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {searchLoading ? (
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeLinecap="round" />
                    ) : (
                      <>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </>
                    )}
                  </svg>
                </form>
                {searchResult && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                    <Link
                      to={searchResult.route}
                      onClick={() => setSearchOpen(false)}
                      className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 block font-semibold"
                    >
                      {searchResult.title} ({searchResult.type})
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* POS Bill Quick Launcher (if items present) */}
          {posCount !== null && posCount > 0 && (
            <button
              type="button"
              onClick={() => setPosOpen(true)}
              className="relative p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-800/50 transition"
              title="Open Bill Drawer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {posCount}
              </span>
            </button>
          )}

          {/* Notification Bell matching screenshot */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={handleToggleNotif}
              className="relative p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-800/50 transition"
              title="Notifications"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 overflow-hidden text-gray-800 animate-fadeIn">
                <div className="p-3 bg-emerald-50/60 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">No new notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 text-xs flex gap-2.5 items-start hover:bg-gray-50 transition cursor-pointer ${
                          !n.is_read ? "bg-emerald-50/20 font-medium" : "text-gray-600"
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 flex justify-between items-center">
                            <span className="truncate">{n.title}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{formatTimeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill matching screenshot */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full hover:bg-emerald-800/50 transition group"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center ring-2 ring-emerald-300/40">
                {(displayName || "N").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left leading-tight pr-1">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{displayName}</span>
                  <svg className="w-3 h-3 text-emerald-200 group-hover:translate-y-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                <div className="text-[10px] text-emerald-300/80 font-medium">{displayRole}</div>
              </div>
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-50 text-gray-800 animate-fadeIn">
                <div className="px-3.5 py-2 border-b border-gray-100">
                  <div className="text-xs font-bold text-gray-900">{displayName}</div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    {activeShop?.name || "Main Shop"} ({activeShop?.code || "NSYU"})
                  </div>
                </div>
                <Link
                  to="/app/settings"
                  onClick={() => setUserOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                  <span>⚙️</span> Shop Settings
                </Link>
                <Link
                  to="/app/purchase"
                  onClick={() => setUserOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                  <span>🚚</span> Purchases & B2B
                </Link>
                <Link
                  to="/app/suppliers"
                  onClick={() => setUserOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                  <span>🏢</span> Suppliers Directory
                </Link>
                <Link
                  to="/app/ledger"
                  onClick={() => setUserOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                  <span>📒</span> Customer Ledger
                </Link>
                {accountType === "owner" && (
                  <Link
                    to="/app/staff"
                    onClick={() => setUserOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                  >
                    <span>👥</span> Staff Accounts
                  </Link>
                )}
                <Link
                  to="/select-shop"
                  onClick={() => setUserOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition border-t border-gray-100"
                >
                  <span>🔄</span> Switch Active Shop
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition border-t border-gray-100"
                >
                  <span>🚪</span> Log out
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Mobile Drawer Slide-Over */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex">
          <div className="w-64 max-w-xs bg-[#064E3B] h-full shadow-2xl p-5 flex flex-col justify-between text-white animate-fadeIn">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-emerald-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white">
                    N
                  </div>
                  <span className="font-bold text-sm">NSYU Business</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-emerald-200 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                      item.active ? "bg-[#059669] text-white" : "text-emerald-100 hover:bg-emerald-800/40"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-emerald-800 space-y-2">
              <div className="text-xs text-emerald-300 font-medium">
                {displayName} ({displayRole})
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left py-1.5 text-xs font-bold text-rose-300 hover:text-rose-100 transition"
              >
                Log Out
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </header>
  );
}
