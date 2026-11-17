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
    { label: "Home", path: "/portal/home", icon: HomeIcon },
    { label: "Shop", path: "/portal/catalog", icon: CatalogIcon },
    { label: "My Orders", path: "/portal/orders", icon: OrdersIcon },
    { label: "Bills", path: "/portal/bills", icon: BillsIcon },
    { label: "Account", path: "/portal/ledger", icon: LedgerIcon },
  ];

  const totalCartItems = cart?.itemCount ?? cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      {/* Store info strip */}
      <div className="hidden sm:block bg-navy-900 text-[12px] text-brand-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between gap-4">
          <span className="truncate">
            Welcome to <span className="font-semibold text-white">{customer?.shop?.name || "our store"}</span>
            {customer?.shop?.address ? ` · ${customer.shop.address}` : ""}
          </span>
          {customer?.shop?.phone && (
            <a href={`tel:${customer.shop.phone}`} className="shrink-0 hover:text-white transition">
              Call us: <span className="font-semibold text-white">{customer.shop.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Storefront header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">
            {/* Brand */}
            <Link to="/portal/home" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-navy-900 flex items-center justify-center font-bold text-lg text-white shadow-brand">
                {customer?.shop?.name?.charAt(0) || "N"}
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-[15px] text-navy-900 leading-tight tracking-tight max-w-[180px] truncate">
                  {customer?.shop?.name || "Customer Portal"}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">Online Store</div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 lg:ml-4">
              {navLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-[13.5px] font-medium transition ${
                      isActive ? "text-brand-700 bg-brand-50 font-semibold" : "text-slate-600 hover:text-navy-900 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/portal/notifications"
                className="relative p-2.5 rounded-xl text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition"
                title="Notifications"
              >
                <BellIcon className="w-[22px] h-[22px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/portal/cart"
                className="relative flex items-center gap-2 pl-2.5 pr-2.5 sm:pr-3.5 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-brand transition"
                title="View Cart"
              >
                <span className="relative">
                  <CartIcon className="w-[22px] h-[22px]" />
                  {totalCartItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-400 text-navy-950 text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center ring-2 ring-brand-600">
                      {totalCartItems > 99 ? "99+" : totalCartItems}
                    </span>
                  )}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-[10.5px] text-brand-100">Cart</span>
                  <span className="block text-[13px] font-bold tabular">
                    ₹{Number(cart?.estimatedTotal ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </span>
              </Link>

              {/* Profile */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:pr-2 rounded-xl hover:bg-slate-100 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center font-semibold text-[13px]">
                    {customer?.name?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="text-[12.5px] font-semibold text-navy-900 leading-none max-w-[110px] truncate">{customer?.name || "Customer"}</div>
                    <div className="text-[11px] text-slate-500 mt-1">My account</div>
                  </div>
                  <ChevronDownIcon className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white text-slate-800 shadow-lift border border-border py-2 z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-[14px] font-semibold text-navy-900">{customer?.name}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">{customer?.phone}</p>
                      {customer?.email && <p className="text-[12px] text-slate-500 truncate">{customer.email}</p>}
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-[12px] text-slate-500">
                          {(customer?.currentBalance ?? 0) < 0 ? "Advance" : "Balance due"}
                        </span>
                        <span
                          className={`text-[14px] font-bold tabular ${
                            (customer?.currentBalance ?? 0) > 0
                              ? "text-rose-600"
                              : (customer?.currentBalance ?? 0) < 0
                              ? "text-emerald-600"
                              : "text-slate-700"
                          }`}
                        >
                          ₹{Math.abs(Number(customer?.currentBalance ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    {[
                      { to: "/portal/orders", label: "My Orders", Icon: OrdersIcon },
                      { to: "/portal/bills", label: "Bills & Invoices", Icon: BillsIcon },
                      { to: "/portal/ledger", label: "Account Statement", Icon: LedgerIcon },
                      { to: "/portal/profile", label: "Profile & Settings", Icon: UserIcon },
                    ].map(({ to, label, Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition"
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span>{label}</span>
                      </Link>
                    ))}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition font-medium"
                    >
                      <LogoutIcon className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label="Menu"
              >
                <MenuIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 pt-2 pb-4 space-y-1 animate-fade-in">
            {[...navLinks, { label: "Bills & Invoices", path: "/portal/bills", icon: BillsIcon }, { label: "Profile", path: "/portal/profile", icon: UserIcon }]
              .filter((v, i, arr) => arr.findIndex((x) => x.path === v.path) === i)
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium ${
                      isActive ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 md:pb-10">
        <Outlet />
      </main>

      <footer className="hidden md:block border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between text-[12px] text-slate-500">
          <span>© {new Date().getFullYear()} {customer?.shop?.name || "NSYU Business"}. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Secure ordering powered by NSYU Business
          </span>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-border px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] grid grid-cols-5">
        {[
          { to: "/portal/home", label: "Home", Icon: HomeIcon },
          { to: "/portal/catalog", label: "Shop", Icon: CatalogIcon },
          { to: "/portal/cart", label: "Cart", Icon: CartIcon, badge: totalCartItems },
          { to: "/portal/orders", label: "Orders", Icon: OrdersIcon },
          { to: "/portal/ledger", label: "Account", Icon: LedgerIcon },
        ].map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition ${isActive ? "text-brand-700 font-semibold" : "text-slate-500"}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`relative px-4 py-1 rounded-full transition ${isActive ? "bg-brand-50" : ""}`}>
                  <Icon className="w-5 h-5" />
                  {!!badge && badge > 0 && (
                    <span className="absolute -top-1 right-1.5 bg-rose-600 text-white text-[9.5px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ring-2 ring-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
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

