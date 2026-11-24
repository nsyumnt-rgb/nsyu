import { useState } from "react";
import type { Product } from "../types";
import { resolveAssetUrl } from "../api/client";

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductDetailsModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailsModalProps) {
  const images = product.images || [];
  const primaryCover = images.find((i) => i.is_primary)?.url || images[0]?.url;
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(primaryCover || null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const stock = Number(product.stocks?.[0]?.current_stock ?? 0);
  const minStock = Number(product.min_stock ?? 5) || 5;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= minStock;

  const sellingPrice = Number(product.selling_price || 0);
  const mrp = Number(product.mrp || 0);
  const hasDiscount = mrp > sellingPrice;
  const discountPercent = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

  const activeSrc = resolveAssetUrl(selectedImageUrl);

  const handleQtyChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > stock && stock > 0) return stock;
      return next;
    });
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-3xl w-full shadow-pop border border-border overflow-hidden flex flex-col my-auto animate-scale-in"
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h2 className="font-extrabold text-navy-900 text-sm tracking-tight">Product Details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Image Gallery & Zoom */}
          <div className="space-y-4">
            {/* Main Stage */}
            <div
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              className="w-full aspect-square rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/80 flex items-center justify-center p-6 relative overflow-hidden"
            >
              {activeSrc ? (
                <img
                  src={activeSrc}
                  alt={product.name}
                  style={{
                    transform: isZoomed ? "scale(1.22)" : "scale(1)",
                    transition: "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                  className="max-h-full max-w-full object-contain pointer-events-none select-none"
                />
              ) : (
                <div className="text-slate-400 text-center">
                  <svg className="w-20 h-20 mx-auto stroke-1 text-emerald-800/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" strokeWidth="2" />
                  </svg>
                  <span className="text-xs font-semibold block mt-2">No photo available</span>
                </div>
              )}

              {/* Zoom hint badge */}
              {activeSrc && (
                <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-lg bg-white/80 backdrop-blur-xs text-[10px] font-bold text-slate-600 flex items-center gap-1 shadow-xs border border-slate-200">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span>Hover to zoom</span>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery Strip */}
            {images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {images.map((img) => {
                  const url = resolveAssetUrl(img.url);
                  const isSelected = selectedImageUrl === img.url;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImageUrl(img.url)}
                      className={`w-14 h-14 rounded-xl border p-1 bg-white shrink-0 overflow-hidden transition ${
                        isSelected
                          ? "border-emerald-600 ring-2 ring-emerald-500/30"
                          : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={url || ""} alt="" className="w-full h-full object-contain" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Information, Pricing & Add to Cart */}
          <div className="flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Category & Brand Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {product.category?.name && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wide border border-emerald-200/80">
                    {product.category.name}
                  </span>
                )}
                {product.brand && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wide">
                    {product.brand}
                  </span>
                )}
                {/* Stock Badge */}
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
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
                  {isOutOfStock ? "Out of Stock" : isLowStock ? `Low Stock (${stock} left)` : `In Stock (${stock} units)`}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-navy-900 leading-tight">
                {product.name}
              </h1>

              {/* Codes */}
              <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                <div>SKU: <b className="text-slate-800">{product.sku}</b></div>
                {product.barcode && (
                  <div>Barcode: <b className="text-slate-800">{product.barcode}</b></div>
                )}
              </div>

              {/* Price Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/90 flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Selling Price</div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
                      ₹{sellingPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-slate-400 line-through font-medium">
                        ₹{mrp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>

                {hasDiscount && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-emerald-700 text-white font-black text-xs uppercase tracking-wide shadow-sm">
                    {discountPercent}% OFF
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-700">Description</div>
                  <p className="text-xs text-slate-600 leading-relaxed max-h-28 overflow-y-auto pr-1">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Quick Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax / GST</span>
                  <span className="font-semibold text-slate-800">{product.tax_percent ?? 0}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Min Reorder Level</span>
                  <span className="font-semibold text-slate-800">{product.min_stock ?? 5} units</span>
                </div>
              </div>
            </div>

            {/* Quantity Stepper & Add to Cart */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Select Quantity:</span>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    disabled={quantity <= 1 || isOutOfStock}
                    onClick={() => handleQtyChange(-1)}
                    className="w-7 h-7 rounded-lg bg-white text-slate-800 font-bold hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center transition shadow-2xs"
                  >
                    –
                  </button>
                  <span className="w-8 text-center text-xs font-extrabold text-navy-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= stock || isOutOfStock}
                    onClick={() => handleQtyChange(1)}
                    className="w-7 h-7 rounded-lg bg-white text-slate-800 font-bold hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center transition shadow-2xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAdd}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 ${
                  isOutOfStock
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    : isAdded
                    ? "bg-emerald-600 text-white scale-[1.01] shadow-lg ring-2 ring-emerald-400"
                    : "bg-[#047857] hover:bg-emerald-700 text-white"
                }`}
              >
                {isAdded ? (
                  <>
                    <svg className="w-4 h-4 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Added {quantity} to Cart!</span>
                  </>
                ) : isOutOfStock ? (
                  <span>Out of Stock</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                    </svg>
                    <span>Add {quantity} to Cart • ₹{(sellingPrice * quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
