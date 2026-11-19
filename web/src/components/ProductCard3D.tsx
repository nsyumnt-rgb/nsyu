import { useState, useRef, useCallback, useEffect } from "react";
import type { Product } from "../types";
import { resolveAssetUrl } from "../api/client";

interface ProductCard3DProps {
  product: Product;
  onAddToCart: (product: Product, qty: number) => void;
  onViewDetails: (product: Product) => void;
  index?: number;
}

// Category fallback icons when image is not present
function FallbackProductIcon({ categoryName, name }: { categoryName?: string; name: string }) {
  const lower = (name + " " + (categoryName || "")).toLowerCase();

  if (lower.includes("cable") || lower.includes("wire") || lower.includes("cord")) {
    return (
      <svg className="w-16 h-16 text-emerald-700/80 stroke-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" strokeWidth="1.8" />
        <path d="M2 20h20" strokeWidth="1.8" />
        <line x1="14" y1="10" x2="14" y2="10.01" strokeWidth="2.5" />
        <line x1="10" y1="10" x2="10" y2="10.01" strokeWidth="2.5" />
      </svg>
    );
  }
  if (lower.includes("charger") || lower.includes("power") || lower.includes("adapter")) {
    return (
      <svg className="w-16 h-16 text-emerald-700/80 stroke-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="5" y="2" width="14" height="20" rx="3" ry="3" strokeWidth="1.8" />
        <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
        <path d="M9 7h6M9 11h6" strokeWidth="1.8" />
      </svg>
    );
  }
  if (lower.includes("audio") || lower.includes("earbud") || lower.includes("headphone")) {
    return (
      <svg className="w-16 h-16 text-emerald-700/80 stroke-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" strokeWidth="1.8" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg className="w-16 h-16 text-emerald-700/80 stroke-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="1.8" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeWidth="1.8" />
      <line x1="12" y1="22.08" x2="12" y2="12" strokeWidth="1.8" />
    </svg>
  );
}

export default function ProductCard3D({ product, onAddToCart, onViewDetails, index = 0 }: ProductCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Tilt State
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glare, setGlare] = useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Stock calculation
  const stock = Number(product.stocks?.[0]?.current_stock ?? 0);
  const minStock = Number(product.min_stock ?? 5) || 5;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= minStock;

  // Primary image
  const coverUrl = product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url;
  const imageSrc = resolveAssetUrl(coverUrl);

  // Price & Discount calculation
  const sellingPrice = Number(product.selling_price || 0);
  const mrp = Number(product.mrp || 0);
  const hasDiscount = mrp > sellingPrice;
  const discountPercent = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

  // Interactive 3D Cursor Tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle, realistic tilt angles (-10deg to +10deg)
    const rotX = ((y - centerY) / centerY) * -10;
    const rotY = ((x - centerX) / centerX) * 10;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  }, [reducedMotion]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart(product, 1);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1400);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onViewDetails(product)}
      style={{
        perspective: "1000px",
        animationDelay: `${Math.min(index * 35, 400)}ms`,
      }}
      className="group relative cursor-pointer select-none transition-all duration-300"
    >
      {/* 3D Tilt Wrapper */}
      <div
        style={{
          transform: !reducedMotion && isHovered
            ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.025, 1.025, 1.025)`
            : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transformStyle: "preserve-3d",
          transition: isHovered
            ? "transform 0.08s ease-out, box-shadow 0.25s ease"
            : "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease",
        }}
        className={`bg-white rounded-2xl border p-3.5 sm:p-4 flex flex-col justify-between h-full transition-shadow duration-300 ${
          isHovered
            ? "border-emerald-300/90 shadow-[0_20px_35px_-10px_rgba(6,78,59,0.18)] ring-1 ring-emerald-500/20"
            : "border-gray-200/90 shadow-xs hover:border-gray-300"
        }`}
      >
        {/* Specular Glare Reflection */}
        {!reducedMotion && (
          <div
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 65%)`,
              opacity: glare.opacity,
              transition: "opacity 0.25s ease",
            }}
            className="pointer-events-none absolute inset-0 rounded-2xl z-20"
          />
        )}

        <div>
          {/* Top Badges Bar: Stock & Discount */}
          <div className="flex items-center justify-between gap-1.5 mb-2.5 z-10 relative">
            {/* Stock status pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight uppercase ${
                isOutOfStock
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : isLowStock
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
            </span>

            {/* Discount Badge */}
            {hasDiscount && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-black tracking-wider uppercase shadow-xs">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          {/* 3D Floating Product Image Container */}
          <div
            style={{
              transform: !reducedMotion && isHovered ? "translateZ(30px) scale(1.06)" : "translateZ(0px) scale(1)",
              transformStyle: "preserve-3d",
              transition: isHovered
                ? "transform 0.12s ease-out"
                : "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
            className="w-full aspect-square rounded-xl bg-gradient-to-b from-slate-50/80 to-slate-100/60 border border-gray-100 flex items-center justify-center p-3 sm:p-4 mb-3 relative overflow-hidden group/img"
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={product.name}
                loading="lazy"
                style={{
                  filter: isHovered
                    ? "drop-shadow(0 16px 20px rgba(6, 78, 59, 0.22))"
                    : "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.06))",
                  transition: "filter 0.3s ease, transform 0.3s ease",
                }}
                className="max-h-full max-w-full object-contain pointer-events-none select-none transition-transform duration-300"
              />
            ) : (
              <FallbackProductIcon categoryName={product.category?.name} name={product.name} />
            )}

            {/* Quick View Eye Overlay Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(product);
              }}
              title="Quick view product details"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 hover:text-emerald-800 shadow-md border border-gray-200/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          {/* Product Meta: Brand & SKU */}
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            {product.brand ? (
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide truncate max-w-[120px]">
                {product.brand}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-gray-400 uppercase">
                {product.category?.name || "Product"}
              </span>
            )}
            <span className="font-mono text-[10.5px] text-gray-500 font-medium">
              {product.sku}
            </span>
          </div>

          {/* Product Title */}
          <h3
            title={product.name}
            className="font-bold text-gray-900 text-xs sm:text-[13px] leading-snug line-clamp-2 group-hover:text-emerald-800 transition-colors"
          >
            {product.name}
          </h3>
        </div>

        {/* Pricing & Add to Cart Footer */}
        <div className="pt-3 mt-2 border-t border-gray-100 space-y-2">
          {/* Price & MRP Row */}
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                ₹{sellingPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {hasDiscount && (
                <span className="text-xs text-gray-400 line-through font-medium">
                  ₹{mrp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Units on hand indicator */}
            <span className="text-[10.5px] text-gray-500 font-semibold whitespace-nowrap">
              Stock: <b className={`tabular-nums ${isOutOfStock ? "text-rose-600" : isLowStock ? "text-amber-600" : "text-emerald-700"}`}>{stock}</b>
            </span>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddClick}
            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 shadow-xs active:scale-95 ${
              isOutOfStock
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                : isAdded
                ? "bg-emerald-600 text-white scale-[1.02] shadow-md ring-2 ring-emerald-400"
                : "bg-[#047857] hover:bg-emerald-700 text-white hover:shadow-md"
            }`}
          >
            {isAdded ? (
              <>
                <svg className="w-3.5 h-3.5 stroke-2 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Added to Cart!</span>
              </>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
