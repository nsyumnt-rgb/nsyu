import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../../api/client";
import type { MarketShop } from "../../api/marketplace";

/** Shop card for the marketplace (real counts from the live catalog). */
export default function ShopCard({ shop }: { shop: MarketShop }) {
  const logo = resolveAssetUrl(shop.logo);
  return (
    <div className="card card-hover p-5 flex flex-col">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-navy-900 text-white flex items-center justify-center text-[18px] font-bold overflow-hidden shrink-0">
          {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : shop.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-navy-900 truncate">{shop.name}</div>
          <div className="text-[12px] text-slate-500 truncate">{shop.address || "Local shop"}</div>
        </div>
      </div>
      <div className="mt-4 text-[12.5px] text-slate-500">
        <b className="text-navy-900 tabular">{shop.inStockCount}</b> in stock · {shop.productCount} products
      </div>
      <Link to={`/market/shop/${encodeURIComponent(shop.code)}`} className="btn-secondary w-full mt-4">Visit shop</Link>
    </div>
  );
}
