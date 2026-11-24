import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { useAuthStore } from "../store/authStore";
import { getMarketCart } from "../api/marketplace";
import BusinessFooter from "./BusinessFooter";
import MobileBottomNav from "../components/MobileBottomNav";

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
    { to: "/", label: "Home", icon: NAV_ICONS.home, exact: true },
    { to: "/market/search", label: "Marketplace", icon: NAV_ICONS.bag },
    { to: "/market/shops", label: "Shops", icon: NAV_ICONS.store },
    { to: "/register", label: "Sell on NSYU", icon: NAV_ICONS.briefcase },
  ];

  return (
    <div className="market-shell min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-clip">
      {/* MAIN HEADER (Search, Cart, Navigation) */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 border-b border-border/80 shadow-[0_8px_24px_-18px_rgba(15,42,35,0.3)]">
        <div className="max-w-[1340px] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[76px] flex items-center justify-between gap-2 sm:gap-6 min-w-0">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-black text-xl shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
              N
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-extrabold text-navy-950 tracking-tight leading-none">
                NSYU<span className="text-brand-500">.</span>
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 tracking-[0.16em] uppercase leading-none mt-1">
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
                className="w-full h-11 pl-11 pr-24 rounded-full border border-border hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-xs sm:text-sm bg-slate-50/80 focus:bg-white shadow-xs transition-all duration-200 outline-none placeholder:text-slate-400"
              />
              <span className="absolute left-4 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <button
                type="submit"
                className="absolute right-1.5 px-4 h-8 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-brand active:scale-95"
              >
                Search
              </button>
            </div>
          </form>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-4 min-w-0">
            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-0.5 text-[12.5px] font-semibold text-slate-600">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.exact}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 h-9 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-brand-50 text-brand-800 font-bold ring-1 ring-inset ring-brand-600/10"
                        : "hover:bg-slate-100 hover:text-navy-950"
                    }`
                  }
                >
                  <NavGlyph d={l.icon} />
                  {l.label}
                </NavLink>
              ))}
            </nav>

            {/* Cart Icon Button */}
            <Link
              to="/market/cart"
              className="relative shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border bg-white hover:border-brand-400 hover:bg-brand-50/60 hover:shadow-soft text-navy-950 transition-all duration-200 flex items-center justify-center group"
              title="View Cart"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-[#064E3B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-white animate-scale-in">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Account / Login Pill */}
            {customer ? (
              <Link
                to="/portal/home"
                className="flex items-center gap-2 min-w-0 p-1 min-[400px]:pl-2 min-[400px]:pr-3 min-[400px]:py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 transition text-xs font-bold"
              >
                <div className="w-7 h-7 min-[400px]:w-6 min-[400px]:h-6 shrink-0 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">
                  {customer.name?.charAt(0) || "C"}
                </div>
                <span className="hidden min-[400px]:inline max-w-[90px] truncate">{customer.name}</span>
              </Link>
            ) : owner ? (
              <Link
                to="/app"
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-navy-900 text-white hover:bg-navy-800 transition text-xs font-bold shadow-soft whitespace-nowrap"
              >
                <span>Merchant Hub</span>
              </Link>
            ) : accountType === "super_admin" ? (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-navy-900 text-white hover:bg-navy-800 transition text-xs font-bold shadow-soft whitespace-nowrap"
              >
                <span>Super Admin</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all duration-200 text-xs font-bold shadow-brand hover:-translate-y-px active:scale-95"
              >
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-border bg-white hover:bg-slate-50 text-slate-700 transition"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
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
              className="w-full h-11 pl-10 pr-16 rounded-full border border-border text-[16px] sm:text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition outline-none placeholder:text-slate-400"
            />
            <span className="absolute left-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <button
              type="submit"
              className="absolute right-1.5 px-3.5 h-8 rounded-full bg-brand-600 text-white text-[11px] font-bold shadow-brand active:scale-95 transition"
            >
              Go
            </button>
          </form>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-border px-3 py-3 grid grid-cols-2 gap-1.5 shadow-lg animate-fade-in">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13px] font-semibold text-slate-700 bg-slate-50/70 hover:bg-brand-50 hover:text-brand-800 transition"
              >
                <NavGlyph d={l.icon} />
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* 3. MAIN CONTENT (Outlet) */}
      <main className="flex-1 w-full max-w-[1340px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 pb-28 md:pb-12 min-w-0 overflow-x-clip page-enter">
        <Outlet />
      </main>

      {/* 4. FOOTER (Desktop only) */}
      <div className="hidden md:block">
        <BusinessFooter />
      </div>

      {/* Mobile-First App Navigation Bar */}
      <MobileBottomNav mode="market" />
    </div>
  );
}

const NAV_ICONS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6",
  bag: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  store: "M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 12v8h14v-8M10 20v-5h4v5",
  briefcase: "M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18",
};

function NavGlyph({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
