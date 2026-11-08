import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortalStore } from "../../store/portalStore";
import { setCartItemApi, removeCartItemApi, clearCartApi, placeOrderApi } from "../../api/portal";

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

  if (!cart || items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 max-w-lg mx-auto mt-8 shadow-sm">
        <div className="w-20 h-20 mx-auto mb-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
          <CartEmptyIcon className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Your Cart is Empty</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          You haven't added any items to your order cart yet. Browse the catalog to select products and place your order.
        </p>
        <Link
          to="/portal/catalog"
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition"
        >
          <span>Browse Product Catalog &rarr;</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner matching reference screenshot */}
      <div className="bg-[#047857] text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10">
            <CartIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Cart</h1>
            <p className="text-xs text-emerald-100 font-medium">
              {cart.itemCount} item{cart.itemCount > 1 ? "s" : ""} selected
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearCart}
          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20"
        >
          <TrashIcon className="w-4 h-4" />
          <span>Clear Cart</span>
        </button>
      </div>

      {/* Customer Info Card matching reference screenshot */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Customer</span>
            <div className="font-extrabold text-gray-900 text-sm sm:text-base uppercase">{customer?.name}</div>
            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-3">
              <span>Mobile: {customer?.phone}</span>
              {customer?.address && <span>| {customer.address}</span>}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Cart Items Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden sm:grid sm:grid-cols-12 bg-emerald-800 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-3">
          <div className="col-span-1 text-center">S.No.</div>
          <div className="col-span-5">Product</div>
          <div className="col-span-2 text-center">Req. Qty.</div>
          <div className="col-span-2 text-right">Selling Price (Incl. GST)</div>
          <div className="col-span-2 text-right pr-2">Total</div>
        </div>

        {/* Items Rows */}
        <div className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <div
              key={item.id || item.productId}
              className={`p-4 sm:px-4 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-3 ${
                item.isUnavailable || item.quantity > item.availableStock ? "bg-rose-50/50" : ""
              }`}
            >
              {/* S.No */}
              <div className="hidden sm:block col-span-1 text-center font-bold text-gray-400 text-xs">
                {idx + 1}
              </div>

              {/* Product Info */}
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center p-1 flex-shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <BoxIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-xs leading-snug line-clamp-2">{item.name}</h3>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</div>
                  {item.warning && (
                    <div className="text-[11px] font-bold text-rose-600 mt-1">{item.warning}</div>
                  )}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="col-span-2 flex items-center justify-between sm:justify-center">
                <span className="sm:hidden text-xs text-gray-500 font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) handleUpdateQty(item.productId, val);
                    }}
                    className="w-10 h-7 text-center text-xs font-bold bg-white border-x border-gray-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="col-span-2 flex items-center justify-between sm:justify-end text-right">
                <span className="sm:hidden text-xs text-gray-500 font-medium">Unit Price:</span>
                <span className="text-xs font-semibold text-gray-700">
                  ₹{Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Line Total & Remove */}
              <div className="col-span-2 flex items-center justify-between sm:justify-end gap-3 text-right">
                <span className="sm:hidden text-xs text-gray-500 font-medium">Line Total:</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-blue-600">
                    ₹{Number(item.lineTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(item.productId, 0)}
                    className="p-1 text-rose-500 hover:text-rose-700 transition"
                    title="Remove item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Footer: Terms & Payment Notes vs Calculations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        
        {/* Left Column: Terms & Notes */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
              <DocIcon className="w-4 h-4 text-emerald-700" />
              <span>Terms & Conditions</span>
            </div>
            <ol className="text-xs text-gray-500 space-y-1 pl-4 list-decimal">
              <li>Prices shown are inclusive of applicable GST.</li>
              <li>Order submission notifies shop staff for confirmation & packing.</li>
              <li>Stock will be deducted once official bill is generated.</li>
              <li>Order can be cancelled prior to staff confirmation.</li>
            </ol>
          </div>

          {/* Delivery & Payment Note */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Fulfillment Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("pickup")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                    deliveryType === "pickup"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  Store Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("delivery")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                    deliveryType === "delivery"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  Doorstep Delivery
                </button>
              </div>
            </div>

            {deliveryType === "delivery" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter full shipping address..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Order Note / Instructions (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Please pack chargers with bubble wrap"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Financial Calculations Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Sub Total</span>
              <span className="font-bold text-gray-800">
                ₹{Number(cart.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Discount</span>
              <span className="font-bold text-emerald-600">
                ₹{Number(cart.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Tax (GST)</span>
              <span className="font-bold text-gray-800">
                ₹{Number(cart.taxAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Grand Total Green Bar matching screenshot */}
          <div className="bg-[#047857] text-white p-4 flex items-center justify-between">
            <span className="font-extrabold text-sm uppercase tracking-wider">Grand Total</span>
            <span className="text-xl font-black">
              ₹{Number(cart.estimatedTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={handlePlaceOrder}
              className="w-full py-3.5 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <CreateBillIcon className="w-5 h-5" />
              <span>{submitting ? "Placing Order..." : "Place Order &rarr;"}</span>
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              By placing this order, you confirm request to purchase the items listed above.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
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

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

