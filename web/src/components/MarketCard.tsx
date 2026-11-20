import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import { setMarketCartItem, type MarketListing } from "../api/marketplace";
import { usePortalStore } from "../store/portalStore";
import { useWishlistStore } from "../store/wishlistStore";
import { ProductPlaceholder } from "./ProductArt";

/** Rupees with Indian grouping; whole amounts without ".00". */
export const rupees = (n: number) => {
  const v = Number(n || 0);
  const whole = Math.abs(v % 1) < 0.005;
  return (
    "₹" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    })
  );
};

export const listingHref = (l: Pick<MarketListing, "productId" | "shop">) =>
  `/market/p/${l.shop.id}/${l.productId}`;

/** Product listing card matching NSYU Market Home mockup (Image 1) */
export default function MarketCard({
  listing,
  onAddedToCart,
}: {
  listing: MarketListing;
  onAddedToCart?: () => void;
}) {
  const navigate = useNavigate();
  const customer = usePortalStore((s) => s.customer);
  const { toggleProduct, hasProduct } = useWishlistStore();

  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const img = resolveAssetUrl(listing.imageUrl);
  const href = listingHref(listing);
  const isWishlisted = hasProduct(listing.productId);

  const discount =
    listing.discountPercent > 0
      ? listing.discountPercent
      : listing.mrp && listing.mrp > listing.price
      ? Math.round(((listing.mrp - listing.price) / listing.mrp) * 100)
      : 0;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!customer) {
      window.dispatchEvent(new CustomEvent("open-login-modal", { detail: { tab: "customer" } }));
      return;
    }

    setAdding(true);
    try {
      await setMarketCartItem(listing.shop.id, listing.productId, 1);
      window.dispatchEvent(new CustomEvent("market-cart-changed"));
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      if (onAddedToCart) onAddedToCart();
    } catch {
      // Fallback redirect to product page if error occurs (e.g. stock limitation)
      navigate(href);
    } finally {
      setAdding(false);
    }
  }

  function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleProduct(listing.productId);
  }

  return (
    <div className="market-card group p-3 flex flex-col relative [transform-style:preserve-3d]">
      
      {/* Top Media Container - Airy photo tile with soft warm background */}
      <div className="relative w-full aspect-square bg-gradient-to-br from-[#FAF9F5] to-emerald-50/40 rounded-xl border border-[#EAE7DD]/70 overflow-hidden flex items-center justify-center p-3 mb-2.5 transition-colors group-hover:border-brand-200">
        
        {/* Top-Left Discount Badge */}
        {discount > 0 && (
          <span className="absolute left-2.5 top-2.5 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
            {discount}% OFF
          </span>
        )}

        {/* Top-Right Wishlist Heart Button with micro-bounce */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute right-2.5 top-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-xs ${
            isWishlisted
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
              : "bg-white/95 text-gray-400 hover:text-rose-600 hover:bg-white"
          }`}
        >
          <svg
            className={`w-3.5 h-3.5 ${isWishlisted ? "fill-rose-600 stroke-rose-600" : "fill-none stroke-current"}`}
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Product Image Link */}
        <Link to={href} className="w-full h-full flex items-center justify-center">
          {img && !failed ? (
            <img
              src={img}
              alt={listing.name}
              loading="lazy"
              onError={() => setFailed(true)}
              className={`max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105 ${
                listing.inStock ? "" : "opacity-40 grayscale"
              }`}
            />
          ) : (
            <ProductPlaceholder
              name={listing.name}
              category={listing.category}
              brand={listing.brand}
            />
          )}
        </Link>

        {/* Out of stock label */}
        {!listing.inStock && (
          <span className="absolute bottom-2 inset-x-2 text-center py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
            Out of stock
          </span>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 flex flex-col justify-between space-y-2">
        <div>
          {/* Shop / Branch tag */}
          {listing.shop?.name && (
            <span className="text-[10px] font-semibold text-brand-700 tracking-wide uppercase line-clamp-1 mb-0.5">
              {listing.shop.name}
            </span>
          )}

          {/* Product Title */}
          <Link
            to={href}
            className="block text-xs sm:text-[13px] font-bold text-navy-900 leading-snug line-clamp-2 hover:text-brand-700 transition"
            title={listing.name}
          >
            {listing.name}
          </Link>

          {/* Pricing Row */}
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-sm sm:text-base font-black text-gray-900 tracking-tight tabular">
              {rupees(listing.price)}
            </span>
            {listing.mrp && listing.mrp > listing.price && (
              <span className="text-[11px] text-gray-400 line-through font-medium tabular">
                {rupees(listing.mrp)}
              </span>
            )}
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!listing.inStock || adding}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs ${
            added
              ? "bg-brand-800 text-white"
              : listing.inStock
              ? "bg-brand-700 hover:bg-brand-800 text-white shadow-brand active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {adding ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : added ? (
            <>
              <span>✓</span>
              <span>Added to Cart</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>{listing.inStock ? "Add to Cart" : "Out of Stock"}</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
