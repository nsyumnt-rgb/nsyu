import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { useAuthStore } from "../store/authStore";
import { getMarketCart } from "../api/marketplace";
import BusinessFooter from "./BusinessFooter";
import HinglishToggle from "../components/HinglishToggle";

export default function MarketLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const customer = usePortalStore((s) => s.customer);
  const owner = useAuthStore((s) => s.owner);
  const accountType = useAuthStore((s) => s.accountType);

  const [cartCount, setCartCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshCart = () => {
    getMarketCart()
      .then((c) => {
        setCartCount(c?.itemCount || 0);
      })
      .catch(() => setCartCount(0));
  };

  useEffect(() => {
    refreshCart();
    const interval = setInterval(refreshCart, 15000);
    return () => clearInterval(interval);
  }, [customer?.id]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/market/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/market/search");
    }
  };

  const navLinks = [
    { to: "/", label: "Home", icon: "🏠", exact: true },
    { to: "/market/search", label: "Marketplace", icon: "🛍️" },
    { to: "/market/shops", label: "Shops", icon: "🏪" },
    { to: "/register", label: "Sell on NSYU", icon: "💼" },
  ];

  return (
    <div className="market-shell min-h-screen flex flex-col bg-white">
      {/* 1. TOP NOTICE / ANNOUNCEMENT BAR (Emerald Green) */}
      <div className="bg-[#064E3B] text-white text-[11px] sm:text-xs font-semibold py-1.5 px-4 shadow-xs">
        <div className="max-w-[1340px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="bg-emerald-700/80 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase font-bold text-emerald-100">
              NSYU Retail
            </span>
            <span className="truncate">India's Multi-Store Consumer Marketplace · Direct Storefront Prices</span>
          </div>
          <div className="flex items-center gap-4 shrink-0 text-[11px]">
            <Link to="/register" className="text-emerald-100 hover:text-white font-medium hover:underline">
              Register Shop
            </Link>
            <span className="text-emerald-500">|</span>
            <Link to="/login" className="text-white font-bold hover:underline">
              {customer ? `Hi, ${customer.name}` : owner ? "Merchant Portal" : "Sign In"}
            </Link>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER (Search, Cart, Navigation) */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-2xs">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#064E3B] to-[#047857] text-white flex items-center justify-center font-black text-xl shadow-sm group-hover:scale-105 transition-transform">
              N
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight leading-none">
                NSYU<span className="text-emerald-700">.</span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold text-gray-500 tracking-wider uppercase leading-none mt-0.5">
                Marketplace
              </div>
            </div>
          </Link>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="relative w-full flex items-center">
              <input
                type="text"
                placeholder="Search products, categories, electronics, accessories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-24 rounded-full border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-xs sm:text-sm bg-gray-50/70 focus:bg-white transition-all outline-none"
              />
              <span className="absolute left-4 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <button
                type="submit"
                className="absolute right-1.5 px-4 h-8 rounded-full bg-[#047857] hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs"
              >
                Search
              </button>
            </div>
          </form>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-gray-700">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.exact}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 font-bold"
                        : "hover:bg-gray-100 hover:text-navy-950"
                    }`
                  }
                >
                  <span className="mr-1">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
            </nav>

            {/* Cart Icon Button */}
            <Link
              to="/market/cart"
              className="relative p-2.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-navy-950 transition flex items-center justify-center group"
              title="View Cart"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-[#064E3B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Account / Login Pill */}
            {customer ? (
              <Link
                to="/portal/home"
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 transition text-xs font-bold"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">
                  {customer.name?.charAt(0) || "C"}
                </div>
                <span className="max-w-[90px] truncate">{customer.name}</span>
              </Link>
            ) : owner ? (
              <Link
                to="/app"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-800 text-white hover:bg-emerald-900 transition text-xs font-bold shadow-xs"
              >
                <span>Merchant Hub</span>
              </Link>
            ) : accountType === "super_admin" ? (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-700 text-white hover:bg-purple-800 transition text-xs font-bold shadow-xs"
              >
                <span>Super Admin</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#047857] hover:bg-emerald-800 text-white transition text-xs font-bold shadow-xs"
              >
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Row */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
            <input
              type="text"
              placeholder="Search products, electronics, shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-20 rounded-full border border-gray-300 text-xs bg-gray-50 focus:bg-white outline-none"
            />
            <span className="absolute left-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <button
              type="submit"
              className="absolute right-1 px-3 h-8 rounded-full bg-[#047857] text-white text-[11px] font-bold"
            >
              Go
            </button>
          </form>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-1 shadow-lg">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-900"
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* 3. MAIN CONTENT (Outlet) */}
      <main className="flex-1 w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* 4. FOOTER */}
      <BusinessFooter />

      {/* Floating Hinglish Toggle */}
      <HinglishToggle />
    </div>
  );
}
