import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePosStore } from "../store/posStore";
import { useAuthStore } from "../store/authStore";
import { resolveAssetUrl } from "../api/client";
import { getCategoryAlias } from "../utils/categoryAlias";

function formatINR(val: number): string {
  return "₹" + Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Cart() {
  const navigate = useNavigate();
  const activeShop = useAuthStore((s) => s.activeShop);

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

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              POS Order Preparation
            </span>
            {activeShop && (
              <span className="text-xs text-slate-400 font-medium">
                • {activeShop.name} ({activeShop.code})
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <span>POS Cart & Current Bill</span>
            {items.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review selected products, adjust quantities, and proceed directly to invoice generation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all items from this cart?")) {
                  clearCart();
                }
              }}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition shadow-2xs"
            >
              Clear Cart
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/app/products")}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition shadow-2xs"
          >
            + Add Products
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => navigate("/app/billing")}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span>Proceed to Billing</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Cart Content */}
      {items.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center shadow-xs">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-navy-900">Your POS Cart is Empty</h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            There are no products currently staged for billing. Add products from the catalog, inventory, or search bar to start preparing a customer invoice.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/app/products"
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              Browse Products Catalog
            </Link>
            <Link
              to="/app/inventory"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition"
            >
              Manage Inventory
            </Link>
            <Link
              to="/app/billing"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
            >
              Open Direct Billing
            </Link>
          </div>
        </div>
      ) : (
        /* Populated Cart Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Items Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider text-[10.5px] border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Product Details</th>
                      <th className="py-3.5 px-4 text-center">Category</th>
                      <th className="py-3.5 px-4 text-right">Price</th>
                      <th className="py-3.5 px-4 text-center">Quantity</th>
                      <th className="py-3.5 px-4 text-right">Total</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {items.map((item) => {
                      const p = item.product || {};
                      const coverImg = (p.images?.find((img: any) => img.is_primary) || p.images?.[0])?.url;
                      const photo = coverImg || p.cover_image || (p.photos && p.photos[0]?.url) || null;
                      const lineTotal = Number(item.unitPrice || 0) * item.quantity;
                      const catName = p.category?.name || (typeof p.category === "string" ? p.category : "");
                      const catAlias = getCategoryAlias(catName, p.category?.alias);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          {/* Product Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                {photo ? (
                                  <img
                                    src={resolveAssetUrl(photo) ?? undefined}
                                    alt={p.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-slate-400 font-bold text-xs">📦</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-navy-900 text-xs sm:text-sm truncate max-w-xs">
                                  {p.name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                    {p.sku || "NO-SKU"}
                                  </span>
                                  {p.brand && (
                                    <span className="text-[11px] text-slate-400">
                                      {p.brand}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category Alias */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              title={catName || "General"}
                              className="font-mono font-black text-xs px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs whitespace-nowrap"
                            >
                              {catAlias}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                            {formatINR(item.unitPrice)}
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, item.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                                title="Decrease"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateQuantity(p.id, Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-10 text-center text-xs font-bold text-navy-900 border-x border-slate-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                                title="Increase"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-3.5 px-4 text-right font-black text-emerald-800 text-sm">
                            {formatINR(lineTotal)}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(p.id)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition mx-auto"
                              title="Remove item"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Actions Bar */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate("/app/products")}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition shadow-2xs flex items-center gap-1.5"
                >
                  <span>←</span>
                  <span>Add More Products</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove all items from this cart?")) {
                      clearCart();
                    }
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Clear All Items
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-5 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-navy-900">Current Bill Summary</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Ready to Invoice
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Unique Items</span>
                  <span className="font-bold text-navy-900">{items.length} products</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Total Quantity</span>
                  <span className="font-bold text-navy-900">{totalQty} units</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Active Branch</span>
                  <span className="font-bold text-navy-900">{activeShop?.name || "Main Branch"}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-navy-900">Estimated Total</span>
                  <span className="text-2xl font-black text-emerald-800 font-mono">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed font-medium">
                💡 Clicking <strong>Proceed to POS Billing</strong> will carry all cart items into the invoice screen where you can assign a customer, select cash/UPI/credit payment, and print the receipt.
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/app/billing")}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to POS Billing & Invoice</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/app/products")}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition"
                >
                  Continue Adding Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
