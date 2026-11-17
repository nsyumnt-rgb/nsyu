import { useState } from "react";
import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import { ProductPlaceholder } from "./ProductArt";

/* Shared storefront building blocks (customer portal): product types,
   price helpers and the product card used by Shop, Product and Related rails. */

export interface Category {
  id: number;
  name: string;
  imageUrl?: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  brand?: string | null;
  unit: string;
  description?: string | null;
  mrp?: number;
  category?: Category | null;
  images?: Array<{ id: number; url: string; is_primary: boolean }>;
  pricing: {
    unitPrice: number;
    gstPercent: number;
    sellingPriceInclTax: number;
    mrp?: number;
  };
  inventory: {
    availableStock: number;
    isAvailable: boolean;
  };
}

/** Indian-grouped rupees; drops ".00" for whole amounts like a retail price tag. */
export const inr = (n: number) => {
  const v = Number(n || 0);
  const whole = Math.abs(v % 1) < 0.005;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};

/** Real price/MRP comparison from the API — no invented discounts. */
export function priceInfo(p: Product) {
  const price = Number(p.pricing?.sellingPriceInclTax || 0);
  const mrp = Number(p.pricing?.mrp ?? p.mrp ?? 0);
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { price, mrp, off };
}

export function primaryImage(p: Product) {
  return resolveAssetUrl(p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url);
}

/* ───────────────────────── Product card ───────────────────────── */

export function ProductCard({
  product,
  qty,
  updating,
  onQty,
}: {
  product: Product;
  qty: number;
  updating: boolean;
  onQty: (q: number) => void;
}) {
  const href = `/portal/product/${product.id}`;
  const img = primaryImage(product);
  const [imgFailed, setImgFailed] = useState(false);
  const { price, mrp, off } = priceInfo(product);
  const stock = product.inventory.availableStock;
  const out = stock <= 0;

  return (
    <div className="group flex flex-col">
      <Link to={href} className="relative block aspect-square rounded-[22px] bg-[#F3F4F2] overflow-hidden" aria-label={`View ${product.name}`}>
        {img && !imgFailed ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 w-full h-full object-contain p-[12%] mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.06] ${out ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <ProductPlaceholder name={product.name} category={product.category?.name} brand={product.brand} />
        )}
        {off > 0 && (
          <span className="absolute left-3 bottom-3 px-3 py-1 rounded-full bg-white text-[12px] sm:text-[13px] font-bold text-rose-600 shadow-xs">
            {off}% OFF
          </span>
        )}
        {out ? (
          <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-semibold text-slate-600">Out of stock</span>
        ) : stock <= 5 ? (
          <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-semibold text-amber-700">Only {stock} left</span>
        ) : null}
      </Link>

      <Link to={href} title={product.name} className="mt-4 text-center text-[13.5px] sm:text-[15.5px] text-slate-800 leading-snug line-clamp-2 min-h-[2.6em] hover:text-brand-700 tracking-[0.01em]">
        {product.name}
      </Link>
      <div className="mt-1.5 flex items-baseline justify-center flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-[15px] sm:text-[17px] font-bold text-navy-900 tabular">{inr(price)}</span>
        {off > 0 && <span className="text-[12.5px] sm:text-[13.5px] text-slate-400 line-through tabular">{inr(mrp)}</span>}
      </div>

      <div className="mt-3">
        {qty > 0 ? (
          <div className="mx-auto flex items-center justify-between max-w-[180px] rounded-full bg-brand-50 ring-1 ring-brand-200 p-1">
            <button type="button" disabled={updating} onClick={() => onQty(qty - 1)} className="w-8 h-8 rounded-full bg-white text-brand-800 text-[17px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50" aria-label="Decrease quantity">
              −
            </button>
            <span className="text-[13px] font-bold text-brand-800 tabular">{updating ? "…" : `${qty} in cart`}</span>
            <button type="button" disabled={updating || qty >= stock} onClick={() => onQty(qty + 1)} className="w-8 h-8 rounded-full bg-white text-brand-800 text-[17px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50" aria-label="Increase quantity">
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={updating || out}
            onClick={() => onQty(1)}
            className="mx-auto flex w-full max-w-[180px] h-10 rounded-full border border-navy-900 text-navy-900 text-[13px] font-semibold items-center justify-center gap-2 transition hover:bg-navy-900 hover:text-white disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent active:scale-[0.98]"
          >
            <CartIcon className="w-4 h-4" />
            {out ? "Out of stock" : updating ? "Adding…" : "Add to cart"}
          </button>
        )}
      </div>
    </div>
  );
}

export function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
