import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketCategories, getMarketShops, searchMarket, type MarketListing, type MarketShop } from "../../api/marketplace";
import { resolveAssetUrl } from "../../api/client";
import MarketCard from "../../components/MarketCard";
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
        <div className="relative hidden lg:grid grid-cols-3 gap-3">
          {products.slice(0, 6).map((p) => (
            <Link key={`${p.shop.id}-${p.productId}`} to={`/market/p/${p.shop.id}/${p.productId}`} className="aspect-square rounded-2xl bg-white/95 p-3 flex items-center justify-center hover:scale-[1.03] transition">
              {p.imageUrl ? <img src={resolveAssetUrl(p.imageUrl) ?? undefined} alt={p.name} className="max-h-full max-w-full object-contain mix-blend-multiply" /> : <span className="text-[11px] text-slate-400 text-center line-clamp-3">{p.name}</span>}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section>
        <SectionHead title="Shop by category" to="/market/search" />
        {categories.length === 0 && !loading ? (
          <p className="text-[13px] text-slate-500">No categories yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {(loading ? Array.from({ length: 6 }) : categories.slice(0, 12)).map((c: any, i) => (
              <Link
                key={c?.name ?? i}
                to={c ? `/market/search?category=${encodeURIComponent(c.name)}` : "#"}
                className="card card-hover p-4 flex flex-col items-center text-center gap-2.5"
              >
                <span className="w-16 h-16 rounded-full bg-[#EEEEEE] flex items-center justify-center overflow-hidden">
                  {c?.imageUrl ? (
                    <img src={resolveAssetUrl(c.imageUrl) ?? undefined} alt="" className="w-[72%] h-[72%] object-contain mix-blend-multiply" />
                  ) : (
                    <span className="text-[20px] font-bold text-slate-400">{c?.name?.charAt(0) ?? ""}</span>
                  )}
                </span>
                <span className="text-[13px] font-semibold text-navy-900 line-clamp-2">{c?.name ?? <span className="block w-16 h-3 bg-slate-100 rounded" />}</span>
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
              <span className="w-11 h-11 mx-auto rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center">{n}</span>
              <div className="mt-3 text-[15px] font-semibold text-navy-900">{t}</div>
              <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold">Own a shop? Start selling</h2>
          <p className="text-[13px] text-slate-500 mt-1">Billing, stock, khata and your own online store in one app.</p>
        </div>
        <Link to="/register" className="btn-navy btn-lg">Register your shop</Link>
      </section>
    </div>
  );
}

function SectionHead({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">{title}</h2>
      <Link to={to} className="text-[13.5px] font-semibold text-brand-700 hover:underline">View all</Link>
    </div>
  );
}
