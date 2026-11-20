import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { useWishlistStore } from "../store/wishlistStore";
import { getMarketCart, getMarketCategories } from "../api/marketplace";
import LoginModal from "../components/LoginModal";
import DemoBar from "../components/DemoBar";
import HinglishToggle from "../components/HinglishToggle";
import DemoGuideModal from "../components/DemoGuideModal";

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
  const [demoGuideOpen, setDemoGuideOpen] = useState(false);

  // Global listener so any component can trigger the centered login popup
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
    { to: "/market/search", label: "Marketplace", icon: "🛍️" },
    { to: "/categories", label: "Categories", icon: "📁" },
    { to: "/market/shops", label: "Shops", icon: "🏪" },
    { to: "/register", label: "Sell on NSYU", icon: "💼" },
    { to: "/mobile", label: "Mobile App", icon: "📱" },
  ];

  return (
    <div className="market-shell min-h-screen flex flex-col bg-white">
      {/* ============================================================== */}
      {/* 0. PROTOTYPE DEMO BAR (Public, Customer, Owner, Admin, etc.)   */}
      {/* ============================================================== */}
      <DemoBar onOpenGuide={() => setDemoGuideOpen(true)} />

      {/* ============================================================== */}
      {/* 1. TOP NOTICE / ANNOUNCEMENT BAR (Emerald Green)                */}
      {/* ============================================================== */}
      <div className="bg-[#064E3B] text-white text-[11px] sm:text-xs font-semibold py-1.5 px-4 shadow-xs">
        <div className="max-w-[1340px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-emerald-100">
            <span>🚚</span>
            <span>Free Shipping on Orders Above ₹1,000</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-emerald-200">
            <span>⭐</span>
            <span>Verified Local Shops & Pay Later with Shop Approval</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-100">
            <span>🎧</span>
            <span>Customer Support: 98765 43210</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN HEADER (Logo, Central Search Bar, Wishlist, Cart)       */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-2xs">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* Logo & Branding: NSYU Commerce */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#064E3B] to-[#047857] text-white flex items-center justify-center font-black text-xl shadow-xs transition-all duration-200 group-hover:scale-105">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l1.5-5h15L21 9" />
                <path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9" />
                <path d="M5 13v8h14v-8" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="block text-xl font-extrabold text-gray-900 tracking-tight leading-none">
                NSYU
              </span>
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                Commerce
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
                placeholder="Search products, brands or shops"
                className="w-full h-11 pl-10 pr-14 rounded-full border border-gray-200 bg-white text-xs sm:text-sm focus:border-[#047857] focus:ring-2 focus:ring-emerald-500/20 outline-none transition shadow-2xs"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-1 top-1 h-9 px-4 rounded-full bg-[#047857] hover:bg-[#064E3B] text-white flex items-center justify-center transition shadow-xs cursor-pointer font-bold text-xs"
              >
                Search
              </button>
            </div>
          </form>

          {/* Navigation Links in Header (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1 font-bold text-xs text-gray-700">
            <Link to="/market/search" className="px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-emerald-800 transition">
              Marketplace
            </Link>
            <div className="relative group">
              <Link to="/categories" className="px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-emerald-800 transition flex items-center gap-1">
                <span>Categories</span>
                <span className="text-[10px] text-gray-400">⌵</span>
              </Link>
            </div>
            <Link to="/market/shops" className="px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-emerald-800 transition">
              Shops
            </Link>
            <Link to="/register" className="px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-emerald-800 transition">
              Sell on NSYU
            </Link>
          </nav>

          {/* Right Action Icons: Wishlist, Cart & Login */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Wishlist Icon */}
            <Link
              to="/portal/wishlist"
              className="w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 flex items-center justify-center relative transition"
              title="Wishlist"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#047857] text-white text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-white">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Icon */}
            <Link
              to="/market/cart"
              className="w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 flex items-center justify-center relative transition"
              title="Shopping Cart"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#047857] text-white text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User Account / Login Button */}
            {customer ? (
              <Link
                to="/portal/account"
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-2 rounded-xl hover:bg-emerald-100 transition"
              >
                <span>👤</span>
                <span className="truncate max-w-[100px]">{customer.name.split(" ")[0]}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoginModalTab("customer");
                  setLoginModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#064E3B] hover:bg-[#047857] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Login
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="xl:hidden w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-700"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="px-4 pb-3 sm:hidden">
          <form onSubmit={submitSearch} className="relative flex items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, brands or shops..."
              className="w-full h-10 pl-4 pr-11 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:border-emerald-600 outline-none"
            />
            <button
              type="submit"
              className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-[#047857] text-white flex items-center justify-center font-bold text-xs"
            >
              Go
            </button>
          </form>
        </div>

        {/* ============================================================== */}
        {/* 3. SUB-NAVIGATION BAR (Categories Dropdown + Nav Links)        */}
        {/* ============================================================== */}
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between gap-4">
            
            {/* Left "All Categories ˅" Button with Mega Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesDropdownOpen((v) => !v)}
                className="bg-[#047857] hover:bg-[#064E3B] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-2 transition shadow-2xs shrink-0 cursor-pointer"
              >
                <span>☰ All Categories</span>
                <span className="text-[10px] text-emerald-200">⌵</span>
              </button>

              {/* Categories Mega Dropdown Menu */}
              {categoriesDropdownOpen && (
                <div className="absolute left-0 top-11 z-50 w-72 bg-white rounded-2xl border border-gray-200 p-2 shadow-2xl animate-fadeIn space-y-0.5">
                  <Link
                    to="/categories"
                    onClick={() => setCategoriesDropdownOpen(false)}
                    className="block px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/60 rounded-xl hover:bg-emerald-100 transition"
                  >
                    📁 Browse All Categories Directory →
                  </Link>
                  {categories.slice(0, 12).map((c) => (
                    <Link
                      key={c.name}
                      to={`/market/search?category=${encodeURIComponent(c.name)}`}
                      onClick={() => setCategoriesDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 hover:text-emerald-800 transition"
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({c.count})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <nav className="hidden sm:flex items-center gap-1 overflow-x-auto scrollbar-none h-full text-xs font-bold text-gray-600">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                      isActive
                        ? "text-[#047857] font-extrabold bg-emerald-50"
                        : "hover:text-gray-900 hover:bg-gray-50"
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
          <div className="xl:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 4. MAIN PAGE CONTENT                                           */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* ============================================================== */}
      {/* 5. FLOATING CART BUTTON                                         */}
      {/* ============================================================== */}
      <Link
        to="/market/cart"
        aria-label="View Cart"
        className="fixed bottom-5 right-5 z-40 w-13 h-13 rounded-full bg-[#047857] hover:bg-[#064E3B] text-white flex items-center justify-center shadow-2xl transition hover:scale-105 active:scale-95 group cursor-pointer"
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
      {/* 6. FOOTER (Matching NSYU Commerce Platform.html line 496)       */}
      {/* ============================================================== */}
      <footer className="bg-[#064E3B] text-[#CDEEDF] py-10 mt-16 border-t border-emerald-900">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div>
            <b className="font-extrabold text-white text-lg tracking-tight block">
              NSYU Commerce
            </b>
            <p className="mt-2 text-emerald-200/90 leading-relaxed max-w-sm">
              A multi-owner, multi-shop marketplace for retail and wholesale. This build is a stakeholder prototype.
            </p>
          </div>
          <div>
            <b className="text-white text-sm block mb-2">Shop</b>
            <div className="space-y-1.5 text-emerald-200/80 font-medium">
              <div><Link to="/market/search" className="hover:text-white">Marketplace</Link></div>
              <div><Link to="/categories" className="hover:text-white">Categories</Link></div>
              <div><Link to="/market/shops" className="hover:text-white">Shops</Link></div>
            </div>
          </div>
          <div>
            <b className="text-white text-sm block mb-2">Sell</b>
            <div className="space-y-1.5 text-emerald-200/80 font-medium">
              <div><Link to="/register" className="hover:text-white">Register a shop</Link></div>
              <div><Link to="/app/inventory" className="hover:text-white">Inventory management</Link></div>
              <div><Link to="/app/billing" className="hover:text-white">POS counter sales</Link></div>
            </div>
          </div>
          <div>
            <b className="text-white text-sm block mb-2">Prototype notice</b>
            <p className="text-emerald-200/80 leading-relaxed">
              Sample records only. Print and PDF export run on the server in production. Multi-tenant isolation and real-time inventory tracking enabled.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Hinglish Toggle Button */}
      <HinglishToggle />

      {/* Centered Login Popup Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        initialTab={loginModalTab}
      />

      {/* Demo Guide Modal */}
      <DemoGuideModal
        isOpen={demoGuideOpen}
        onClose={() => setDemoGuideOpen(false)}
      />
    </div>
  );
}
