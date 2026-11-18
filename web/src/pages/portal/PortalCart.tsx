import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortalStore } from "../../store/portalStore";
import { setCartItemApi, removeCartItemApi, clearCartApi, placeOrderApi, getCartApi } from "../../api/portal";
import ProductItemIcon from "../../components/ProductItemIcon";

export default function PortalCart() {
  const navigate = useNavigate();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);

  const [notes, setNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [shippingAddress, setShippingAddress] = useState(customer?.address || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize cart on entry / return to page
  useEffect(() => {
    getCartApi().then(setCart).catch(() => {});
  }, [setCart]);

  const items = cart?.items || [];

  const handleUpdateQty = async (productId: number, qty: number) => {
    setError(null);
    try {
      if (qty <= 0) {
        const updated = await removeCartItemApi(productId);
        setCart(updated);
      } else {
        const updated = await setCartItemApi(productId, qty);
        setCart(updated);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update quantity");
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Are you sure you want to clear all items from your cart?")) return;
    try {
      await clearCartApi();
      setCart({
        cartId: 0,
        items: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        estimatedTotal: 0,
        itemCount: 0,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to clear cart");
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setError(null);

    // Validate that no item exceeds available stock
    const outOfStockItem = items.find((i) => i.isUnavailable || i.quantity > i.availableStock);
    if (outOfStockItem) {
      setError(`Cannot place order: "${outOfStockItem.name}" exceeds available stock (${outOfStockItem.availableStock}).`);
      return;
    }

    setSubmitting(true);
    // Generate UUID v4 for idempotent request
    const clientRequestId = `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await placeOrderApi({
        clientRequestId,
        note: notes.trim() || undefined,
        deliveryType,
        shippingAddress: deliveryType === "delivery" ? shippingAddress : undefined,
      });

      // Clear local cart state
      setCart({
        cartId: 0,
        items: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        estimatedTotal: 0,
        itemCount: 0,
      });

      const orderId = res?.data?.id;
      if (orderId) {
        navigate(`/portal/orders/${orderId}`, { replace: true });
      } else {
        navigate("/portal/orders", { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to place order. Please check stock and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!cart || items.length === 0) {
    return (
      <div className="card p-10 sm:p-14 text-center max-w-lg mx-auto mt-6">
        <div className="w-20 h-20 mx-auto mb-5 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center">
          <CartEmptyIcon className="w-10 h-10" />
        </div>
        <h2 className="text-[20px] font-bold">Your cart is empty</h2>
        <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">
          Looks like you haven&apos;t added anything yet. Explore the store and add products to get started.
        </p>
        <Link to="/portal/catalog" className="btn-primary btn-lg mt-6">
          Start shopping →
        </Link>
      </div>
    );
  }

  const hasStockIssue = items.some((i) => i.isUnavailable || i.quantity > i.availableStock);

  return (
    <div className="space-y-6">
      {/* ── Header + steps ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link to="/portal/catalog" className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800">← Continue shopping</Link>
          <h1 className="page-title mt-2">Shopping Cart</h1>
          <p className="page-subtitle">
            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"} in your cart
          </p>
        </div>
        <ol className="flex items-center gap-2 text-[12px] font-semibold">
          <li className="flex items-center gap-1.5 text-brand-700"><span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[11px]">1</span>Cart</li>
          <li className="w-6 h-px bg-slate-300" />
          <li className="flex items-center gap-1.5 text-brand-700"><span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[11px]">2</span>Checkout</li>
          <li className="w-6 h-px bg-slate-300" />
          <li className="flex items-center gap-1.5 text-slate-400"><span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[11px]">3</span>Confirmed</li>
        </ol>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px] flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left: items + delivery ───────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          <section className="card overflow-hidden">
            <div className="card-header">
              <h2 className="card-title">Items</h2>
              <button type="button" onClick={handleClearCart} className="text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5">
                <TrashIcon className="w-4 h-4" /> Clear cart
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const over = item.isUnavailable || item.quantity > item.availableStock;
                return (
                  <li key={item.id || item.productId} className="p-4 sm:p-5 flex gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 ring-1 ring-border flex items-center justify-center shrink-0 overflow-hidden">
                      <ProductItemIcon
                        name={item.name}
                        category={(item as any).category || item.brand}
                        sku={item.sku}
                        imageUrl={item.imageUrl}
                        size="lg"
                        className="!w-full !h-full !border-0 !shadow-none !bg-transparent"
                      />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {item.brand && <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">{item.brand}</div>}
                          <h3 className="text-[14px] sm:text-[15px] font-semibold text-navy-900 leading-snug line-clamp-2">{item.name.trim()}</h3>
                          <div className="text-[12px] text-slate-500 mt-0.5">
                            {money(item.unitPrice)} each
                            {item.gstPercent > 0 && <span className="text-slate-400"> · {item.gstPercent}% GST</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[15px] sm:text-[16px] font-bold text-navy-900 tabular">{money(item.lineTotal)}</div>
                          {item.discountAmount > 0 && (
                            <div className="text-[11.5px] font-semibold text-emerald-600">−{money(item.discountAmount)} off</div>
                          )}
                        </div>
                      </div>

                      {(over || item.warning) && (
                        <div className="mt-2 text-[12px] font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-1.5">
                          {item.warning || `Only ${item.availableStock} in stock — please reduce quantity.`}
                        </div>
                      )}

                      <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl ring-1 ring-border bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                            className="w-9 h-9 text-[18px] font-bold text-slate-600 hover:bg-slate-50"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1) handleUpdateQty(item.productId, val);
                            }}
                            className="w-12 h-9 text-center text-[14px] font-bold text-navy-900 border-x border-border focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label="Quantity"
                          />
                          <button
                            type="button"
                            disabled={item.quantity >= item.availableStock}
                            onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                            className="w-9 h-9 text-[18px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 0)}
                          className="text-[12.5px] font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5"
                        >
                          <TrashIcon className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Delivery */}
          <section className="card overflow-hidden">
            <div className="card-header">
              <h2 className="card-title">Delivery details</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 p-3.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center font-semibold">
                  {customer?.name?.charAt(0)?.toUpperCase() || <UserIcon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-navy-900">{customer?.name}</div>
                  <div className="text-[12px] text-slate-500 truncate">{[customer?.phone, customer?.email].filter(Boolean).join(" · ")}</div>
                  {customer?.address && <div className="text-[12px] text-slate-500 truncate">{customer.address}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "pickup", title: "Store pickup", text: "Collect from the shop when ready" },
                  { key: "delivery", title: "Home delivery", text: "Delivered to your address" },
                ] as const).map((opt) => {
                  const active = deliveryType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDeliveryType(opt.key)}
                      className={`text-left rounded-xl p-4 ring-1 transition flex items-start gap-3 ${
                        active ? "ring-2 ring-brand-500 bg-brand-50/60" : "ring-border hover:ring-brand-200 bg-white"
                      }`}
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? "border-brand-600" : "border-slate-300"}`}>
                        {active && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-semibold text-navy-900">{opt.title}</span>
                        <span className="block text-[12px] text-slate-500 mt-0.5">{opt.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {deliveryType === "delivery" && (
                <div>
                  <label className="label">Delivery address</label>
                  <textarea
                    rows={2}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="House / shop no., street, area, city"
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label">Order note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any instructions for the shop"
                  className="input"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── Right: summary ───────────────────────────────────── */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <section className="card overflow-hidden">
            <div className="card-header">
              <h2 className="card-title">Order summary</h2>
            </div>
            <dl className="p-5 space-y-3 text-[13.5px]">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})</dt>
                <dd className="font-semibold text-navy-900 tabular">{money(Number(cart.subtotal) + Number(cart.discountAmount || 0))}</dd>
              </div>
              {Number(cart.discountAmount) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <dt>Discount</dt>
                  <dd className="font-semibold text-emerald-600 tabular">−{money(cart.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <dt>GST</dt>
                <dd className="font-semibold text-navy-900 tabular">{money(cart.taxAmount)}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Delivery</dt>
                <dd className="font-semibold text-slate-500">{deliveryType === "pickup" ? "Store pickup" : "As confirmed by shop"}</dd>
              </div>
              <div className="pt-3 mt-1 border-t border-dashed border-slate-200 flex justify-between items-baseline">
                <dt className="text-[14px] font-semibold text-navy-900">Total</dt>
                <dd className="text-[24px] font-bold text-navy-900 tabular">{money(cart.estimatedTotal)}</dd>
              </div>
            </dl>
            <div className="px-5 pb-5">
              <button
                type="button"
                disabled={submitting || hasStockIssue}
                onClick={handlePlaceOrder}
                className="btn-primary btn-lg w-full h-12 text-[14.5px]"
              >
                <CreateBillIcon className="w-5 h-5" />
                {submitting ? "Placing order…" : "Place order →"}
              </button>
              {hasStockIssue && (
                <p className="text-[12px] text-amber-700 text-center mt-2">Fix stock warnings above to continue.</p>
              )}
              <p className="text-[11.5px] text-slate-400 text-center mt-2.5">
                The shop will confirm your order. No payment is taken online.
              </p>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-900 mb-2">
              <DocIcon className="w-4 h-4 text-brand-600" /> Good to know
            </div>
            <ul className="text-[12px] text-slate-500 space-y-1.5">
              <li className="flex gap-2"><span className="text-brand-600">✓</span> Prices include applicable GST.</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> The shop is notified instantly to confirm & pack.</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> Stock is deducted when the bill is generated.</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> You can cancel before the shop confirms.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CartEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CreateBillIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

