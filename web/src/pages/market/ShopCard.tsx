import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../../api/client";
import type { MarketShop } from "../../api/marketplace";
import { initialsOf } from "../../components/ProductArt";
import { useWishlistStore } from "../../store/wishlistStore";

// Themed stock cover photos matching screenshot categories
const SHOP_THEME_PHOTOS: Record<string, string> = {
  nsyu: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
  "237746": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80",
  "313801": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
  "342601": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
  "373758": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80",
  "451270": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80",
  west: "https://images.unsplash.com/photo-1556742049-0a67e55722c0?auto=format&fit=crop&w=600&q=80",
  "199419": "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80",
};

// Distinct colors for avatar badge
function getShopBadgeColor(name: string, code: string) {
  const str = (name + code).toLowerCase();
  if (str.includes("nsyu")) return "bg-blue-600";
  if (str.includes("237")) return "bg-emerald-600";
  if (str.includes("313")) return "bg-emerald-600";
  if (str.includes("342")) return "bg-blue-700";
  if (str.includes("373")) return "bg-blue-600";
  if (str.includes("supreme") || str.includes("451")) return "bg-blue-700";
  if (str.includes("west")) return "bg-rose-600";
  return "bg-teal-600";
}

function getShopCoverUrl(shop: MarketShop) {
  if (shop.logo) {
    const resolved = resolveAssetUrl(shop.logo);
    if (resolved) return resolved;
  }
  const key = Object.keys(SHOP_THEME_PHOTOS).find(
    (k) =>
      shop.code.toLowerCase().includes(k) ||
      shop.name.toLowerCase().includes(k)
  );
  if (key) return SHOP_THEME_PHOTOS[key];
  return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80";
}

export default function ShopCard({
  shop,
  isListView = false,
}: {
  shop: MarketShop;
  isListView?: boolean;
}) {
  const { hasShop, toggleShop } = useWishlistStore();
  const isFavorite = hasShop(shop.code);
  const coverUrl = getShopCoverUrl(shop);
  const badgeColor = getShopBadgeColor(shop.name, shop.code);
  const shopHref = `/market/shop/${encodeURIComponent(shop.code)}`;

  const badgeText = shop.name.startsWith("Shop")
    ? shop.code.slice(-2) || "S"
    : initialsOf(shop.name).slice(0, 2);

  if (isListView) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row items-center gap-4">
        {/* Cover Thumbnail */}
        <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden bg-slate-100 relative shrink-0">
          <img
            src={coverUrl}
            alt={shop.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleShop(shop.code);
            }}
            aria-label="Favorite Shop"
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition ${
              isFavorite
                ? "bg-rose-50 text-rose-600"
                : "bg-white/90 text-slate-400 hover:text-rose-600"
            }`}
          >
            <svg
              className={`w-4 h-4 ${
                isFavorite ? "fill-rose-600 stroke-rose-600" : "fill-none stroke-current"
              }`}
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-md ${badgeColor} text-white font-black text-[10px] flex items-center justify-center shrink-0`}
            >
              {badgeText}
            </span>
            <Link
              to={shopHref}
              className="text-sm font-extrabold text-navy-900 truncate hover:text-brand-700 transition"
            >
              {shop.name}
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
            <span>📍</span>
            <span>{shop.address || "Local Partner Store"}</span>
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              🛒 {shop.inStockCount} in stock
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              📦 {shop.productCount} products
            </span>
          </div>
        </div>

        {/* Visit Button */}
        <Link
          to={shopHref}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs shrink-0"
        >
          <span>Visit Shop</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition duration-200 flex flex-col">
      {/* Top Banner / Cover */}
      <div className="h-32 w-full bg-slate-100 relative overflow-hidden">
        <img
          src={coverUrl}
          alt={shop.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleShop(shop.code);
          }}
          aria-label="Favorite Shop"
          className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition ${
            isFavorite
              ? "bg-rose-50 text-rose-600"
              : "bg-white/90 text-slate-400 hover:text-rose-600 hover:bg-white"
          }`}
        >
          <svg
            className={`w-4 h-4 ${
              isFavorite ? "fill-rose-600 stroke-rose-600" : "fill-none stroke-current"
            }`}
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Card Body */}
      <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Shop Avatar Badge & Name */}
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-lg ${badgeColor} text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs`}
            >
              {badgeText}
            </span>
            <Link
              to={shopHref}
              className="font-extrabold text-navy-900 text-xs sm:text-[13px] truncate hover:text-brand-700 transition block"
              title={shop.name}
            >
              {shop.name}
            </Link>
          </div>

          {/* Location / Address */}
          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate font-medium">
            <span className="text-slate-400">📍</span>
            <span className="truncate">{shop.address || "Local Partner Store"}</span>
          </div>

          {/* Stock Metrics */}
          <div className="pt-1 flex items-center gap-2 text-[10.5px] font-semibold text-slate-500">
            <span>🛒 {shop.inStockCount} in stock</span>
            <span>|</span>
            <span>📦 {shop.productCount} products</span>
          </div>
        </div>

        {/* Visit Shop Button */}
        <Link
          to={shopHref}
          className="w-full py-2 px-3 rounded-xl bg-[#047857] hover:bg-emerald-800 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs text-center"
        >
          <span>Visit Shop</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
