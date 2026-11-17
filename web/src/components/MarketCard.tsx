import { useState } from "react";
import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import type { MarketListing } from "../api/marketplace";
import { ProductPlaceholder } from "./ProductArt";

/** Rupees with Indian grouping; whole amounts without ".00". */
export const rupees = (n: number) => {
  const v = Number(n || 0);
  const whole = Math.abs(v % 1) < 0.005;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};

export const listingHref = (l: Pick<MarketListing, "productId" | "shop">) => `/market/p/${l.shop.id}/${l.productId}`;

/** Product listing card for the public marketplace (one product sold by one shop). */
export default function MarketCard({ listing }: { listing: MarketListing }) {
  const [failed, setFailed] = useState(false);
  const img = resolveAssetUrl(listing.imageUrl);
  const href = listingHref(listing);

  return (
    <div className="group card overflow-hidden flex flex-col transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5">
      <Link to={href} className="relative block aspect-square bg-[#F3F4F2] overflow-hidden" aria-label={listing.name}>
        {img && !failed ? (
          <img
            src={img}
            alt={listing.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className={`absolute inset-0 w-full h-full object-contain p-[12%] mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.05] ${listing.inStock ? "" : "opacity-50 grayscale"}`}
          />
        ) : (
          <ProductPlaceholder name={listing.name} category={listing.category} brand={listing.brand} />
        )}
        {listing.discountPercent > 0 && (
          <span className="absolute left-3 bottom-3 px-2.5 py-0.5 rounded-full bg-white text-[12px] font-bold text-rose-600 shadow-xs">{listing.discountPercent}% off</span>
        )}
        {!listing.inStock && <span className="absolute right-3 top-3 px-2 py-0.5 rounded-full bg-white/95 text-[11px] font-semibold text-slate-600">Out of stock</span>}
      </Link>
      <div className="p-3.5 flex flex-col flex-1">
        <Link to={href} className="text-[13.5px] font-semibold text-navy-900 leading-snug line-clamp-2 min-h-[2.6em] hover:text-brand-700" title={listing.name}>
          {listing.name}
        </Link>
        <Link to={`/market/shop/${encodeURIComponent(listing.shop.code)}`} className="mt-1 text-[12px] text-slate-500 hover:text-brand-700 truncate">
          {listing.shop.name}
        </Link>
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[16px] font-bold text-navy-900 tabular leading-none">{rupees(listing.price)}</div>
            {listing.discountPercent > 0 && <div className="text-[11.5px] text-slate-400 line-through tabular mt-1">{rupees(listing.mrp)}</div>}
          </div>
          <Link to={href} aria-label={`View ${listing.name}`} className="w-9 h-9 shrink-0 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center transition group-hover:bg-brand-600 group-hover:text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
