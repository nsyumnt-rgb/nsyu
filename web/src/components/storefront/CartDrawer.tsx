import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { removeCartItemApi, setCartItemApi } from "../../api/portal";
import { apiErrorMessage, resolveAssetUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { useStorefront } from "../../store/storefrontStore";
import { inr } from "../StoreProduct";
import { ProductPlaceholder } from "../ProductArt";

/** Slide-in cart. Reads the live cart from the store; every change goes through the cart API. */
export default function CartDrawer() {
  const navigate = useNavigate();
  const open = useStorefront((s) => s.cartOpen);
  const close = useStorefront((s) => s.closeCart);
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  async function setQty(productId: number, qty: number) {
    setBusy(productId);
    setError(null);
    try {
      setCart(qty <= 0 ? await removeCartItemApi(productId) : await setCartItemApi(productId, qty));
    } catch (e) {
      setError(apiErrorMessage(e, "Could not update the cart"));
    } finally {
      setBusy(null);
    }
  }

  const items = cart?.items || [];
  const count = cart?.itemCount ?? items.reduce((a, i) => a + i.quantity, 0);
  const gross = items.reduce((a, i) => a + Number(i.unitPrice || 0) * i.quantity, 0);
  const discount = Number(cart?.discountAmount || 0);
  const tax = Number(cart?.taxAmount || 0);
  const total = Number(cart?.estimatedTotal || 0);
  const hasIssue = items.some((i) => i.isUnavailable);

  return (
    <div className={`fixed inset-0 z-[60] overflow-hidden transition-[visibility] duration-300 ${open ? "visible" : "invisible pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={close} className={`absolute inset-0 bg-navy-950/40 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-center justify-between px-5 h-16 border-b border-slate-100 shrink-0">
          <h2 className="flex items-center gap-2.5 text-[18px] font-bold text-navy-900">
            <svg className="w-6 h-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            Your cart <span className="text-slate-400 font-semibold">({count})</span>
          </h2>
          <button type="button" onClick={close} aria-label="Close cart" className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-navy-900">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        {error && <p className="mx-5 mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <span className="w-20 h-20 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            </span>
            <p className="mt-4 text-[16px] font-semibold text-navy-900">Your cart is empty</p>
            <p className="mt-1 text-[13px] text-slate-500">Add products and they'll show up here.</p>
            <button type="button" onClick={() => { close(); navigate("/portal/catalog"); }} className="btn-primary mt-5 h-11 px-6">Start shopping</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-5">
              {items.map((it) => {
                const img = resolveAssetUrl(it.imageUrl);
                return (
                  <li key={it.productId} className="py-4 flex gap-3.5">
                    <Link to={`/portal/product/${it.productId}`} onClick={close} className="relative w-[72px] h-[72px] rounded-xl bg-[#F3F4F2] overflow-hidden shrink-0">
                      {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-contain p-1.5 mix-blend-multiply" /> : <ProductPlaceholder name={it.name || ""} brand={it.brand} compact />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/portal/product/${it.productId}`} onClick={close} className="text-[13.5px] font-semibold text-navy-900 leading-snug line-clamp-2 hover:text-brand-700">{it.name || "Product no longer available"}</Link>
                      <div className="mt-1 text-[14px] font-bold text-navy-900 tabular">{inr(it.unitPrice || 0)}{it.quantity > 1 && <span className="ml-1.5 text-[12px] font-medium text-slate-400">× {it.quantity} = {inr(Number(it.unitPrice || 0) * it.quantity)}</span>}</div>
                      {(it.warning || it.isUnavailable) && <p className="mt-1 text-[11.5px] text-amber-700">{it.warning || "Not available in this quantity"}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-lg ring-1 ring-slate-200 h-9">
                          <button type="button" disabled={busy === it.productId} onClick={() => setQty(it.productId, it.quantity - 1)} className="w-9 h-full text-[16px] font-bold text-slate-600 hover:text-navy-900 disabled:opacity-40" aria-label="Decrease quantity">−</button>
                          <span className="w-8 text-center text-[13.5px] font-bold tabular">{busy === it.productId ? "…" : it.quantity}</span>
                          <button type="button" disabled={busy === it.productId || it.quantity >= it.availableStock} onClick={() => setQty(it.productId, it.quantity + 1)} className="w-9 h-full text-[16px] font-bold text-slate-600 hover:text-navy-900 disabled:opacity-40" aria-label="Increase quantity">+</button>
                        </div>
                        <button type="button" disabled={busy === it.productId} onClick={() => setQty(it.productId, 0)} aria-label={`Remove ${it.name}`} className="w-9 h-9 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center">
                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="shrink-0 border-t border-slate-100 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] space-y-2 bg-white">
              <Row label={`Subtotal (${count} item${count === 1 ? "" : "s"})`} value={inr(gross)} />
              {discount > 0 && <Row label="Discount" value={`− ${inr(discount)}`} accent />}
              {tax > 0 && <Row label="GST" value={inr(tax)} />}
              <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 mt-1">
                <span className="text-[16px] font-bold text-navy-900">Total</span>
                <span className="text-[22px] font-bold text-brand-700 tabular">{inr(total)}</span>
              </div>
              {hasIssue && <p className="text-[12px] text-amber-700">Some items exceed available stock — adjust them before checkout.</p>}
              <button type="button" onClick={() => { close(); navigate("/portal/cart"); }} className="btn-primary w-full h-12 text-[15px] rounded-xl">
                Proceed to checkout
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
              <button type="button" onClick={close} className="w-full h-10 text-[13.5px] font-semibold text-slate-600 hover:text-navy-900">Continue shopping</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13.5px]">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular ${accent ? "text-emerald-600" : "text-navy-900"}`}>{value}</span>
    </div>
  );
}
