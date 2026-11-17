import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import { ProductPlaceholder } from "./ProductArt";
import { flyToCart, useStorefront } from "../store/storefrontStore";

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
  const wished = useStorefront((s) => s.wishlist.includes(product.id));
  const toggleWish = useStorefront((s) => s.toggleWishlist);
  const bumpCart = useStorefront((s) => s.bumpCart);
  const imgBox = useRef<HTMLAnchorElement>(null);

  const add = () => {
    flyToCart(imgBox.current);
    bumpCart();
    onQty(1);
  };

  return (
    <div className="group relative flex flex-col h-full rounded-2xl bg-white ring-1 ring-slate-200/80 overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(4,38,29,0.35)] hover:ring-brand-200">
      <Link ref={imgBox} to={href} className="relative block aspect-square bg-[#F3F4F2] overflow-hidden" aria-label={`View ${product.name}`}>
        {img && !imgFailed ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 w-full h-full object-contain p-[11%] mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.07] ${out ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <ProductPlaceholder name={product.name} category={product.category?.name} brand={product.brand} />
        )}
        {off > 0 && (
          <span className="absolute left-3 bottom-3 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11.5px] font-bold tracking-wide shadow-sm">{off}% OFF</span>
        )}
        {out && <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center py-1.5 rounded-lg bg-white/90 text-[12px] font-semibold text-slate-600">Out of stock</span>}
      </Link>

      <button
        type="button"
        onClick={() => toggleWish(product.id)}
        aria-pressed={wished}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        className={`absolute left-2.5 top-2.5 w-9 h-9 rounded-full bg-white/95 shadow-sm ring-1 ring-slate-200/70 flex items-center justify-center transition active:scale-90 ${wished ? "text-rose-600" : "text-slate-400 hover:text-rose-500"}`}
      >
        <HeartIcon filled={wished} className="w-[18px] h-[18px]" />
      </button>

      <div className="flex flex-col flex-1 p-3 sm:p-3.5">
        {product.brand && <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">{product.brand}</span>}
        <Link to={href} title={product.name} className="mt-0.5 text-[13.5px] sm:text-[14px] font-semibold text-navy-900 leading-snug line-clamp-2 min-h-[2.6em] hover:text-brand-700">
          {product.name}
        </Link>
        <div className="mt-1 text-[11.5px] font-medium">
          {out ? <span className="text-slate-400">Currently unavailable</span> : stock <= 5 ? <span className="text-amber-600">Only {stock} left</span> : <span className="text-emerald-600">In stock</span>}
        </div>

        <div className="mt-auto pt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[16px] sm:text-[17px] font-bold text-navy-900 tabular leading-none">{inr(price)}</div>
            {off > 0 && <div className="mt-1 text-[12px] text-slate-400 line-through tabular">{inr(mrp)}</div>}
          </div>
          {qty > 0 ? (
            <div className="flex items-center rounded-xl bg-brand-600 text-white h-10 shadow-brand">
              <button type="button" disabled={updating} onClick={() => onQty(qty - 1)} className="w-8 h-full text-[17px] font-bold disabled:opacity-60" aria-label="Decrease quantity">−</button>
              <span className="w-6 text-center text-[13.5px] font-bold tabular">{updating ? "…" : qty}</span>
              <button type="button" disabled={updating || qty >= stock} onClick={() => { bumpCart(); onQty(qty + 1); }} className="w-8 h-full text-[17px] font-bold disabled:opacity-40" aria-label="Increase quantity">+</button>
            </div>
          ) : (
            <button
              type="button"
              disabled={updating || out}
              onClick={add}
              aria-label={`Add ${product.name} to cart`}
              className="w-10 h-10 shrink-0 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-brand transition hover:bg-brand-700 active:scale-90 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {updating ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CartIcon className="w-[18px] h-[18px]" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Skeleton placeholder matching ProductCard's footprint. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200/80 overflow-hidden">
      <div className="aspect-square bg-slate-100 animate-pulse" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
        <div className="h-3.5 w-5/6 rounded bg-slate-100 animate-pulse" />
        <div className="h-3.5 w-2/3 rounded bg-slate-100 animate-pulse" />
        <div className="flex items-end justify-between pt-2">
          <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
          <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
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
