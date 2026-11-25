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
      : 17;

  const displayMrp =
    listing.mrp && listing.mrp > listing.price
      ? listing.mrp
      : Math.round(listing.price * 1.2);

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!customer) {
      sessionStorage.setItem("pending_cart_item", JSON.stringify({ shopId: listing.shop.id, productId: listing.productId, qty: 1 }));
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
    } catch (err: any) {
      console.error("Failed to add to cart:", err);
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
    <div className="bg-white rounded-2xl border border-slate-100/90 shadow-2xs hover:shadow-md transition-all duration-200 p-3 flex flex-col relative group">
      
      {/* Top Media Container - Clean white background matching Image 1 */}
      <div className="relative w-full aspect-square bg-white rounded-xl overflow-hidden flex items-center justify-center p-2 mb-2.5">
        
        {/* Top-Left Red Discount Badge */}
        {discount > 0 && (
          <span className="absolute left-1.5 top-1.5 z-10 px-1.5 py-0.5 rounded bg-[#EF4444] text-white text-[10px] font-bold shadow-2xs">
            {discount}% OFF
          </span>
        )}

        {/* Top-Right Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute right-1.5 top-1.5 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
            isWishlisted
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
              : "text-slate-400 hover:text-rose-600 bg-white/80"
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
          {/* Product Title (Clean, 1-2 lines, bold black) */}
          <Link
            to={href}
            className="block text-xs sm:text-[13px] font-bold text-slate-900 leading-snug line-clamp-1 hover:text-brand-700 transition"
            title={listing.name}
          >
            {listing.name}
          </Link>

          {/* Pricing Row: Price + MRP Strikethrough */}
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold text-navy-900 tracking-tight tabular">
              {rupees(listing.price)}
            </span>
            <span className="text-[11px] text-slate-400 line-through font-medium tabular">
              {rupees(displayMrp)}
            </span>
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!listing.inStock || adding}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${
            added
              ? "bg-[#064E3B] text-white"
              : listing.inStock
              ? "bg-[#047857] hover:bg-[#064E3B] text-white active:scale-[0.98]"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
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
