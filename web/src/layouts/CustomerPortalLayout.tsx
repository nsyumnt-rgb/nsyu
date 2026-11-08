import { useEffect, useState, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { logoutCustomerApi, getCartApi, getPortalUnreadCountApi } from "../api/portal";

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const unreadCount = usePortalStore((s) => s.unreadCount);
  const setCart = usePortalStore((s) => s.setCart);
  const setUnreadCount = usePortalStore((s) => s.setUnreadCount);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread notifications & cart count periodically or on route change
  useEffect(() => {
    getPortalUnreadCountApi().then(setUnreadCount).catch(() => {});
    getCartApi().then(setCart).catch(() => {});
  }, [location.pathname, setCart, setUnreadCount]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutCustomerApi();
    navigate("/portal/login", { replace: true });
  };

  const navLinks = [
    { label: "Dashboard", path: "/portal/home", icon: HomeIcon },
    { label: "Catalog", path: "/portal/catalog", icon: CatalogIcon },
    { label: "Orders", path: "/portal/orders", icon: OrdersIcon },
    { label: "Bills & Invoices", path: "/portal/bills", icon: BillsIcon },
    { label: "Ledger", path: "/portal/ledger", icon: LedgerIcon },
  ];

  const totalCartItems = cart?.itemCount ?? cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#047857] text-white shadow-md border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand & Shop Info */}
            <div className="flex items-center gap-4">
              <Link to="/portal/home" className="flex items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xl text-white border border-white/20 group-hover:bg-white/20 transition">
                  {customer?.shop?.name?.charAt(0) || "N"}
                </div>
                <div>
                  <div className="font-bold text-base leading-tight tracking-tight flex items-center gap-2">
                    <span>{customer?.shop?.name || "Customer Portal"}</span>
                    {customer?.shop?.code && (
                      <span className="text-[10px] bg-white/20 text-emerald-100 font-medium px-1.5 py-0.5 rounded uppercase">
                        {customer.shop.code}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-200">Customer Portal</div>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center space-x-1 ml-6">
                {navLinks.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? "bg-emerald-900/40 text-white font-semibold"
                          : "text-emerald-100 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Right: Cart, Notifications, Profile Dropdown */}
            <div className="flex items-center gap-3">
              {/* Cart Button */}
              <Link
                to="/portal/cart"
                className="relative p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition"
                title="View Cart"
              >
                <CartIcon className="w-6 h-6" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-[#047857] shadow">
                    {totalCartItems > 99 ? "99+" : totalCartItems}
                  </span>
                )}
              </Link>

              {/* Notification Bell */}
              <Link
                to="/portal/notifications"
                className="relative p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition"
                title="Notifications"
              >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-[#047857] shadow">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-sm font-medium text-white border border-white/20"
                >
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold leading-none">{customer?.name || "Customer"}</div>
                    <div className="text-[11px] text-emerald-200 mt-0.5">{customer?.phone}</div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs">
                    {customer?.name?.charAt(0) || "C"}
                  </div>
                  <ChevronDownIcon className="w-3.5 h-3.5 text-emerald-200" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white text-gray-800 shadow-xl border border-gray-100 py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{customer?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{customer?.phone}</p>
                      {customer?.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                      <div className="mt-2.5 p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Balance:</span>
                        <span
                          className={`text-xs font-bold ${
                            (customer?.currentBalance ?? 0) > 0
                              ? "text-rose-600"
                              : (customer?.currentBalance ?? 0) < 0
                              ? "text-emerald-600"
                              : "text-gray-700"
                          }`}
                        >
                          ₹{Number(customer?.currentBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <Link
                      to="/portal/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span>My Profile & Settings</span>
                    </Link>

                    <Link
                      to="/portal/ledger"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      <LedgerIcon className="w-4 h-4 text-gray-400" />
                      <span>Account Statement</span>
                    </Link>

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition font-medium"
                    >
                      <LogoutIcon className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu hamburger toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10"
              >
                <MenuIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-emerald-800 border-t border-emerald-700 px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? "bg-emerald-900 text-white font-semibold" : "text-emerald-100 hover:bg-emerald-700/60"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <NavLink
              to="/portal/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-emerald-100 hover:bg-emerald-700/60"
            >
              <UserIcon className="w-4 h-4" />
              <span>Profile</span>
            </NavLink>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Sticky Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        <NavLink
          to="/portal/home"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition ${
              isActive ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
            }`
          }
        >
          <HomeIcon className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/portal/catalog"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition ${
              isActive ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
            }`
          }
        >
          <CatalogIcon className="w-5 h-5 mb-0.5" />
          <span>Catalog</span>
        </NavLink>
        <NavLink
          to="/portal/cart"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 text-[11px] font-medium relative transition ${
              isActive ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
            }`
          }
        >
          <div className="relative">
            <CartIcon className="w-5 h-5 mb-0.5" />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                {totalCartItems}
              </span>
            )}
          </div>
          <span>Cart</span>
        </NavLink>
        <NavLink
          to="/portal/orders"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition ${
              isActive ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
            }`
          }
        >
          <OrdersIcon className="w-5 h-5 mb-0.5" />
          <span>Orders</span>
        </NavLink>
        <NavLink
          to="/portal/ledger"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 text-[11px] font-medium transition ${
              isActive ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
            }`
          }
        >
          <LedgerIcon className="w-5 h-5 mb-0.5" />
          <span>Ledger</span>
        </NavLink>
      </nav>
    </div>
  );
}

/* --- Inline Clean SVG Icons --- */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CatalogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function BillsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

