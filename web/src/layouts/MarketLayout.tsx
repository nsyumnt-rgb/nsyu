import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";

/** Public marketplace shell (MultiShop): header with search, footer. No login required. */
export default function MarketLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const [q, setQ] = useState(params.get("q") || "");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setMenu(false);
    if (!location.pathname.startsWith("/market/search")) setQ("");
  }, [location.pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/market/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  const cartCount = cart?.itemCount ?? 0;
  const links = [
    { to: "/market/search", label: "Products" },
    { to: "/market/shops", label: "Shops" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <div className="bg-navy-950 text-[12px] text-brand-100/80 text-center py-1.5 px-4">Shop from local stores — compare prices across shops and order online</div>

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-navy-900 text-white flex items-center justify-center font-bold">N</span>
            <span className="hidden sm:block text-[17px] font-bold text-navy-900 tracking-tight">NSYU Market</span>
          </Link>

          <form onSubmit={submit} className="flex-1 min-w-0" role="search">
            <label htmlFor="market-search" className="sr-only">Search products, shops, brands</label>
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                id="market-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, shops, brands"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-slate-50/80 text-[14px] focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none"
              />
            </div>
          </form>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `px-3 py-2 rounded-lg text-[14px] font-medium ${isActive ? "text-brand-700" : "text-slate-600 hover:text-navy-900"}`}>
                {l.label}
              </NavLink>
            ))}
            {customer ? (
              <Link to="/portal/orders" className="px-3 py-2 rounded-lg text-[14px] font-medium text-slate-600 hover:text-navy-900">My orders</Link>
            ) : (
              <Link to="/portal/login" className="px-3 py-2 rounded-lg text-[14px] font-medium text-slate-600 hover:text-navy-900">Login</Link>
            )}
          </nav>

          <Link to={customer ? "/portal/cart" : "/portal/login"} className="btn-primary h-11 shrink-0" aria-label="Cart">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="hidden sm:inline">Cart{cartCount ? ` (${cartCount})` : ""}</span>
          </Link>

          <button type="button" onClick={() => setMenu((v) => !v)} className="md:hidden p-2 -mr-2 rounded-lg text-slate-600" aria-label="Menu" aria-expanded={menu}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        {menu && (
          <div className="md:hidden border-t border-border bg-white px-4 py-2">
            {[...links, customer ? { to: "/portal/orders", label: "My orders" } : { to: "/portal/login", label: "Login" }].map((l) => (
              <Link key={l.to} to={l.to} className="block px-2 py-3 text-[15px] font-medium text-slate-700 border-b border-slate-100 last:border-0">{l.label}</Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-[13px]">
          <div className="col-span-2 md:col-span-1">
            <div className="text-[16px] font-bold text-navy-900">NSYU Market</div>
            <p className="text-slate-500 mt-1">Buy from local shops in one place.</p>
          </div>
          <FooterCol title="Shop" links={[["Products", "/market/search"], ["Shops", "/market/shops"]]} />
          <FooterCol title="Sell" links={[["Open your shop", "/register"], ["Shop owner login", "/login"]]} />
          <FooterCol title="Help" links={[["Track order", "/portal/orders"], ["Customer login", "/portal/login"]]} />
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="section-label mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map(([l, to]) => (
          <li key={to}>
            <Link to={to} className="text-slate-600 hover:text-brand-700">{l}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
