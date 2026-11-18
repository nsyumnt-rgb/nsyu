import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMarketShop, type MarketShopDetail } from "../../api/marketplace";
import { resolveAssetUrl } from "../../api/client";
import ListingBrowser from "./ListingBrowser";

/* MultiShop wireframe 2 — one shop's storefront, using that shop's own categories. */
export default function MarketShop() {
  const { code = "" } = useParams();
  const [shop, setShop] = useState<MarketShopDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setShop(null);
    setMissing(false);
    getMarketShop(code).then(setShop).catch(() => setMissing(true));
  }, [code]);

  if (missing) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <h1 className="text-[18px] font-bold">Shop not found</h1>
        <p className="text-[13px] text-slate-500 mt-1">It may be closed or no longer on the marketplace.</p>
        <Link to="/market/shops" className="btn-primary mt-5">Browse shops</Link>
      </div>
    );
  }
  if (!shop) return <div className="card h-40 animate-pulse" />;

  const logo = resolveAssetUrl(shop.logo);
  const banner = resolveAssetUrl(shop.banner);
  return (
    <div className="space-y-8">
      <section className={`hero-brand p-6 sm:p-8 ${banner ? "min-h-[220px] sm:min-h-[300px] flex items-end" : ""}`}>
        {banner && (
          <>
            <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/40 to-transparent" />
          </>
        )}
        <div className="relative w-full flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-20 h-20 rounded-2xl bg-white text-navy-900 flex items-center justify-center text-[30px] font-bold overflow-hidden shrink-0">
            {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : shop.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] sm:text-[32px] font-bold !text-white tracking-tight">{shop.name}</h1>
            <p className="text-[13.5px] text-brand-100/85 mt-1">
              {shop.categories.slice(0, 3).map((c) => c.name).join(" · ") || "Local shop"}
              {shop.address ? ` · ${shop.address}` : ""}
            </p>
            {!shop.acceptsOrders && <p className="mt-2 inline-block badge bg-amber-100 text-amber-800">Not taking online orders right now</p>}
          </div>
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="px-5 h-11 inline-flex items-center rounded-xl bg-white text-navy-900 font-semibold hover:bg-brand-50 self-start sm:self-auto">
              Call shop
            </a>
          )}
        </div>
      </section>

      <ListingBrowser
        fixedShopId={shop.id}
        categories={shop.categories}
        title={(q, total) => (q ? `“${q}” in ${shop.name}` : `All products${total !== null ? ` (${total})` : ""}`)}
      />
    </div>
  );
}
