import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import { listShops, switchShop } from "../api/shops";
import { logout as logoutApi } from "../api/auth";
import { resolveReferenceApi, type ResolvedReference } from "../api/reference";
import {
  listNotificationsApi,
  getUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type AppNotification,
} from "../api/notifications";
import type { Shop } from "../types";
import PosCartDrawer from "../components/PosCartDrawer";

function parseNotificationDate(raw?: any): Date {
  if (!raw) return new Date();
  const candidate =
    typeof raw === "string" || typeof raw === "number" || raw instanceof Date
      ? raw
      : raw.created_at || raw.createdAt || raw.date;
  if (!candidate) return new Date();
  const d = new Date(candidate);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatNotificationTime(raw?: any): string {
  const d = parseNotificationDate(raw);
  try {
    return d.toLocaleString("en-IN", {
      dateStyle: "full",
      timeStyle: "medium",
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatTimeAgo(raw?: any): string {
  try {
    const d = parseNotificationDate(raw);
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN");
  } catch {
    return "Recently";
  }
}

function getNotifVisuals(type: string) {
  switch (type) {
    case "bill_created":
      return {
        bg: "bg-blue-50 text-blue-600 border-blue-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      };
    case "sale_cancelled":
      return {
        bg: "bg-rose-50 text-rose-600 border-rose-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      };
    case "payment_received":
      return {
        bg: "bg-emerald-50 text-emerald-600 border-emerald-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
      };
    case "low_stock":
      return {
        bg: "bg-amber-50 text-amber-600 border-amber-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "order_placed":
    case "order_status_changed":
      return {
        bg: "bg-indigo-50 text-indigo-600 border-indigo-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        ),
      };
    default:
      return {
        bg: "bg-slate-100 text-slate-600 border-slate-200",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ),
      };
  }
}

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const navigate = useNavigate();
  const accountType = useAuthStore((s) => s.accountType);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const roleName = useAuthStore((s) => s.roleName);
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const posCount = usePosStore((s) => s.count);
  const setPosOpen = usePosStore((s) => s.setOpen);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [switchingShopId, setSwitchingShopId] = useState<number | null>(null);
  const shopMenuRef = useRef<HTMLDivElement>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ResolvedReference | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listShops().then((res) => setShops(res.data.data ?? []));
  }, []);

  useEffect(() => {
    const current = shops.find((s) => s.id === shopId);
    if (current) setActiveShop(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, shopId]);

  async function handleShopSwitch(s: Shop) {
    if (s.id === shopId) {
      setShopMenuOpen(false);
      return;
    }
    setSwitchingShopId(s.id);
    try {
      const res = await switchShop(s.id);
      const { accessToken } = res.data.data!;
      setAccessToken(accessToken, s.id, s.roleId ?? null, s.roleName ?? null);
      setActiveShop(s);
      setShopMenuOpen(false);
    } catch (err) {
      console.error("Failed to switch shop:", err);
    } finally {
      setSwitchingShopId(null);
    }
  }

  // Click outside listener for all popovers
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (shopMenuRef.current && !shopMenuRef.current.contains(e.target as Node)) {
        setShopMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Poll unread notification count
  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadCountApi();
      setUnreadCount(count);
    } catch {
      // Ignore background poll errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const data = await listNotificationsApi();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const toggleNotifDropdown = () => {
    if (!notifOpen) {
      setNotifOpen(true);
      loadNotifications();
    } else {
      setNotifOpen(false);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    if (n.is_read) return;
    try {
      await markNotificationReadApi(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleNotifClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationReadApi(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }

    setNotifOpen(false);
    setSelectedNotif(n);
  };

  // Debounced search on input
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResult(null);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await resolveReferenceApi(trimmed);
        if (res.data.success && res.data.data) {
          setSearchResult(res.data.data);
          setSearchOpen(true);
        } else {
          setSearchResult(null);
        }
      } catch {
        setSearchResult(null);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchQuery.trim()) {
      if (searchResult) {
        navigate(searchResult.route);
        setSearchOpen(false);
        setSearchQuery("");
      } else {
        resolveReferenceApi(searchQuery.trim())
          .then((res) => {
            if (res.data.success && res.data.data) {
              navigate(res.data.data.route);
              setSearchOpen(false);
              setSearchQuery("");
            }
          })
          .catch(() => {});
      }
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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const displayName = accountType === "owner" ? (owner?.name || "Owner") : (employee?.name || "Staff");
  const displayRole = accountType === "owner" ? "Owner" : (roleName || "Staff");

  const displayedNotifications =
    notifFilter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  return (
    <header className="h-16 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 border-b border-border flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
      {/* Mobile: open navigation drawer */}
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden -ml-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-navy-900 transition-colors shrink-0"
        aria-label="Open navigation"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="14" y2="17" />
        </svg>
      </button>
      {/* Left: Global Search Bar */}
      <div className="relative flex-1 min-w-0 max-w-md" ref={searchContainerRef}>
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
          {searchLoading ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => {
            if (searchResult) setSearchOpen(true);
          }}
          placeholder="Search reference (INV-..., PUR-..., TRF-..., SKU...)"
          className="w-full pl-9 pr-4 py-2 text-[13px] rounded-xl border border-border bg-slate-50/80 hover:bg-white focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all placeholder:text-slate-400 text-slate-700"
        />

        {/* Live Search Quick Result Dropdown */}
        {searchOpen && searchResult && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200/90 p-2 z-50">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
              <span>Matching Record</span>
              <span className="text-[10px] lowercase text-slate-400">Press Enter ↵ to open</span>
            </div>
            <button
              onClick={() => {
                navigate(searchResult.route);
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-50/80 transition-colors text-left group"
            >
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                  {searchResult.title}
                </p>
                <p className="text-[11px] font-mono text-slate-500 truncate">
                  {searchResult.reference}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 shrink-0">
                {searchResult.type}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Interactive Active Shop Switcher */}
        <div className="relative" ref={shopMenuRef}>
          <button
            type="button"
            onClick={() => setShopMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2.5 pr-2 sm:pr-3 py-1.5 bg-brand-50/80 hover:bg-brand-100/90 border border-brand-200/70 rounded-xl text-[12px] sm:text-[13px] font-semibold text-navy-900 transition-colors shadow-2xs cursor-pointer"
            title="Click to switch shop"
            aria-expanded={shopMenuOpen}
          >
            <svg className="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="max-w-[100px] sm:max-w-[140px] truncate">{activeShop?.name || "Main Shop"}</span>
            <span className="hidden sm:inline text-[11px] font-mono text-slate-400">({activeShop?.code || "NSYU-01"})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${shopMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {shopMenuOpen && (
            <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-64 bg-white rounded-xl shadow-lift border border-border py-1.5 z-50 animate-fade-in divide-y divide-slate-100">
              <div className="px-3.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Assigned Shops</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Switch branch to manage its inventory & billing</div>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {shops.length === 0 ? (
                  <div className="px-3.5 py-2 text-xs text-slate-400 italic">No shops available</div>
                ) : (
                  shops.map((s) => {
                    const isActive = s.id === shopId;
                    const isSwitching = switchingShopId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleShopSwitch(s)}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                          isActive ? "bg-emerald-50/80 text-emerald-900 font-semibold" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{s.name}</span>
                            {s.roleName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-normal">
                                {s.roleName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">{s.code}</div>
                        </div>
                        {isSwitching ? (
                          <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : isActive ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
              {accountType === "owner" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShopMenuOpen(false);
                      navigate("/app/shops");
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-1.5"
                  >
                    <span>+</span> Manage All Shops
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* POS Cart / Current Bill Button */}
        <button
          type="button"
          onClick={() => setPosOpen(true)}
          className={`relative h-10 px-3 rounded-xl transition-colors flex items-center ${
            posCount && posCount > 0
              ? "bg-brand-50 text-brand-700 hover:bg-brand-100 ring-1 ring-brand-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          }`}
          title="Current Bill / POS Cart"
          aria-label={`Current Bill, ${posCount || 0} item${posCount === 1 ? "" : "s"}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
          {posCount && posCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs leading-none">
              {posCount > 99 ? "99+" : posCount}
            </span>
          ) : null}
        </button>

        {/* Notification Bell with Real Live Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={toggleNotifDropdown}
            className={`relative p-2 rounded-lg transition-colors ${
              notifOpen ? "bg-slate-100 text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Notifications"
            aria-label="Notifications"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex min-w-[16px] h-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Interactive Notifications Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-slate-100 px-3 pt-2 bg-slate-50/50">
                <button
                  onClick={() => setNotifFilter("all")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                    notifFilter === "all"
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter("unread")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                    notifFilter === "unread"
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Notification List Body */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {loadingNotifs ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading notifications...</span>
                  </div>
                ) : displayedNotifications.length === 0 ? (
                  <div className="py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">No notifications</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {notifFilter === "unread" ? "You have read all your notifications!" : "You're all caught up."}
                    </p>
                  </div>
                ) : (
                  displayedNotifications.map((n) => {
                    const visuals = getNotifVisuals(n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`p-3.5 flex items-start gap-3 hover:bg-slate-50/80 cursor-pointer transition-colors relative group ${
                          !n.is_read ? "bg-blue-50/30" : "bg-white"
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visuals.bg}`}
                        >
                          {visuals.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4
                              className={`text-[12px] truncate ${
                                !n.is_read ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                              }`}
                            >
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                              {formatTimeAgo(n.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </div>

                        {/* Status Dot / Mark as read trigger */}
                        <div className="shrink-0 flex items-center self-center">
                          {!n.is_read ? (
                            <button
                              onClick={(e) => handleMarkAsRead(e, n)}
                              title="Mark as read"
                              className="w-2.5 h-2.5 rounded-full bg-blue-600 hover:ring-4 hover:ring-blue-100 transition-all"
                            />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Expand Icon */}
        <button
          onClick={toggleFullscreen}
          className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Toggle Fullscreen"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>

        {/* User Profile Pill */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2.5 p-1 sm:pr-2.5 rounded-xl hover:bg-slate-100/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center font-semibold text-[12px] ring-2 ring-white shadow-sm">
              {(displayName || "U").trim().charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[13px] font-semibold text-slate-800 leading-tight">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-400 font-medium leading-tight">
                {displayRole}
              </div>
            </div>
          </button>

          {userOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lift border border-border py-1.5 z-50 animate-fade-in">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-800">{displayName}</div>
                <div className="text-[11px] text-slate-400">{displayRole}</div>
              </div>
              <button
                onClick={() => {
                  setUserOpen(false);
                  setShopMenuOpen(true);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span>🏪</span> Switch Shop
              </button>
              <button
                onClick={() => {
                  setUserOpen(false);
                  navigate("/app/settings");
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span>⚙️</span> Settings & Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 border-t border-slate-100 mt-1"
              >
                <span>🚪</span> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* POS Cart Drawer */}
      <PosCartDrawer />

      {/* Notification Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    getNotifVisuals(selectedNotif.type).bg
                  }`}
                >
                  {getNotifVisuals(selectedNotif.type).icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {selectedNotif.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatTimeAgo(selectedNotif.created_at)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {selectedNotif.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Date/Time */}
            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
              <span>📅</span>
              <span>{formatNotificationTime(selectedNotif)}</span>
            </div>

            {/* Full Message Body */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {selectedNotif.message}
            </div>

            {/* Reference Entity Details & Direct Action Button */}
            {selectedNotif.reference_type && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-500 font-medium">Reference: </span>
                  <span className="font-bold text-blue-900 capitalize">
                    {selectedNotif.reference_type}{" "}
                    {selectedNotif.reference_id ? `#${selectedNotif.reference_id}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ref = (selectedNotif.reference_type || "").toLowerCase();
                    setSelectedNotif(null);
                    if (ref === "sale") navigate("/app/sales");
                    else if (ref === "order") navigate("/app/orders");
                    else if (ref === "payment" || ref === "customerledger") navigate("/app/ledger");
                    else if (ref === "product") navigate("/app/inventory");
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <span>Open {selectedNotif.reference_type}</span>
                  <span>→</span>
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
