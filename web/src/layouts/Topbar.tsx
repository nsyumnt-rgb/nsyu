import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { listShops, switchShop } from "../api/shops";
import { logout as logoutApi } from "../api/auth";
import { resolveReferenceApi, type ResolvedReference } from "../api/reference";
import type { Shop } from "../types";

export default function Topbar() {
  const navigate = useNavigate();
  const accountType = useAuthStore((s) => s.accountType);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const roleName = useAuthStore((s) => s.roleName);
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ResolvedReference | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const shopMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listShops().then((res) => setShops(res.data.data ?? []));
  }, []);

  useEffect(() => {
    const current = shops.find((s) => s.id === shopId);
    if (current) setActiveShop(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, shopId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (shopMenuRef.current && !shopMenuRef.current.contains(e.target as Node)) {
        setShopOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
        // Resolve immediately
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

  async function handleSwitch(id: number) {
    setSwitching(true);
    try {
      const res = await switchShop(id);
      const { accessToken, shop } = res.data.data!;
      const employeeShopEntry = shops.find((s) => s.id === id);
      setAccessToken(accessToken, shop.id, employeeShopEntry?.roleId ?? null, employeeShopEntry?.roleName ?? null);
      setActiveShop(shop);
      setShopOpen(false);
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {
        // best-effort — clear local session regardless
      }
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

  const displayName = accountType === "owner" ? (owner?.name || "Mohd Nazim") : employee?.name;
  const displayRole = accountType === "owner" ? "Owner" : (roleName || "Staff");

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-30 shadow-xs">
      {/* Left: Global Search Bar */}
      <div className="relative w-80 md:w-96" ref={searchContainerRef}>
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
          className="w-full pl-9 pr-4 py-2 text-[13px] rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-slate-400 text-slate-700"
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
      <div className="flex items-center gap-3 md:gap-4">
        {/* Shop Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-500 hidden sm:inline">Shop</span>
          <div className="relative" ref={shopMenuRef}>
            <button
              onClick={() => setShopOpen((v) => !v)}
              disabled={switching}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <svg className="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="max-w-[160px] truncate">{activeShop?.name || "Main Shop - Electronics"}</span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {shopOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200/90 p-2 z-50">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Active Shop
                </div>
                {shops.length === 0 && <div className="px-2.5 py-2 text-xs text-slate-500">No shops available.</div>}
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSwitch(s.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors text-left ${
                        s.id === shopId ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="truncate">
                        <span className="block truncate">{s.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{s.code}</span>
                      </div>
                      {s.id === shopId && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
                {accountType === "owner" && (
                  <button
                    onClick={() => {
                      setShopOpen(false);
                      navigate("/app/shops");
                    }}
                    className="w-full text-left rounded-lg px-2.5 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 mt-1 border-t border-slate-100 pt-2 flex items-center gap-1.5"
                  >
                    <span>+</span> Manage All Shops
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
            3
          </span>
        </button>

        {/* Fullscreen Expand Icon */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-xs">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
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
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200/90 py-1.5 z-50">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-800">{displayName}</div>
                <div className="text-[11px] text-slate-400">{displayRole}</div>
              </div>
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
    </header>
  );
}

