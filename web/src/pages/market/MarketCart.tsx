import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketCart, setMarketCartItem, type MarketCart as Cart } from "../../api/marketplace";
import { resolveAssetUrl, apiErrorMessage } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { rupees } from "../../components/MarketCard";
import { ProductPlaceholder } from "../../components/ProductArt";

/* MultiShop wireframe 4 (cart part) — one cart, grouped by shop. Checkout per shop comes in step 4. */
export default function MarketCart() {
  const customer = usePortalStore((s) => s.customer);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return setLoading(false);
    getMarketCart()
      .then(setCart)
      .catch((e) => setError(apiErrorMessage(e, "Could not load your cart")))
      .finally(() => setLoading(false));
  }, [customer]);

  async function setQty(shopId: number, productId: number, qty: number) {
    setBusy(`${shopId}-${productId}`);
    setError(null);
    try {
      setCart(await setMarketCartItem(shopId, productId, qty));
      window.dispatchEvent(new Event("market-cart-changed"));
    } catch (e) {
      setError(apiErrorMessage(e, "Could not update the cart"));
    } finally {
      setBusy(null);
    }
  }

  if (!customer) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <h1 className="text-[20px] font-bold">Your cart</h1>
        <p className="text-[13.5px] text-slate-500 mt-2">Log in to add products from any shop to one cart.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-login-modal", { detail: { tab: "customer" } }))}
            className="btn-primary"
          >
            Log in
          </button>
          <Link to="/market/search" className="btn-secondary">Browse products</Link>
        </div>
      </div>
    );
  }

  const groups = cart?.groups || [];
  const ready = groups.filter((g) => g.status === "active" && g.cart);

  return (
    <div className="space-y-6">
      <nav className="text-[13px] text-slate-500"><Link to="/" className="hover:text-brand-700">Home</Link> / <span className="text-navy-900 font-medium">Cart</span></nav>
      <h1 className="page-title">Your cart</h1>
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {loading ? (
        <div className="card h-40 animate-pulse" />
      ) : groups.length === 0 ? (
        <div className="card p-12 text-center max-w-lg mx-auto rounded-2xl border border-[#E5E7EB] shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center text-3xl border border-emerald-100 shadow-xs mb-4">
            🛍️
          </div>
          <div className="text-[17px] font-bold text-navy-900">Your Cart is Empty</div>
          <p className="text-[13px] text-slate-500 mt-1.5 max-w-sm mx-auto">
            Discover thousands of products from verified local merchants and add them to your cart.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/market/search" className="btn-primary px-6 py-2.5">
              Explore Products →
            </Link>
            <Link to="/market/shops" className="btn-secondary px-5 py-2.5">
              Browse Shops
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {groups.map((g) => (
              <section key={g.shop.id} className="card overflow-hidden">
                <header className="card-header">
                  <div>
                    <div className="section-label">Items from</div>
                    <Link to={`/market/shop/${encodeURIComponent(g.shop.code)}`} className="text-[15px] font-semibold text-navy-900 hover:text-brand-700">{g.shop.name}</Link>
                  </div>
                  {g.cart && <span className="text-[14px] font-bold text-navy-900 tabular">{rupees(g.cart.estimatedTotal)}</span>}
                </header>
                {g.status !== "active" ? (
                  <p className="px-5 py-4 text-[13px] text-amber-700 bg-amber-50">This shop approves new customers before they can order. You'll be notified once it does.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {g.cart!.items.map((it) => {
                      const key = `${g.shop.id}-${it.productId}`;
                      return (
                        <li key={key} className="px-5 py-4 flex gap-4">
                          <Link to={`/market/p/${g.shop.id}/${it.productId}`} className="relative w-20 h-20 rounded-xl bg-[#F3F4F2] flex items-center justify-center shrink-0 overflow-hidden">
                            {it.imageUrl ? <img src={resolveAssetUrl(it.imageUrl) ?? undefined} alt="" className="w-full h-full object-contain p-2 mix-blend-multiply" /> : <ProductPlaceholder name={it.name} compact />}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-3">
                              <Link to={`/market/p/${g.shop.id}/${it.productId}`} className="text-[14px] font-semibold text-navy-900 line-clamp-2 hover:text-brand-700">{it.name}</Link>
                              <span className="text-[14px] font-bold tabular whitespace-nowrap">{rupees(it.lineTotal)}</span>
                            </div>
                            <div className="text-[12px] text-slate-500 mt-0.5">{rupees(it.unitPrice)} each{it.gstPercent ? ` · ${it.gstPercent}% GST` : ""}</div>
                            {it.warning && <div className="mt-1 text-[12px] text-amber-700">{it.warning}</div>}
                            <div className="mt-2.5 flex items-center justify-between">
                              <div className="flex items-center rounded-lg ring-1 ring-border h-10">
                                <button type="button" disabled={busy === key} onClick={() => setQty(g.shop.id, it.productId, it.quantity - 1)} className="w-10 h-full font-bold" aria-label="Decrease quantity">−</button>
                                <span className="w-9 text-center font-bold tabular">{it.quantity}</span>
                                <button type="button" disabled={busy === key || it.quantity >= it.availableStock} onClick={() => setQty(g.shop.id, it.productId, it.quantity + 1)} className="w-10 h-full font-bold disabled:opacity-40" aria-label="Increase quantity">+</button>
                              </div>
                              <button type="button" disabled={busy === key} onClick={() => setQty(g.shop.id, it.productId, 0)} className="text-[12.5px] font-semibold text-slate-500 hover:text-rose-600 min-h-[40px] px-2">Remove</button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <aside className="lg:col-span-4 card p-5 space-y-3 lg:sticky lg:top-24">
            <h2 className="card-title">Order summary</h2>
            {ready.map((g) => (
              <div key={g.shop.id} className="flex justify-between text-[13px] text-slate-600">
                <span className="truncate pr-2">{g.cart!.itemCount} item{g.cart!.itemCount === 1 ? "" : "s"} · {g.shop.name}</span>
                <span className="tabular">{rupees(g.cart!.estimatedTotal)}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-baseline">
              <span className="font-semibold">Total</span>
              <span className="text-[22px] font-bold tabular">{rupees(cart?.total || 0)}</span>
            </div>
            <p className="text-[12px] text-slate-500">
              {ready.length > 1 ? `Checkout creates ${ready.length} orders — one per shop. ` : ""}Delivery or pickup is chosen per shop at checkout.
            </p>
            {ready.length > 0 ? (
              <Link to="/market/checkout" className="btn-primary btn-lg w-full">Proceed to checkout</Link>
            ) : (
              <button type="button" disabled className="btn-primary btn-lg w-full">Nothing to check out yet</button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
