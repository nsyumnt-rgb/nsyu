import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { useWishlistStore } from "../store/wishlistStore";
import { getMarketCart, getMarketCategories } from "../api/marketplace";
import LoginModal from "../components/LoginModal";

export default function MarketLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const customer = usePortalStore((s) => s.customer);
  const wishlistCount = useWishlistStore((s) => s.totalCount);

  const [q, setQ] = useState(params.get("q") || "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<"customer" | "staff">("customer");

  // Global listener so any component (MarketCard, MarketProduct, MarketCart) can trigger the centered login popup
  useEffect(() => {
    const handleOpenLogin = (e: any) => {
      const tab = e?.detail?.tab === "staff" ? "staff" : "customer";
      setLoginModalTab(tab);
      setLoginModalOpen(true);
    };
    window.addEventListener("open-login-modal", handleOpenLogin);
    return () => window.removeEventListener("open-login-modal", handleOpenLogin);
  }, []);

  // Cart badge across all shops; refreshed on navigation and when cart changes
  useEffect(() => {
    if (!customer) {
      setCartCount(0);
      return;
    }
    const refresh = () =>
      getMarketCart()
        .then((c) => setCartCount(c?.itemCount || 0))
        .catch(() => {});
    refresh();
    window.addEventListener("market-cart-changed", refresh);
    return () => window.removeEventListener("market-cart-changed", refresh);
  }, [customer, location.pathname]);

  // Load categories for the All Categories dropdown
  useEffect(() => {
    getMarketCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setCategoriesDropdownOpen(false);
    if (!location.pathname.startsWith("/market/search")) setQ("");
  }, [location.pathname]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/market/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  const navLinks = [
    { to: "/", label: "Home", icon: "🏠", exact: true },
    { to: "/market/search", label: "Products", icon: "📦" },
    { to: "/market/shops", label: "Shops", icon: "🏪" },
    { to: "/market/search?sort=newest&offers=true", label: "Offers", icon: "🏷️" },
    { to: "/market/about", label: "About Us", icon: "👤" },
    { to: "/market/contact", label: "Contact", icon: "✉️" },
  ];

  return (
    <div className="market-shell min-h-screen flex flex-col">
      {/* ============================================================== */}
      {/* 1. TOP NOTICE / ANNOUNCEMENT BAR (Emerald Green)                */}
      {/* ============================================================== */}
      <div className="bg-[#064E3B] text-white text-[11px] sm:text-xs font-semibold py-2 px-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4 text-center sm:text-left">
          {/* Free Shipping */}
          <div className="flex items-center gap-1.5 text-emerald-100">
            <span>🚚</span>
            <span>Free Shipping on Orders Above ₹1,000</span>
          </div>
          {/* Best Quality */}
          <div className="hidden md:flex items-center gap-1.5 text-emerald-200">
            <span>⭐</span>
            <span>Best Quality Products</span>
          </div>
          {/* Customer Support */}
          <div className="flex items-center gap-1.5 text-emerald-100">
            <span>🎧</span>
            <span>Customer Support: 98765 43210</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN HEADER (Logo, Central Search Bar, Wishlist, Cart)       */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-[#047857] text-white flex items-center justify-center font-black text-xl shadow-xs transition-all duration-200">
              N
            </div>
            <div className="min-w-0">
              <span className="block text-lg font-black text-navy-900 tracking-tight leading-none">
                NSYU Market
              </span>
              <span className="block text-[10.5px] font-semibold text-slate-500 mt-0.5 tracking-tight">
                Shop Smart · Shop Better
              </span>
            </div>
          </Link>

          {/* Central Search Bar */}
          <form
            onSubmit={submitSearch}
            className="flex-1 max-w-xl mx-auto relative hidden sm:block"
            role="search"
          >
            <div className="relative flex items-center">
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="market-global-search"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, shops, brands..."
                className="w-full h-11 pl-10 pr-14 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm focus:border-[#047857] focus:ring-2 focus:ring-emerald-500/20 outline-none transition shadow-2xs"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-1 top-1 h-9 px-3.5 rounded-lg bg-[#047857] hover:bg-[#064E3B] text-white flex items-center justify-center transition shadow-xs cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>
          </form>

          {/* Right Action Icons: Wishlist & Cart */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Wishlist */}
            <Link
              to="/portal/wishlist"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-700 hover:text-emerald-700 transition"
              title="View Wishlist"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="hidden md:inline">Wishlist</span>
              <span className="bg-[#047857] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {wishlistCount}
              </span>
            </Link>

            {/* Cart */}
            <Link
              to="/market/cart"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-700 hover:text-emerald-700 transition"
              title="View Cart"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="hidden md:inline">Cart</span>
              <span className="bg-[#047857] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            </Link>

            {/* User Account / Orders */}
            {customer ? (
              <Link
                to="/portal/orders"
                className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition"
              >
                <span>👤</span>
                <span className="truncate max-w-[100px]">{customer.name}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoginModalTab("customer");
                  setLoginModalOpen(true);
                }}
                className="hidden lg:inline-flex text-xs font-bold text-gray-700 hover:text-emerald-700 px-2.5 py-1.5 rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Login
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="sm:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar (under header) */}
        <div className="px-4 pb-3 sm:hidden">
          <form onSubmit={submitSearch} className="relative flex items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, shops, brands..."
              className="w-full h-10 pl-4 pr-11 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:border-emerald-600 outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-[#047857] text-white flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </form>
        </div>

        {/* ============================================================== */}
        {/* 3. SUB-NAVIGATION BAR (Categories Pill Button + Nav Links)     */}
        {/* ============================================================== */}
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
            
            {/* Left "All Categories ˅" Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesDropdownOpen((v) => !v)}
                className="bg-[#047857] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-xs shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>All Categories</span>
                <svg className="w-3 h-3 text-emerald-200 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Categories Dropdown Menu */}
              {categoriesDropdownOpen && (
                <div className="absolute left-0 top-12 z-50 w-56 bg-white rounded-2xl border border-gray-200 p-2 shadow-xl animate-fadeIn space-y-0.5">
                  <Link
                    to="/market/search"
                    onClick={() => setCategoriesDropdownOpen(false)}
                    className="block px-3 py-2 text-xs font-bold text-gray-900 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition"
                  >
                    All Products
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.name}
                      to={`/market/search?category=${encodeURIComponent(c.name)}`}
                      onClick={() => setCategoriesDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition"
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({c.count})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <nav className="hidden sm:flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none h-full">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 h-9 ${
                      isActive
                        ? "text-[#047857] border-b-2 border-[#047857] rounded-b-none"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`
                  }
                >
                  <span className="text-xs">{link.icon}</span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold px-2">
              <Link to="/portal/orders" className="text-emerald-800">My Orders</Link>
              {customer ? (
                <span className="text-gray-600 truncate max-w-[120px]">{customer.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginModalTab("customer");
                    setLoginModalOpen(true);
                  }}
                  className="text-gray-600 hover:text-emerald-700 cursor-pointer"
                >
                  Customer Login
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 4. MAIN PAGE CONTENT (Dynamic Child Routes)                     */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* ============================================================== */}
      {/* 5. FLOATING CART BUTTON (Bottom-Right with Live Count Badge)    */}
      {/* ============================================================== */}
      <Link
        to="/market/cart"
        aria-label="View Cart"
        className="fixed bottom-6 right-6 z-40 w-13 h-13 rounded-full bg-[#047857] hover:bg-emerald-700 text-white flex items-center justify-center shadow-2xl transition hover:scale-110 active:scale-95 group"
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
          {cartCount}
        </span>
      </Link>

      {/* ============================================================== */}
      {/* 6. FOOTER (Matching Mockup: Brand, Shop, Sell, Help, Socials)  */}
      {/* ============================================================== */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-5 gap-8 text-xs">
          
          {/* Brand Info */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#047857] text-white flex items-center justify-center font-black text-lg">
                N
              </div>
              <div>
                <span className="text-base font-black text-gray-900 tracking-tight">
                  NSYU Market
                </span>
                <p className="text-gray-500 text-[11px] mt-0.5 font-medium">
                  Buy from local shops in one place.
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-[11px] mt-3 max-w-sm leading-relaxed">
              Discover quality products, compare transparent prices across local stores,
              and get ultra-fast delivery or pickup directly from verified neighborhood businesses.
            </p>
          </div>

          {/* SHOP Column */}
          <div>
            <div className="font-black text-gray-900 uppercase tracking-wider text-[11px] mb-3">
              SHOP
            </div>
            <ul className="space-y-2 text-gray-600 font-medium">
              <li>
                <Link to="/market/search" className="hover:text-emerald-700 transition">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/market/shops" className="hover:text-emerald-700 transition">
                  Shops
                </Link>
              </li>
              <li>
                <Link to="/market/search?offers=true" className="hover:text-emerald-700 transition">
                  Special Offers
                </Link>
              </li>
            </ul>
          </div>

          {/* SELL Column */}
          <div>
            <div className="font-black text-gray-900 uppercase tracking-wider text-[11px] mb-3">
              SELL
            </div>
            <ul className="space-y-2 text-gray-600 font-medium">
              <li>
                <Link to="/register" className="hover:text-emerald-700 transition">
                  Open your shop
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalTab("staff");
                    setLoginModalOpen(true);
                  }}
                  className="hover:text-emerald-700 transition cursor-pointer text-left"
                >
                  Shop owner login
                </button>
              </li>
            </ul>
          </div>

          {/* HELP Column */}
          <div>
            <div className="font-black text-gray-900 uppercase tracking-wider text-[11px] mb-3">
              HELP
            </div>
            <ul className="space-y-2 text-gray-600 font-medium">
              <li>
                <Link to="/portal/orders" className="hover:text-emerald-700 transition">
                  Track order
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalTab("customer");
                    setLoginModalOpen(true);
                  }}
                  className="hover:text-emerald-700 transition cursor-pointer text-left"
                >
                  Customer login
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Icons & Copyright */}
        <div className="border-t border-gray-100 py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">Connect:</span>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-110 transition">f</span>
              <span className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-110 transition">yt</span>
              <span className="w-7 h-7 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-110 transition">ig</span>
              <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-110 transition">in</span>
            </div>
          </div>
          <div>© 2026 NSYU Market. All rights reserved.</div>
        </div>
      </footer>

      {/* Centered Login Popup Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        initialTab={loginModalTab}
      />
    </div>
  );
}
