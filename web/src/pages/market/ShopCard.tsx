import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../../api/client";
import type { MarketShop } from "../../api/marketplace";
import { initialsOf, shopGradient } from "../../components/ProductArt";

/** Shop card for the marketplace (real counts from the live catalog). */
export default function ShopCard({ shop }: { shop: MarketShop }) {
  const logo = resolveAssetUrl(shop.logo);
  return (
    <div className="card card-hover p-5 flex flex-col">
      <div className="flex items-center gap-3">
        <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${shopGradient(shop.name)} text-white flex items-center justify-center text-[16px] font-bold tracking-wide shadow-sm overflow-hidden shrink-0`}>
          {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : initialsOf(shop.name)}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-navy-900 truncate">{shop.name}</div>
          <div className="text-[12px] text-slate-500 truncate">{shop.address || "Local shop"}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12px]">
        <span className="badge bg-brand-50 text-brand-700"><b className="tabular">{shop.inStockCount}</b> in stock</span>
        <span className="badge bg-slate-100 text-slate-600"><b className="tabular">{shop.productCount}</b> products</span>
      </div>
      <Link to={`/market/shop/${encodeURIComponent(shop.code)}`} className="btn-secondary w-full mt-4">Visit shop</Link>
    </div>
  );
}
