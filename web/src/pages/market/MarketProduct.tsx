import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMarketCart, getMarketListing, searchMarket, setMarketCartItem, type MarketCart, type MarketListing, type MarketListingDetail } from "../../api/marketplace";
import { resolveAssetUrl, apiErrorMessage } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import MarketCard, { listingHref, rupees } from "../../components/MarketCard";

/* MultiShop wireframe 9 — product page with price comparison across shops. */
export default function MarketProduct() {
  const { shopId = "", productId = "" } = useParams();
  const navigate = useNavigate();
  const customer = usePortalStore((s) => s.customer);
  const [cart, setCart] = useState<MarketCart | null>(null);

  const [item, setItem] = useState<MarketListingDetail | null>(null);
  const [related, setRelated] = useState<MarketListing[]>([]);
  const [missing, setMissing] = useState(false);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"description" | "specs">("description");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setItem(null);
    setMissing(false);
    setImg(0);
    setQty(1);
    setMsg(null);
    getMarketListing(Number(shopId), Number(productId))
      .then((d) => {
        if (!alive) return;
        setItem(d);
        if (d.category) {
          searchMarket({ category: d.category, shopId: d.shop.id, inStock: true, limit: 5 })
            .then((r) => alive && setRelated(r.data.filter((x) => x.productId !== d.productId).slice(0, 4)))
            .catch(() => {});
        }
      })
      .catch(() => alive && setMissing(true));
    if (customer) getMarketCart().then((c) => alive && setCart(c)).catch(() => {});
    window.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [shopId, productId]);

  if (missing) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <h1 className="text-[18px] font-bold">Product not available</h1>
        <p className="text-[13px] text-slate-500 mt-1">The shop may have removed it.</p>
        <Link to="/market/search" className="btn-primary mt-5">Search products</Link>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="grid lg:grid-cols-2 gap-8 animate-pulse">
        <div className="aspect-square rounded-[22px] bg-[#EEEEEE]" />
        <div className="space-y-4 pt-4"><div className="h-8 w-3/4 bg-slate-100 rounded" /><div className="h-10 w-1/2 bg-slate-100 rounded" /></div>
      </div>
    );
  }

  const gallery = (item.images.length ? item.images.map((i) => i.url) : item.imageUrl ? [item.imageUrl] : []).map((u) => resolveAssetUrl(u)).filter(Boolean) as string[];
  const signedIn = Boolean(customer);
  const inCart =
    cart?.groups.find((g) => g.shop.id === item.shop.id)?.cart?.items.find((c) => c.productId === item.productId)?.quantity ?? 0;
  const maxQty = Math.max(0, item.stock - inCart);
  const cheapest = [item, ...item.otherOffers].filter((o) => o.inStock).sort((a, b) => a.price - b.price)[0];

  async function add(buyNow: boolean) {
    if (!item) return;
    if (!signedIn) {
      navigate(`/portal/login?next=${encodeURIComponent(`/market/p/${item.shop.id}/${item.productId}`)}`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      setCart(await setMarketCartItem(item.shop.id, item.productId, inCart + qty));
      window.dispatchEvent(new Event("market-cart-changed"));
      if (buyNow) navigate("/market/cart");
      else setMsg({ ok: true, text: `Added ${qty} to your cart` });
    } catch (err) {
      setMsg({ ok: false, text: apiErrorMessage(err, "Could not add to cart") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <nav className="text-[13px] text-slate-500 flex flex-wrap gap-1.5" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link to={`/market/shop/${encodeURIComponent(item.shop.code)}`} className="hover:text-brand-700">{item.shop.name}</Link>
        {item.category && (
          <>
            <span>/</span>
            <Link to={`/market/search?category=${encodeURIComponent(item.category)}`} className="hover:text-brand-700">{item.category}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-navy-900 font-medium truncate max-w-[50vw]">{item.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div className="relative aspect-square rounded-[22px] bg-[#EEEEEE] overflow-hidden flex items-center justify-center">
            {gallery.length ? <img src={gallery[img]} alt={item.name} className="w-full h-full object-contain p-[10%] mix-blend-multiply" /> : <span className="text-[13px] text-slate-400">No image</span>}
            {item.discountPercent > 0 && <span className="absolute left-4 bottom-4 px-3 py-1 rounded-full bg-white text-[13px] font-bold text-rose-600">{item.discountPercent}% OFF</span>}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {gallery.slice(0, 10).map((src, i) => (
                <button key={src + i} type="button" onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`aspect-square rounded-xl bg-[#EEEEEE] ring-2 ${i === img ? "ring-brand-600" : "ring-transparent hover:ring-slate-300"}`}>
                  <img src={src} alt="" className="w-full h-full object-contain p-2 mix-blend-multiply" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight tracking-tight">{item.name}</h1>
          <p className="mt-2 text-[13px] text-slate-500">
            {item.brand ? `${item.brand} · ` : ""}Sold by{" "}
            <Link to={`/market/shop/${encodeURIComponent(item.shop.code)}`} className="font-semibold text-brand-700 hover:underline">{item.shop.name}</Link>
            {item.shop.address ? ` · ${item.shop.address}` : ""}
          </p>
          <div className="mt-5 flex items-baseline flex-wrap gap-x-3">
            <span className="text-[32px] font-bold text-navy-900 tabular">{rupees(item.price)}</span>
            {item.discountPercent > 0 && (
              <span className="text-[14px] text-slate-500">MRP <s className="tabular">{rupees(item.mrp)}</s> · <b className="text-rose-600">{item.discountPercent}% off</b></span>
            )}
          </div>
          <p className="text-[12px] text-slate-500 mt-1">{item.gstPercent > 0 ? `Includes ${item.gstPercent}% GST` : "Inclusive of all taxes"}</p>
          <p className={`mt-3 text-[13.5px] font-semibold ${item.inStock ? (item.stock <= 5 ? "text-amber-700" : "text-emerald-700") : "text-rose-600"}`}>
            {item.inStock ? (item.stock <= 5 ? `Only ${item.stock} left` : "In stock") : "Out of stock"}
          </p>
          {cheapest && cheapest.shop.id !== item.shop.id && cheapest.price < item.price && (
            <Link to={listingHref(cheapest)} className="mt-3 block rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-[13px] text-emerald-800 hover:bg-emerald-100">
              Cheaper at <b>{cheapest.shop.name}</b> for <b>{rupees(cheapest.price)}</b> →
            </Link>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="flex items-center rounded-xl ring-1 ring-border bg-white h-12 self-start sm:self-auto">
              <button type="button" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="w-12 h-full text-[18px] font-bold disabled:opacity-40" aria-label="Decrease quantity">−</button>
              <span className="w-10 text-center font-bold tabular" aria-live="polite">{qty}</span>
              <button type="button" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)} className="w-12 h-full text-[18px] font-bold disabled:opacity-40" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" disabled={!item.inStock || busy || (signedIn && maxQty <= 0)} onClick={() => add(false)} className="btn-primary h-12 flex-1 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
              {busy ? "Adding…" : signedIn ? "Add to cart" : "Log in to add to cart"}
            </button>
            {signedIn && (
              <button type="button" disabled={!item.inStock || busy || maxQty <= 0} onClick={() => add(true)} className="btn-secondary h-12 flex-1">Buy now</button>
            )}
          </div>
          {signedIn && inCart > 0 && <p className="mt-2 text-[12px] text-slate-500">{inCart} already in your cart from {item.shop.name}.</p>}
          {msg && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {msg.text} {msg.ok && <Link to="/market/cart" className="font-semibold underline ml-1">View cart</Link>}
            </div>
          )}
          <div className="mt-6 rounded-2xl border border-border p-4 text-[13px] text-slate-600">
            <div className="font-semibold text-navy-900">Delivery</div>
            Home delivery or pickup from {item.shop.name} — chosen at checkout.
          </div>
        </div>
      </div>

      {/* Price comparison */}
      <section>
        <h2 className="text-[20px] font-semibold mb-3">Also sold by other shops</h2>
        {item.otherOffers.length === 0 ? (
          <p className="text-[13px] text-slate-500">No other shop on the marketplace lists this product right now.</p>
        ) : (
          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Shop</th>
                  <th className="!text-right">Price</th>
                  <th>Availability</th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {item.otherOffers.map((o) => (
                  <tr key={`${o.shop.id}-${o.productId}`}>
                    <td>
                      <Link to={`/market/shop/${encodeURIComponent(o.shop.code)}`} className="font-medium text-navy-900 hover:text-brand-700">{o.shop.name}</Link>
                      {o.shop.address && <div className="text-[11.5px] text-slate-400">{o.shop.address}</div>}
                    </td>
                    <td className={`text-right font-bold tabular ${o.price < item.price ? "text-emerald-600" : "text-navy-900"}`}>{rupees(o.price)}</td>
                    <td>{o.inStock ? <span className="badge-active">In stock</span> : <span className="badge-inactive">Out of stock</span>}</td>
                    <td className="text-right"><Link to={listingHref(o)} className="btn-secondary btn-sm">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 border-b border-border pb-3">
          {([["description", "Description"], ["specs", "Specifications"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 min-h-[40px] rounded-full text-[13.5px] font-semibold border ${tab === k ? "bg-navy-900 text-white border-navy-900" : "bg-white text-slate-600 border-border"}`}>{l}</button>
          ))}
        </div>
        <div className="pt-5 max-w-3xl">
          {tab === "description" ? (
            <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line">{item.description && item.description !== item.name ? item.description : "The shop hasn't added a description yet."}</p>
          ) : (
            <dl className="grid sm:grid-cols-2 border border-border rounded-2xl overflow-hidden">
              {[["SKU", item.sku], ["Brand", item.brand || "—"], ["Category", item.category || "—"], ["MRP", item.mrp ? rupees(item.mrp) : "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-3 border-b border-slate-100 text-[13px]"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="text-[20px] font-semibold mb-4">More from {item.shop.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{related.map((l) => <MarketCard key={`${l.shop.id}-${l.productId}`} listing={l} />)}</div>
        </section>
      )}
    </div>
  );
}
