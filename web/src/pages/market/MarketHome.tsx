import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketCategories, getMarketShops, searchMarket, type MarketListing, type MarketShop } from "../../api/marketplace";
import { resolveAssetUrl } from "../../api/client";
import MarketCard, { rupees, listingHref } from "../../components/MarketCard";
import { KindIcon, ProductPlaceholder, productKind, tintFor } from "../../components/ProductArt";
import ShopCard from "./ShopCard";

/* MultiShop wireframe 1 — marketplace home. All content comes from the live catalog. */

export default function MarketHome() {
  const [categories, setCategories] = useState<{ name: string; count: number; imageUrl: string | null }[]>([]);
  const [products, setProducts] = useState<MarketListing[]>([]);
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMarketCategories().catch(() => []),
      searchMarket({ sort: "newest", inStock: true, limit: 8 }).catch(() => ({ data: [] as MarketListing[] })),
      getMarketShops({ limit: 6 }).catch(() => ({ data: [] as MarketShop[] })),
    ])
      .then(([c, p, s]) => {
        setCategories(c);
        setProducts(p.data);
        setShops(s.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="hero-brand px-6 py-10 sm:px-12 sm:py-14 grid lg:grid-cols-2 gap-8 items-center">
        <div className="absolute -right-16 -bottom-24 w-80 h-80 rounded-full bg-white/[0.05]" />
        <div className="relative">
          <h1 className="text-[32px] sm:text-[46px] font-bold leading-[1.08] tracking-tight !text-white">Shop from local stores, delivered to your door</h1>
          <p className="mt-4 text-[15px] sm:text-[17px] text-brand-100/85 max-w-xl">Compare prices across shops, order online and track every order.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/market/search" className="px-6 h-12 inline-flex items-center rounded-xl bg-white text-navy-900 font-semibold hover:bg-brand-50">Start shopping</Link>
            <Link to="/register" className="px-6 h-12 inline-flex items-center rounded-xl ring-1 ring-white/40 text-white font-semibold hover:bg-white/10">Open your shop</Link>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between px-1 pb-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-100/80">Just added</span>
              <Link to="/market/search?sort=newest" className="text-[12.5px] font-semibold text-white/90 hover:text-white">See all →</Link>
            </div>
            <ul className="space-y-2">
              {(loading ? Array.from({ length: 4 }) : products.slice(0, 4)).map((p: any, i) => (
                <li key={p ? `${p.shop.id}-${p.productId}` : i}>
                  {p ? (
                    <Link to={listingHref(p)} className="flex items-center gap-3 rounded-xl bg-white p-2.5 pr-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition">
                      <span className="relative w-14 h-14 rounded-lg overflow-hidden bg-[#F3F4F2] shrink-0">
                        {p.imageUrl ? <img src={resolveAssetUrl(p.imageUrl) ?? undefined} alt="" className="absolute inset-0 w-full h-full object-contain p-1.5 mix-blend-multiply" /> : <ProductPlaceholder name={p.name} category={p.category} compact />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-navy-900 truncate">{p.name}</span>
                        <span className="block text-[12px] text-slate-500 truncate">{p.shop.name}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[14px] font-bold text-navy-900 tabular">{rupees(p.price)}</span>
                        {p.discountPercent > 0 && <span className="block text-[11px] font-semibold text-rose-600">{p.discountPercent}% off</span>}
                      </span>
                    </Link>
                  ) : (
                    <div className="h-[76px] rounded-xl bg-white/15 animate-pulse" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <SectionHead title="Shop by category" to="/market/search" />
        {categories.length === 0 && !loading ? (
          <p className="text-[13px] text-slate-500">No categories yet.</p>
        ) : (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-2 [scrollbar-width:thin]">
            {(loading ? Array.from({ length: 6 }) : categories.slice(0, 12)).map((c: any, i) => (
              <Link
                key={c?.name ?? i}
                to={c ? `/market/search?category=${encodeURIComponent(c.name)}` : "#"}
                className="group card card-hover p-4 flex flex-col items-center text-center gap-2.5 snap-start shrink-0 w-[128px] sm:w-[150px]"
              >
                <span className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden transition group-hover:scale-105 ${c ? catTint(c.name) : "bg-slate-100"}`}>
                  {c?.imageUrl ? (
                    <img src={resolveAssetUrl(c.imageUrl) ?? undefined} alt="" className="w-[72%] h-[72%] object-contain mix-blend-multiply" />
                  ) : c ? (
                    <KindIcon kind={productKind(c.name)} className="w-7 h-7" />
                  ) : null}
                </span>
                <span className="text-[13px] font-semibold text-navy-900 line-clamp-2 capitalize">{c?.name?.toLowerCase() ?? <span className="block w-16 h-3 bg-slate-100 rounded" />}</span>
                {c && <span className="text-[11px] text-slate-400 -mt-1.5">{c.count} items</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* New arrivals */}
      <section>
        <SectionHead title="New arrivals" to="/market/search?sort=newest" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="card aspect-[3/4] animate-pulse" />)
            : products.map((p) => <MarketCard key={`${p.shop.id}-${p.productId}`} listing={p} />)}
        </div>
      </section>

      {/* Shops */}
      <section>
        <SectionHead title="Shops" to="/market/shops" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-40 animate-pulse" />) : shops.map((s) => <ShopCard key={s.id} shop={s} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="card p-6 sm:p-10">
        <h2 className="text-[22px] font-semibold text-center">How it works</h2>
        <div className="mt-8 grid sm:grid-cols-3 gap-6">
          {[
            ["1", "Find", "Search across local shops and compare prices for the same product."],
            ["2", "Order", "Order online from the shop you choose — delivery or pickup."],
            ["3", "Track", "Follow each order from placed to delivered and keep your bills."],
          ].map(([n, t, d]) => (
            <div key={n} className="text-center">
              <span className="relative w-14 h-14 mx-auto rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{STEP_ICONS[n]}</svg>
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">{n}</span>
              </span>
              <div className="mt-3 text-[15px] font-semibold text-navy-900">{t}</div>
              <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hero-brand px-6 py-8 sm:px-10 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative max-w-xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-100/80">For shop owners</p>
          <h2 className="mt-2 text-[22px] sm:text-[26px] font-bold tracking-tight !text-white">Own a shop? Start selling online today.</h2>
          <p className="text-[14px] text-brand-50/80 mt-2">Billing, stock, khata and your own online store — in one app, on web and phone.</p>
        </div>
        <div className="relative flex flex-wrap gap-3 shrink-0">
          <Link to="/register" className="px-6 h-12 inline-flex items-center rounded-xl bg-white text-navy-900 font-semibold hover:bg-brand-50">Register your shop</Link>
          <Link to="/login" className="px-6 h-12 inline-flex items-center rounded-xl ring-1 ring-white/40 text-white font-semibold hover:bg-white/10">Owner login</Link>
        </div>
      </section>
    </div>
  );
}

const catTint = (name: string) => {
  const t = tintFor(`${name}|${productKind(name)}`);
  return `bg-gradient-to-br ${t.bg} ${t.fg}`;
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  "1": <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  "2": <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  "3": <><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
};

function SectionHead({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800 min-h-[40px]">
        View all
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </div>
  );
}
