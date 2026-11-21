import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { getCartApi, getPortalCategoriesApi, getPortalShopPoliciesApi, logoutCustomerApi } from "../api/portal";
import { getMarketShop } from "../api/marketplace";
import { resolveAssetUrl } from "../api/client";
import { useStorefront } from "../store/storefrontStore";
import CartDrawer from "../components/storefront/CartDrawer";
import { KindIcon, initialsOf, productKind } from "../components/ProductArt";
import MobileBottomNav from "../components/MobileBottomNav";

/**
 * Customer storefront shell: dark-green sticky header (Home · Shop · Categories ·
 * My Orders · My Account, search, cart, notifications, profile), hamburger menu on
 * phones, and a matching footer with the shop's real contact details.
 * Customers never see owner/admin navigation here.
 */
type Cat = { id: number; name: string; productCount?: number };

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);
  const bindWishlist = useStorefront((s) => s.bindWishlist);
  const openCart = useStorefront((s) => s.openCart);
  const cartBump = useStorefront((s) => s.cartBump);

  const [categories, setCategories] = useState<Cat[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bumping, setBumping] = useState(false);
  const [policies, setPolicies] = useState<{ privacyPolicy: string; termsConditions: string; returnPolicy: string; announcement?: string | null } | null>(null);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);
  const [policyModal, setPolicyModal] = useState<{ title: string; text: string } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Refresh cart on every page change; close menus.
  useEffect(() => {
    getCartApi().then(setCart).catch(() => {});
    setMenuOpen(false);
    setCatsOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search, setCart]);

  // Shop branding + live categories (with product counts) from the database.
  useEffect(() => {
    bindWishlist(customer?.shop?.id, customer?.id);
    getPortalCategoriesApi().then((c: any[]) => setCategories(c || [])).catch(() => setCategories([]));
    if (customer?.shop?.code) {
      getMarketShop(customer.shop.code)
        .then((s) => setLogo(s?.logo ? resolveAssetUrl(s.logo) : null))
        .catch(() => setLogo(null));
    }
    if (customer?.shop?.id) {
      getPortalShopPoliciesApi()
        .then((p) => setPolicies(p))
        .catch(() => setPolicies(null));
    }
  }, [customer?.shop?.id, customer?.shop?.code, customer?.id, bindWishlist]);

  useEffect(() => {
    if (!cartBump) return;
    setBumping(true);
    const t = setTimeout(() => setBumping(false), 450);
    return () => clearTimeout(t);
  }, [cartBump]);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q");
    if (location.pathname === "/portal/catalog") setQuery(q || "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (catsRef.current && !catsRef.current.contains(e.target as Node)) setCatsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 30);
  }, [searchOpen]);

  // Lock page scroll while the phone menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const logout = async () => {
    await logoutCustomerApi();
    navigate("/login?tab=customer", { replace: true });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/portal/catalog?q=${encodeURIComponent(q)}` : "/portal/catalog");
  };

  const cartCount = cart?.itemCount ?? cart?.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const shopName = customer?.shop?.name || "Online store";
  const path = location.pathname;
  const onCatalog = path.startsWith("/portal/catalog") || path.startsWith("/portal/product");
  const nav: { to: string; label: string; active: boolean }[] = [
    { to: "/portal/home", label: "Home", active: path === "/portal/home" },
    { to: "/portal/catalog", label: "Shop", active: onCatalog && !catsOpen },
    { to: "/portal/orders", label: "My Orders", active: path.startsWith("/portal/orders") },
    { to: "/portal/account", label: "My Account", active: ["/portal/account", "/portal/profile", "/portal/bills", "/portal/ledger", "/portal/wishlist", "/portal/notifications"].some((p) => path.startsWith(p)) },
  ];

  const Brand = (
    <Link to="/portal/home" className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 lg:flex-none">
      <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${logo ? "bg-white" : "bg-white/10 ring-1 ring-inset ring-white/20 text-white font-bold text-[15px]"}`}>
        {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-1" onError={() => setLogo(null)} /> : <StoreIcon className="w-6 h-6" />}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[15px] sm:text-[17px] text-white leading-tight tracking-tight truncate sm:max-w-[220px]">{shopName}</span>
        <span className="block text-[11.5px] text-emerald-100/70 leading-tight">Online store</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* ───────────── Top Announcement / Promotional Bar ───────────── */}
      {policies?.announcement && !dismissedAnnouncement && (
        <div className="bg-brand-900 text-brand-50 text-[12px] sm:text-[13px] py-2 px-4 text-center font-semibold border-b border-brand-700/50 flex items-center justify-between relative shadow-xs z-50">
          <div className="flex-1 max-w-4xl mx-auto truncate px-6 text-center">
            {policies.announcement}
          </div>
          <button
            type="button"
            onClick={() => setDismissedAnnouncement(true)}
            className="text-brand-300 hover:text-white p-1 text-xs shrink-0 rounded transition hover:bg-brand-800/60"
            aria-label="Dismiss announcement"
          >
            ✕
          </button>
        </div>
      )}

      {/* ───────────── Header ───────────── */}
      <header className="sticky top-0 z-40 bg-navy-900 text-white shadow-[0_2px_12px_-4px_rgba(2,26,19,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center gap-3 lg:gap-6">
          <button type="button" onClick={() => setMenuOpen(true)} className="lg:hidden -ml-1 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10" aria-label="Open menu">
            <MenuIcon className="w-6 h-6" />
          </button>
          {Brand}

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 mx-auto" aria-label="Main">
            {nav.slice(0, 2).map((n) => (
              <NavItem key={n.to} to={n.to} label={n.label} active={n.active} icon={n.label === "Home" ? <HomeIcon className="w-[18px] h-[18px]" /> : <BagIcon className="w-[18px] h-[18px]" />} />
            ))}
            <div className="relative" ref={catsRef}>
              <button
                type="button"
                onClick={() => setCatsOpen((v) => !v)}
                aria-expanded={catsOpen}
                className={`h-11 px-4 rounded-xl inline-flex items-center gap-2 text-[14.5px] font-semibold transition ${catsOpen ? "bg-brand-600 text-white" : "text-emerald-50/90 hover:bg-white/10 hover:text-white"}`}
              >
                <GridIcon className="w-[18px] h-[18px]" /> Categories <ChevronDownIcon className={`w-4 h-4 transition ${catsOpen ? "rotate-180" : ""}`} />
              </button>
              {catsOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[min(560px,90vw)] rounded-2xl bg-white text-slate-800 shadow-lift border border-border p-3 z-50 animate-fade-in">
                  {categories.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[13px] text-slate-500">No categories yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto">
                      <Link to="/portal/catalog" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50">
                        <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center"><GridIcon className="w-[18px] h-[18px]" /></span>
                        <span className="text-[13.5px] font-semibold text-navy-900">All products</span>
                      </Link>
                      {categories.map((c) => (
                        <Link key={c.id} to={`/portal/catalog?category=${c.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50">
                          <span className="w-9 h-9 rounded-lg bg-slate-50 text-brand-700 flex items-center justify-center"><KindIcon kind={productKind(c.name)} className="w-[18px] h-[18px]" /></span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-navy-900 truncate capitalize">{c.name.toLowerCase()}</span>
                            {c.productCount !== undefined && <span className="block text-[11.5px] text-slate-400">{c.productCount} product{c.productCount === 1 ? "" : "s"}</span>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {nav.slice(2).map((n) => (
              <NavItem key={n.to} to={n.to} label={n.label} active={n.active} icon={n.label === "My Orders" ? <OrdersIcon className="w-[18px] h-[18px]" /> : <UserIcon className="w-[18px] h-[18px]" />} />
            ))}
          </nav>


          {/* Actions */}
          <div className="flex items-center gap-0 sm:gap-1 shrink-0">
            <IconBtn label="Search products" onClick={() => setSearchOpen((v) => !v)} active={searchOpen}>
              <SearchIcon className="w-[22px] h-[22px]" />
            </IconBtn>
            <IconBtn label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`} onClick={openCart} dataCart>
              <CartIcon className={`w-[22px] h-[22px] transition-transform ${bumping ? "scale-125" : ""}`} />
              {cartCount > 0 && <Badge n={cartCount} className={`bg-amber-400 !text-navy-950 ${bumping ? "scale-125" : ""}`} />}
            </IconBtn>
            <div className="relative sm:ml-1" ref={profileRef}>
              <button type="button" onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 p-1 lg:pr-2 rounded-xl hover:bg-white/10" aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Account menu">
                <span className="w-9 h-9 rounded-full bg-white text-navy-900 flex items-center justify-center font-bold text-[13px]">{initialsOf(customer?.name || "C")}</span>
                <span className="hidden xl:block text-left">
                  <span className="block text-[13px] font-semibold leading-none max-w-[120px] truncate">{customer?.name || "Customer"}</span>
                  <span className="block text-[11px] text-emerald-100/70 mt-1">Customer</span>
                </span>
                <ChevronDownIcon className="hidden xl:block w-4 h-4 text-emerald-100/70" />
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-72 rounded-2xl bg-white text-slate-800 shadow-lift border border-border py-2 z-50 animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[14px] font-semibold text-navy-900 truncate">{customer?.name}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">{customer?.phone}</p>
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span className="text-[12px] text-slate-500">{(customer?.currentBalance ?? 0) < 0 ? "Advance" : "Balance due"}</span>
                      <span className={`text-[14px] font-bold tabular ${(customer?.currentBalance ?? 0) > 0 ? "text-rose-600" : (customer?.currentBalance ?? 0) < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                        ₹{Math.abs(Number(customer?.currentBalance ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {ACCOUNT_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} role="menuitem" className="flex items-center justify-between px-4 py-2.5 text-[13.5px] text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                      {l.label}
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 my-1" />
                  <button type="button" onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-rose-600 hover:bg-rose-50 font-semibold">
                    <LogoutIcon className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search bar (toggle) */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-navy-900 animate-fade-in">
            <form onSubmit={submitSearch} role="search" className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                  placeholder="Search product by name, SKU or barcode…"
                  className="w-full h-12 pl-12 pr-28 rounded-xl bg-white text-[15px] text-navy-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-brand-500/30"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-5 rounded-lg bg-brand-600 text-white text-[13.5px] font-semibold hover:bg-brand-700">Search</button>
              </label>
            </form>
          </div>
        )}
      </header>

      {/* ───────────── Phone menu ───────────── */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-navy-950/50 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <aside className="h-full w-[min(320px,86vw)] bg-white shadow-2xl flex flex-col" aria-label="Menu">
            <div className="bg-navy-900 px-4 py-4 flex items-center justify-between">
              {Brand}
              <button type="button" onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/10" aria-label="Close menu">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} className={`flex items-center gap-3 mx-2 px-3 py-3 rounded-xl text-[15px] font-semibold ${n.active ? "bg-brand-50 text-brand-800" : "text-navy-900 hover:bg-slate-50"}`}>
                  {n.label}
                </Link>
              ))}
              <div className="px-5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Categories</div>
              {categories.length === 0 ? (
                <div className="px-5 py-2 text-[13px] text-slate-400">No categories yet.</div>
              ) : (
                categories.map((c) => (
                  <Link key={c.id} to={`/portal/catalog?category=${c.id}`} className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-[14px] text-slate-700 hover:bg-slate-50">
                    <KindIcon kind={productKind(c.name)} className="w-[18px] h-[18px] text-brand-700" />
                    <span className="flex-1 capitalize">{c.name.toLowerCase()}</span>
                    {c.productCount !== undefined && <span className="text-[12px] text-slate-400">{c.productCount}</span>}
                  </Link>
                ))
              )}
              <div className="px-5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Account</div>
              {ACCOUNT_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="flex items-center justify-between mx-2 px-3 py-2.5 rounded-xl text-[14px] text-slate-700 hover:bg-slate-50">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-100">
              <button type="button" onClick={logout} className="w-full h-11 rounded-xl text-rose-600 font-semibold hover:bg-rose-50 inline-flex items-center justify-center gap-2">
                <LogoutIcon className="w-4 h-4" /> Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main key={location.pathname} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 md:pb-12 animate-fade-in">
        <Outlet />
      </main>

      {/* ───────────── Footer (Desktop only) ───────────── */}
      <footer className="hidden md:block bg-navy-900 text-emerald-50/75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-8 text-[13.5px]">
          <div>
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden ${logo ? "bg-white" : "bg-white/10 text-white"}`}>
                {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-1" /> : <StoreIcon className="w-6 h-6" />}
              </span>
              <div>
                <div className="text-[16px] font-bold text-white leading-tight">{shopName}</div>
                <div className="text-[12px] text-emerald-100/60">Powered by NSYU Business</div>
              </div>
            </div>
            <p className="mt-4 max-w-sm leading-relaxed">Browse {shopName}'s products, order online and track every order and bill in one place.</p>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Quick links</div>
            <ul className="mt-3 space-y-2">
              {[
                ["/portal/home", "Home"],
                ["/portal/catalog", "Shop"],
                ["/portal/catalog", "Categories"],
                ["/portal/orders", "My Orders"],
                ["/portal/account", "My Account"],
              ].map(([to, label]) => (
                <li key={label}><Link to={to} className="hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Information</div>
            <ul className="mt-3 space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => setPolicyModal({ title: "Privacy Policy", text: policies?.privacyPolicy || "" })}
                  className="hover:text-white text-left transition"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPolicyModal({ title: "Terms & Conditions", text: policies?.termsConditions || "" })}
                  className="hover:text-white text-left transition"
                >
                  Terms & Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPolicyModal({ title: "Return & Refund Policy", text: policies?.returnPolicy || "" })}
                  className="hover:text-white text-left transition"
                >
                  Return Policy
                </button>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Customer support</div>
            <ul className="mt-3 space-y-2.5">
              {customer?.shop?.phone && (
                <li className="flex items-start gap-2.5"><PhoneIcon className="w-4 h-4 mt-0.5 shrink-0" /><a href={`tel:${customer.shop.phone}`} className="hover:text-white tabular">{customer.shop.phone}</a></li>
              )}
              {customer?.shop?.email && (
                <li className="flex items-start gap-2.5"><MailIcon className="w-4 h-4 mt-0.5 shrink-0" /><a href={`mailto:${customer.shop.email}`} className="hover:text-white break-all">{customer.shop.email}</a></li>
              )}
              {customer?.shop?.address && (
                <li className="flex items-start gap-2.5"><PinIcon className="w-4 h-4 mt-0.5 shrink-0" /><span>{customer.shop.address}</span></li>
              )}
              {!customer?.shop?.phone && !customer?.shop?.email && !customer?.shop?.address && <li className="text-emerald-100/50">Contact details not added by the shop yet.</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row gap-1 items-center justify-between text-[12.5px] text-emerald-100/60">
            <span>© {new Date().getFullYear()} {shopName}. All rights reserved.</span>
            <span>NSYU Business</span>
          </div>
        </div>
      </footer>

      {policyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in text-navy-900">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy-900">{policyModal.title}</h3>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close dialog"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] text-[13.5px] leading-relaxed text-slate-600">
              {policyModal.text ? (
                <div className="whitespace-pre-wrap">{policyModal.text}</div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📜</div>
                  <p className="font-semibold text-slate-800">No published policy text yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {shopName} has not published a specific {policyModal.title.toLowerCase()} yet. Please contact the shop directly for details or assistance.
                  </p>
                  {(customer?.shop?.phone || customer?.shop?.email) && (
                    <div className="mt-4 text-xs text-brand-700 font-semibold space-y-1">
                      {customer?.shop?.phone && <div>📞 {customer.shop.phone}</div>}
                      {customer?.shop?.email && <div>✉️ {customer.shop.email}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="px-5 py-2 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <CartDrawer />
      <MobileBottomNav mode="portal" />
    </div>
  );
}

const ACCOUNT_LINKS = [
  { to: "/portal/account", label: "My account" },
  { to: "/portal/orders", label: "My orders" },
  { to: "/portal/bills", label: "Bills & invoices" },
  { to: "/portal/ledger", label: "Khata / statement" },
  { to: "/portal/profile", label: "Profile & password" },
];

function NavItem({ to, label, active, icon }: { to: string; label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={`h-11 px-4 rounded-xl inline-flex items-center gap-2 text-[14.5px] font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm" : "text-emerald-50/90 hover:bg-white/10 hover:text-white"}`}
    >
      {icon}
      {label}
    </NavLink>
  );
}

function IconBtn({ label, onClick, children, active, dataCart }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; dataCart?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      {...(dataCart ? { "data-cart-target": true } : {})}
      className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition ${active ? "bg-white/15 text-white" : "text-emerald-50/90 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function Badge({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`absolute top-0.5 right-0.5 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center ring-2 ring-navy-900 transition-transform ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/* ───────── icons ───────── */
type IP = { className?: string };
const sv = (className: string | undefined, d: React.ReactNode) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const StoreIcon = ({ className }: IP) => sv(className, <><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 12v8h14v-8M10 20v-5h4v5" /></>);
const HomeIcon = ({ className }: IP) => sv(className, <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>);
const BagIcon = ({ className }: IP) => sv(className, <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>);
const GridIcon = ({ className }: IP) => sv(className, <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
const OrdersIcon = ({ className }: IP) => sv(className, <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>);
const UserIcon = ({ className }: IP) => sv(className, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
const SearchIcon = ({ className }: IP) => sv(className, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
const CartIcon = ({ className }: IP) => sv(className, <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></>);
const ChevronDownIcon = ({ className }: IP) => sv(className, <path d="m6 9 6 6 6-6" />);
const MenuIcon = ({ className }: IP) => sv(className, <path d="M4 6h16M4 12h16M4 18h16" />);
const CloseIcon = ({ className }: IP) => sv(className, <path d="M18 6 6 18M6 6l12 12" />);
const LogoutIcon = ({ className }: IP) => sv(className, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
const PhoneIcon = ({ className }: IP) => sv(className, <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />);
const MailIcon = ({ className }: IP) => sv(className, <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>);
const PinIcon = ({ className }: IP) => sv(className, <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
