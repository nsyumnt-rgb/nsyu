import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePosStore } from "../store/posStore";
import { resolveAssetUrl } from "../api/client";

function formatINR(val: number): string {
  return "₹" + Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PosCartDrawer() {
  const navigate = useNavigate();
  const open = usePosStore((s) => s.open);
  const setOpen = usePosStore((s) => s.setOpen);
  const items = usePosStore((s) => s.items);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
        0
      ),
    [items]
  );

  const location = useLocation();
  if (!open || location.pathname.startsWith("/app/billing")) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/40 backdrop-blur-xs transition-opacity"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Current Bill / POS Cart
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {items.length} {items.length === 1 ? "product" : "products"} ·{" "}
                {totalQty} {totalQty === 1 ? "unit" : "units"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Clear all items from this bill?")) {
                    clearCart();
                  }
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Clear entire cart"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close cart drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3">
                <svg
                  className="w-8 h-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                Your POS cart is empty
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Add products from Products, Catalog, or POS Billing to start
                building a customer invoice.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/products");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                >
                  Browse Products
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/billing");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-xs"
                >
                  Open Billing
                </button>
              </div>
            </div>
          ) : (
            items.map((item) => {
              const p = item.product;
              const photo =
                p.cover_image || (p.photos && p.photos[0]?.url) || null;
              const lineTotal = Number(item.unitPrice || 0) * item.quantity;

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-xs flex items-center gap-3"
                >
                  {/* Thumbnail */}
                  <div className="w-13 h-13 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60 flex items-center justify-center">
                    {photo ? (
                      <img
                        src={resolveAssetUrl(photo) ?? undefined}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <span className="text-lg">📦</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {p.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {p.sku || "NO-SKU"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatINR(item.unitPrice)}
                      </span>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-xs font-bold transition"
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-xs font-bold transition"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-xs font-black text-brand-700 ml-auto">
                        {formatINR(lineTotal)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(p.id)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                        title="Remove product"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Proceed */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/60 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Total Items</span>
                <span>{totalQty} units</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Subtotal</span>
                <span className="text-base text-brand-800 font-black">
                  {formatINR(subtotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/app/billing");
              }}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2"
            >
              <span>Proceed to POS Billing</span>
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
