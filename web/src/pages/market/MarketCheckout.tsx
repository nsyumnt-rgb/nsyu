import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCheckoutOptions,
  getMarketCart,
  placeMarketCheckout,
  type CheckoutResult,
  type CheckoutShopChoice,
  type MarketCart,
  type PayMethod,
} from "../../api/marketplace";
import { apiErrorMessage } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { rupees } from "../../components/MarketCard";

/* MultiShop wireframe 4 (checkout) — address, delivery and payment per shop; one order per shop. */

const PAY_LABEL: Record<PayMethod, { title: string; hint: string }> = {
  cod: { title: "Cash on delivery / at pickup", hint: "Pay the shop when you receive the order" },
  upi: { title: "UPI", hint: "Pay the shop by UPI on delivery or pickup" },
  khata: { title: "Pay later on shop khata", hint: "Added to your account with this shop" },
};

const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export default function MarketCheckout() {
  const customer = usePortalStore((s) => s.customer);
  const [cart, setCart] = useState<MarketCart | null>(null);
  const [payOptions, setPayOptions] = useState<Record<number, PayMethod[]>>({});
  const [choices, setChoices] = useState<Record<number, CheckoutShopChoice>>({});
  const [address, setAddress] = useState({ name: "", phone: "", line: "", landmark: "", city: "", pincode: "" });
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CheckoutResult[] | null>(null);
  // One id per checkout attempt: a double click or retry never creates duplicate orders.
  const [checkoutId, setCheckoutId] = useState(newId);

  useEffect(() => {
    if (!customer) return setLoading(false);
    Promise.all([getMarketCart(), getCheckoutOptions()])
      .then(([c, o]) => {
        setCart(c);
        const map: Record<number, PayMethod[]> = {};
        for (const s of o.shops) map[s.shopId] = s.paymentMethods;
        setPayOptions(map);
        setAddress((a) => ({ ...a, name: o.address.name, phone: o.address.phone, line: o.address.line }));
        const init: Record<number, CheckoutShopChoice> = {};
        for (const g of c.groups) if (g.status === "active" && g.cart) init[g.shop.id] = { shopId: g.shop.id, deliveryType: "delivery", paymentMethod: "cod", note: "" };
        setChoices(init);
      })
      .catch((e) => setError(apiErrorMessage(e, "Could not load checkout")))
      .finally(() => setLoading(false));
  }, [customer]);

  const groups = useMemo(() => (cart?.groups || []).filter((g) => g.status === "active" && g.cart && g.cart.items.length), [cart]);
  const needsAddress = groups.some((g) => choices[g.shop.id]?.deliveryType !== "pickup");
  const total = groups.reduce((a, g) => a + Number(g.cart!.estimatedTotal), 0);
  const hasStockIssue = groups.some((g) => g.cart!.items.some((i) => Boolean(i.warning)));

  const setChoice = (shopId: number, patch: Partial<CheckoutShopChoice>) => setChoices((c) => ({ ...c, [shopId]: { ...c[shopId], ...patch } }));

  async function place(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needsAddress) {
      if (!address.name.trim() || address.phone.replace(/\D/g, "").length < 10 || !address.line.trim() || address.pincode.replace(/\D/g, "").length !== 6) {
        setError("Enter your name, a 10-digit phone number, address and a 6-digit pincode for delivery.");
        return;
      }
    }
    setPlacing(true);
    try {
      const r = await placeMarketCheckout({ checkoutId, address, shops: groups.map((g) => choices[g.shop.id]) });
      setResults(r.data.results);
      setCart(r.data.cart);
      window.dispatchEvent(new Event("market-cart-changed"));
      // A new attempt (e.g. for shops that failed) must use a fresh id.
      setCheckoutId(newId());
    } catch (err) {
      setError(apiErrorMessage(err, "Checkout failed"));
    } finally {
      setPlacing(false);
    }
  }

  if (!customer) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <h1 className="text-[20px] font-bold">Sign In to Check Out</h1>
        <p className="text-[13.5px] text-slate-500 mt-2">Please sign in or register to complete your order.</p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("post_login_redirect", "/market/checkout");
            window.dispatchEvent(new CustomEvent("open-login-modal", { detail: { tab: "customer" } }));
          }}
          className="btn-primary mt-5"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  if (results) {
    const placed = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card p-6 text-center">
          <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[24px] ${placed.length ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{placed.length ? "✓" : "!"}</div>
          <h1 className="mt-3 text-[22px] font-bold">{placed.length ? `${placed.length} order${placed.length === 1 ? "" : "s"} placed` : "No orders were placed"}</h1>
          <p className="text-[13.5px] text-slate-500 mt-1">{placed.length ? "Each shop has been notified and will confirm your order." : "Please review the messages below."}</p>
        </div>
        {placed.map((r) => (
          <div key={r.shopId} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-navy-900">{r.shopName}</div>
              <div className="text-[12.5px] text-slate-500">Order <span className="font-mono">#{r.orderNumber}</span> · {r.paymentMethod}</div>
            </div>
            <span className="text-[15px] font-bold tabular">{rupees(r.total || 0)}</span>
          </div>
        ))}
        {failed.map((r) => (
          <div key={r.shopId} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-[14px] font-semibold text-rose-800">{r.shopName} — not placed</div>
            <div className="text-[12.5px] text-rose-700 mt-0.5">{r.message}</div>
          </div>
        ))}
        <div className="flex flex-wrap justify-center gap-2">
          {failed.length > 0 && <Link to="/market/cart" className="btn-primary">Review cart</Link>}
          <Link to="/portal/orders" className="btn-secondary">My orders</Link>
          <Link to="/market/search" className="btn-ghost">Continue shopping</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="card h-48 animate-pulse" />;

  if (groups.length === 0) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <h1 className="text-[18px] font-bold">Nothing to check out</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your cart is empty.</p>
        <Link to="/market/search" className="btn-primary mt-5">Start shopping</Link>
      </div>
    );
  }

  return (
    <form onSubmit={place} className="space-y-6">
      <nav className="text-[13px] text-slate-500"><Link to="/" className="hover:text-brand-700">Home</Link> / <Link to="/market/cart" className="hover:text-brand-700">Cart</Link> / <span className="text-navy-900 font-medium">Checkout</span></nav>
      <h1 className="page-title">Checkout</h1>
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700" role="alert">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* 1 Address */}
          <section className="card p-5">
            <h2 className="card-title mb-4"><span className="text-brand-700">1</span> · Delivery address</h2>
            {!needsAddress && <p className="text-[12.5px] text-slate-500 mb-3">All orders are pickups — the shop only needs your name and phone.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name" value={address.name} onChange={(v) => setAddress({ ...address, name: v })} autoComplete="name" />
              <Field label="Phone" value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} autoComplete="tel" inputMode="tel" />
              {needsAddress && (
                <>
                  <div className="sm:col-span-2"><Field label="Address line" value={address.line} onChange={(v) => setAddress({ ...address, line: v })} autoComplete="street-address" /></div>
                  <Field label="Landmark (optional)" value={address.landmark} onChange={(v) => setAddress({ ...address, landmark: v })} />
                  <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} autoComplete="address-level2" />
                  <Field label="Pincode" value={address.pincode} onChange={(v) => setAddress({ ...address, pincode: v.replace(/\D/g, "").slice(0, 6) })} autoComplete="postal-code" inputMode="numeric" />
                </>
              )}
            </div>
          </section>

          {/* 2 + 3 per shop */}
          {groups.map((g) => {
            const ch = choices[g.shop.id];
            const opts = payOptions[g.shop.id] || ["cod", "upi"];
            return (
              <section key={g.shop.id} className="card overflow-hidden">
                <header className="card-header">
                  <div>
                    <div className="section-label">Order from</div>
                    <div className="text-[15px] font-semibold text-navy-900">{g.shop.name}</div>
                  </div>
                  <span className="text-[14px] font-bold tabular">{rupees(g.cart!.estimatedTotal)}</span>
                </header>
                <div className="p-5 space-y-5">
                  <ul className="text-[13px] text-slate-600 space-y-1">
                    {g.cart!.items.map((i) => (
                      <li key={i.productId} className="flex justify-between gap-3">
                        <span className="truncate">
                          {i.name} × {i.quantity}
                          {i.warning && <span className="text-amber-700 text-[11px] block sm:inline sm:ml-2 font-medium">⚠️ {i.warning}</span>}
                        </span>
                        <span className="tabular">{rupees(i.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <fieldset>
                    <legend className="label"><span className="text-brand-700">2</span> · Delivery method</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(["delivery", "pickup"] as const).map((d) => (
                        <Option key={d} name={`d-${g.shop.id}`} checked={ch?.deliveryType === d} onChange={() => setChoice(g.shop.id, { deliveryType: d })} title={d === "delivery" ? "Home delivery" : "Pickup from shop"} hint={d === "delivery" ? "To the address above" : "Collect when it's ready"} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="label"><span className="text-brand-700">3</span> · Payment</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {opts.map((m) => (
                        <Option key={m} name={`p-${g.shop.id}`} checked={ch?.paymentMethod === m} onChange={() => setChoice(g.shop.id, { paymentMethod: m })} title={PAY_LABEL[m].title} hint={PAY_LABEL[m].hint} />
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label className="label" htmlFor={`note-${g.shop.id}`}>Note for the shop (optional)</label>
                    <input id={`note-${g.shop.id}`} className="input" maxLength={300} value={ch?.note || ""} onChange={(e) => setChoice(g.shop.id, { note: e.target.value })} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <aside className="lg:col-span-4 card p-5 space-y-3 lg:sticky lg:top-24">
          <h2 className="card-title">Order summary</h2>
          {groups.map((g) => (
            <div key={g.shop.id} className="flex justify-between text-[13px] text-slate-600">
              <span className="truncate pr-2">{g.cart!.itemCount} item{g.cart!.itemCount === 1 ? "" : "s"} · {g.shop.name}</span>
              <span className="tabular">{rupees(g.cart!.estimatedTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between text-[13px] text-slate-500"><span>Delivery charges</span><span>Set by each shop</span></div>
          <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="text-[22px] font-bold tabular">{rupees(total)}</span>
          </div>
          {hasStockIssue && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800 flex items-start gap-2">
              <span className="text-sm shrink-0">ℹ️</span>
              <span>Kuch items shop ke current stock se zyada hain. Shop inhein arrange karke provide karegi, aapka order successfully place ho jayega.</span>
            </div>
          )}
          <button type="submit" disabled={placing} className="btn-primary btn-lg w-full">{placing ? "Placing orders…" : `Place ${groups.length > 1 ? `${groups.length} orders` : "order"}`}</button>
          <p className="text-[11.5px] text-slate-400 text-center">No payment is taken online. Each shop confirms its order.</p>
        </aside>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input min-h-[44px]" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function Option({ name, checked, onChange, title, hint }: { name: string; checked: boolean; onChange: () => void; title: string; hint: string }) {
  return (
    <label className={`flex items-start gap-2.5 rounded-xl p-3 cursor-pointer ring-1 transition min-h-[44px] ${checked ? "ring-2 ring-brand-500 bg-brand-50/60" : "ring-border hover:ring-slate-300"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 text-brand-600" />
      <span>
        <span className="block text-[13px] font-semibold text-navy-900">{title}</span>
        <span className="block text-[11.5px] text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
