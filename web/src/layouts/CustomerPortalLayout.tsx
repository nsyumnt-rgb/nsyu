import { useEffect, useState, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { logoutCustomerApi, getCartApi, getPortalUnreadCountApi, getPortalCategoriesApi } from "../api/portal";
import { getMarketShop } from "../api/marketplace";
import { resolveAssetUrl } from "../api/client";
import { useStorefront } from "../store/storefrontStore";
import CartDrawer from "../components/storefront/CartDrawer";
import { HeartIcon } from "../components/StoreProduct";
import { KindIcon, initialsOf, productKind, shopGradient } from "../components/ProductArt";

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const unreadCount = usePortalStore((s) => s.unreadCount);
  const setCart = usePortalStore((s) => s.setCart);
  const setUnreadCount = usePortalStore((s) => s.setUnreadCount);
  const wishlistCount = useStorefront((s) => s.wishlist.length);
  const bindWishlist = useStorefront((s) => s.bindWishlist);
  const openCart = useStorefront((s) => s.openCart);
  const cartBump = useStorefront((s) => s.cartBump);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [bumping, setBumping] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Poll unread notifications & cart count on route change
  useEffect(() => {
    getPortalUnreadCountApi().then(setUnreadCount).catch(() => {});
    getCartApi().then(setCart).catch(() => {});
    setMoreOpen(false);
  }, [location.pathname, setCart, setUnreadCount]);

  // Shop branding (public shop profile) + live categories for the nav bar
  useEffect(() => {
    bindWishlist(customer?.shop?.id, customer?.id);
    getPortalCategoriesApi().then((c: any[]) => setCategories(c || [])).catch(() => {});
    if (customer?.shop?.code) {
      getMarketShop(customer.shop.code)
        .then((s) => setLogo(s?.logo ? resolveAssetUrl(s.logo) : null))
        .catch(() => setLogo(null));
    }
  }, [customer?.shop?.id, customer?.shop?.code, customer?.id, bindWishlist]);

  // Badge "pop" when something is added to the cart
  useEffect(() => {
    if (!cartBump) return;
    setBumping(true);
    const t = setTimeout(() => setBumping(false), 450);
    return () => clearTimeout(t);
  }, [cartBump]);

  // Keep the header search in sync with the catalog URL
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q");
    if (location.pathname === "/portal/catalog") setQuery(q || "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setProfileDropdownOpen(false);
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutCustomerApi();
    navigate("/portal/login", { replace: true });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/portal/catalog?q=${encodeURIComponent(q)}` : "/portal/catalog");
  };

  const totalCartItems = cart?.itemCount ?? cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const shopName = customer?.shop?.name || "Online store";
  const navCats = categories.slice(0, 6);
  const moreCats = categories.slice(6);
  const activeCat = new URLSearchParams(location.search).get("category");

  const Brand = (
    <Link to="/portal/home" className="flex items-center gap-2.5 shrink-0 min-w-0">
      <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${logo ? "bg-white ring-1 ring-slate-200" : `bg-gradient-to-br ${shopGradient(shopName)} text-white font-bold text-[15px] shadow-brand`}`}>
        {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-1" onError={() => setLogo(null)} /> : initialsOf(shopName)}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[15px] sm:text-[17px] text-navy-900 leading-tight tracking-tight truncate max-w-[150px] sm:max-w-[220px]">{shopName}</span>
        <span className="block text-[11.5px] text-slate-500 leading-tight">Online store</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex flex-col font-sans">
      {/* Storefront header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:gap-6 h-16 sm:h-[72px]">
            {Brand}

            <form onSubmit={submitSearch} role="search" className="hidden md:block flex-1 max-w-2xl mx-auto">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, brands, categories…"
                  className="w-full h-11 pl-12 pr-24 rounded-full bg-slate-100/80 border border-transparent text-[14px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-4 rounded-full bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700">Search</button>
              </label>
            </form>

            <div className="flex-1 md:hidden" />

            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link to="/portal/wishlist" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition" title="Wishlist" aria-label={`Wishlist (${wishlistCount})`}>
                <HeartIcon className="w-[22px] h-[22px]" filled={wishlistCount > 0} />
                {wishlistCount > 0 && <Badge n={wishlistCount} className="bg-rose-600" />}
              </Link>
              <Link to="/portal/notifications" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full hidden sm:flex items-center justify-center text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition" title="Notifications" aria-label={`Notifications (${unreadCount})`}>
                <BellIcon className="w-[22px] h-[22px]" />
                {unreadCount > 0 && <Badge n={unreadCount} className="bg-amber-500" />}
              </Link>
              <button type="button" data-cart-target onClick={openCart} className="relative w-10 h-10 sm:w-auto sm:h-11 sm:pl-3 sm:pr-4 rounded-full flex items-center justify-center gap-2 bg-brand-600 text-white hover:bg-brand-700 shadow-brand transition" aria-label={`Open cart (${totalCartItems} items)`}>
                <CartIcon className={`w-[21px] h-[21px] transition-transform ${bumping ? "scale-125" : ""}`} />
                <span className="hidden sm:block text-[13px] font-semibold tabular">₹{Number(cart?.estimatedTotal ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                {totalCartItems > 0 && <Badge n={totalCartItems} className={`bg-amber-400 !text-navy-950 transition-transform ${bumping ? "scale-125" : ""}`} />}
              </button>

              {/* Profile */}
              <div className="relative ml-0.5" ref={dropdownRef}>
                <button type="button" onClick={() => setProfileDropdownOpen((prev) => !prev)} className="flex items-center gap-2 p-1 lg:pr-2.5 rounded-full hover:bg-slate-100 transition" aria-haspopup="menu" aria-expanded={profileDropdownOpen}>
                  <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${shopGradient(customer?.name || "C")} text-white flex items-center justify-center font-semibold text-[13px]`}>
                    {initialsOf(customer?.name || "C")}
                  </span>
                  <span className="text-left hidden lg:block">
                    <span className="block text-[13px] font-semibold text-navy-900 leading-none max-w-[120px] truncate">{customer?.name || "Customer"}</span>
                    <span className="block text-[11px] text-slate-500 mt-1">Customer</span>
                  </span>
                  <ChevronDownIcon className="hidden lg:block w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileDropdownOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-72 rounded-2xl bg-white text-slate-800 shadow-lift border border-border py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-[14px] font-semibold text-navy-900">{customer?.name}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">{customer?.phone}</p>
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-[12px] text-slate-500">{(customer?.currentBalance ?? 0) < 0 ? "Advance" : "Balance due"}</span>
                        <span className={`text-[14px] font-bold tabular ${(customer?.currentBalance ?? 0) > 0 ? "text-rose-600" : (customer?.currentBalance ?? 0) < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                          ₹{Math.abs(Number(customer?.currentBalance ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    {[
                      { to: "/portal/account", label: "My account", Icon: UserIcon },
                      { to: "/portal/orders", label: "My orders", Icon: OrdersIcon },
                      { to: "/portal/wishlist", label: "Wishlist", Icon: HeartLineIcon },
                      { to: "/portal/bills", label: "Bills & invoices", Icon: BillsIcon },
                      { to: "/portal/ledger", label: "Khata / statement", Icon: LedgerIcon },
                      { to: "/portal/notifications", label: "Notifications", Icon: BellIcon },
                      { to: "/portal/profile", label: "Profile & settings", Icon: UserIcon },
                    ].map(({ to, label, Icon }) => (
                      <Link key={to + label} to={to} role="menuitem" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span>{label}</span>
                      </Link>
                    ))}
                    <div className="border-t border-slate-100 my-1" />
                    <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition font-medium">
                      <LogoutIcon className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <form onSubmit={submitSearch} role="search" className="md:hidden pb-3">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="w-full h-11 pl-12 pr-4 rounded-full bg-slate-100 text-[15px] text-navy-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/30" />
            </label>
          </form>
        </div>

        {/* Category bar (desktop) */}
        <div className="hidden md:block border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-1">
            <Link to="/portal/catalog" className="h-9 pl-3 pr-4 rounded-full bg-brand-600 text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-brand-700 shrink-0">
              <MenuIcon className="w-4 h-4" /> All categories
            </Link>
            <nav className="flex items-center gap-0.5 min-w-0 overflow-hidden">
              {navCats.map((c) => (
                <Link key={c.id} to={`/portal/catalog?category=${c.id}`} className={`h-9 px-3 rounded-full inline-flex items-center gap-2 text-[13px] font-medium whitespace-nowrap transition ${activeCat === String(c.id) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-navy-900"}`}>
                  <KindIcon kind={productKind(c.name)} className="w-4 h-4 text-slate-400" />
                  <span className="capitalize">{c.name.toLowerCase()}</span>
                </Link>
              ))}
            </nav>
            {moreCats.length > 0 && (
              <div className="relative shrink-0" ref={moreRef}>
                <button type="button" onClick={() => setMoreOpen((v) => !v)} className="h-9 px-3 rounded-full inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:bg-slate-100" aria-expanded={moreOpen}>
                  More <ChevronDownIcon className="w-3.5 h-3.5" />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 mt-1 w-56 max-h-80 overflow-y-auto rounded-xl bg-white shadow-lift border border-border py-1.5 z-50 animate-fadeIn">
                    {moreCats.map((c) => (
                      <Link key={c.id} to={`/portal/catalog?category=${c.id}`} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-slate-700 hover:bg-brand-50 hover:text-brand-700 capitalize">
                        <KindIcon kind={productKind(c.name)} className="w-4 h-4 text-slate-400" />
                        {c.name.toLowerCase()}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex-1" />
            <nav className="hidden lg:flex items-center gap-0.5 shrink-0">
              {[
                { to: "/portal/orders", label: "My orders" },
                { to: "/portal/bills", label: "Bills" },
                { to: "/portal/ledger", label: "Khata" },
              ].map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => `h-9 px-3 rounded-full inline-flex items-center text-[13px] font-medium transition ${isActive ? "text-brand-700 bg-brand-50" : "text-slate-600 hover:bg-slate-100 hover:text-navy-900"}`}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-28 md:pb-12 animate-fadeIn">
        <Outlet />
      </main>

      <footer className="hidden md:block bg-navy-950 text-emerald-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-4 gap-8 text-[13px]">
          <div className="col-span-2">
            <div className="text-[16px] font-bold text-white">{shopName}</div>
            {customer?.shop?.address && <p className="mt-2 max-w-sm">{customer.shop.address}</p>}
            {customer?.shop?.phone && (
              <a href={`tel:${customer.shop.phone}`} className="mt-2 inline-block font-semibold text-white hover:text-emerald-200">Call {customer.shop.phone}</a>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">Shop</div>
            <ul className="mt-3 space-y-2">
              <li><Link to="/portal/catalog" className="hover:text-white">All products</Link></li>
              <li><Link to="/portal/catalog?sort=discount" className="hover:text-white">Offers</Link></li>
              <li><Link to="/portal/wishlist" className="hover:text-white">Wishlist</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">My account</div>
            <ul className="mt-3 space-y-2">
              <li><Link to="/portal/orders" className="hover:text-white">Orders</Link></li>
              <li><Link to="/portal/bills" className="hover:text-white">Bills</Link></li>
              <li><Link to="/portal/ledger" className="hover:text-white">Khata</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between text-[12px]">
            <span>© {new Date().getFullYear()} {shopName}</span>
            <span>Powered by NSYU Business</span>
          </div>
        </div>
      </footer>

      {/* Mobile bottom tab bar with a prominent cart button */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-border px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] grid grid-cols-5 items-end">
        <TabLink to="/portal/home" label="Home" Icon={HomeIcon} />
        <TabLink to="/portal/catalog" label="Shop" Icon={CatalogIcon} />
        <button type="button" data-cart-target onClick={openCart} className="flex flex-col items-center -mt-6" aria-label={`Open cart (${totalCartItems} items)`}>
          <span className={`relative w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-brand ring-4 ring-white transition-transform ${bumping ? "scale-110" : ""}`}>
            <CartIcon className="w-6 h-6" />
            {totalCartItems > 0 && <Badge n={totalCartItems} className="bg-amber-400 !text-navy-950" />}
          </span>
          <span className="text-[11px] font-semibold text-brand-700 mt-0.5">Cart</span>
        </button>
        <TabLink to="/portal/wishlist" label="Wishlist" Icon={HeartLineIcon} />
        <TabLink to="/portal/account" label="Account" Icon={UserIcon} />
      </nav>

      <CartDrawer />
    </div>
  );
}

function TabLink({ to, label, Icon }: { to: string; label: string; Icon: (p: { className?: string }) => React.ReactElement }) {
  return (
    <NavLink to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition ${isActive ? "text-brand-700 font-semibold" : "text-slate-500"}`}>
      {({ isActive }) => (
        <>
          <span className={`px-4 py-1 rounded-full transition ${isActive ? "bg-brand-50" : ""}`}>
            <Icon className="w-5 h-5" />
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function Badge({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center ring-2 ring-white ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  );
}

function HeartLineIcon({ className }: { className?: string }) {
  return <HeartIcon className={className} />;
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

