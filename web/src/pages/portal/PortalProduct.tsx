import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPortalProductApi, getPortalProductsApi, setCartItemApi } from "../../api/portal";
import { resolveAssetUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { BoxIcon, CartIcon, ProductCard, inr, priceInfo, type Product } from "../../components/StoreProduct";
import { removeCartItemApi } from "../../api/portal";

/* E-commerce wireframe p4 — product page (single-shop: "other shops", variants,
   reviews and pincode check need marketplace data that doesn't exist yet). */

export default function PortalProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customer = usePortalStore((s) => s.customer);
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"description" | "specs">("description");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setActiveImg(0);
    setQty(1);
    setMessage(null);
    getPortalProductApi(Number(id))
      .then((p) => {
        if (!alive) return;
        if (!p) return setNotFound(true);
        setProduct(p);
        if (p.category?.id) {
          getPortalProductsApi({ categoryId: p.category.id, limit: 6 })
            .then((r) => alive && setRelated((r?.data || []).filter((x: Product) => x.id !== p.id).slice(0, 4)))
            .catch(() => {});
        } else {
          setRelated([]);
        }
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    window.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [id]);

  const inCart = (pid: number) => cart?.items?.find((i) => i.productId === pid)?.quantity ?? 0;

  async function addToCart(goToCart: boolean) {
    if (!product) return;
    setBusy(goToCart ? "buy" : "add");
    setMessage(null);
    try {
      const updated = await setCartItemApi(product.id, inCart(product.id) + qty);
      setCart(updated);
      if (goToCart) navigate("/portal/cart");
      else setMessage({ ok: true, text: `Added ${qty} to your cart` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.response?.data?.message || "Could not add to cart" });
    } finally {
      setBusy(null);
    }
  }

  async function relatedQty(pid: number, q: number) {
    setUpdatingId(pid);
    try {
      setCart(q <= 0 ? await removeCartItemApi(pid) : await setCartItemApi(pid, q));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update cart");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
        <div className="aspect-square rounded-[22px] bg-[#EEEEEE]" />
        <div className="space-y-4 pt-4">
          <div className="h-8 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/3 bg-slate-100 rounded" />
          <div className="h-10 w-1/2 bg-slate-100 rounded" />
          <div className="h-12 w-full bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <h1 className="text-[18px] font-bold">Product not available</h1>
        <p className="text-[13px] text-slate-500 mt-1">It may have been removed from the store.</p>
        <Link to="/portal/catalog" className="btn-primary mt-5">Back to shop</Link>
      </div>
    );
  }

  const images = (product.images || []).map((i) => resolveAssetUrl(i.url)).filter(Boolean) as string[];
  const { price, mrp, off } = priceInfo(product);
  const stock = Number(product.inventory?.availableStock ?? 0);
  const out = stock <= 0;
  const already = inCart(product.id);
  const maxQty = Math.max(0, stock - already);

  return (
    <div className="space-y-10 pb-6">
      {/* Breadcrumb */}
      <nav className="text-[13px] text-slate-500 flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
        <Link to="/portal/home" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link to="/portal/catalog" className="hover:text-brand-700">Shop</Link>
        {product.category && (
          <>
            <span>/</span>
            <span>{product.category.name}</span>
          </>
        )}
        <span>/</span>
        <span className="text-navy-900 font-medium truncate max-w-[50vw]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square rounded-[22px] bg-[#EEEEEE] overflow-hidden flex items-center justify-center">
            {images.length > 0 ? (
              <img src={images[activeImg]} alt={product.name} className="w-full h-full object-contain p-[10%] mix-blend-multiply" />
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <BoxIcon className="w-16 h-16" />
                <span className="text-[12px] mt-2">No image available</span>
              </div>
            )}
            {off > 0 && (
              <span className="absolute left-4 bottom-4 px-3 py-1 rounded-full bg-white text-[13px] font-bold text-rose-600 shadow-xs">{off}% OFF</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {images.slice(0, 10).map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square rounded-xl bg-[#EEEEEE] overflow-hidden ring-2 transition ${i === activeImg ? "ring-brand-600" : "ring-transparent hover:ring-slate-300"}`}
                  aria-label={`Image ${i + 1}`}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-2 mix-blend-multiply" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="lg:pt-2">
          <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight tracking-tight">{product.name}</h1>
          <p className="mt-2 text-[13px] text-slate-500">
            {product.brand ? <>{product.brand} · </> : null}
            Sold by <span className="font-semibold text-navy-900">{customer?.shop?.name || "this shop"}</span>
          </p>

          <div className="mt-5 flex items-baseline flex-wrap gap-x-3 gap-y-1">
            <span className="text-[32px] font-bold text-navy-900 tabular leading-none">{inr(price)}</span>
            {off > 0 && (
              <span className="text-[14px] text-slate-500">
                MRP <span className="line-through tabular">{inr(mrp)}</span> · <span className="font-bold text-rose-600">{off}% off</span>
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-500 mt-1.5">
            {product.pricing?.gstPercent > 0 ? `Price includes ${product.pricing.gstPercent}% GST` : "Inclusive of all taxes"}
          </p>

          <div className={`mt-4 text-[13.5px] font-semibold ${out ? "text-rose-600" : stock <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
            {out ? "Out of stock" : stock <= 5 ? `Only ${stock} left in stock` : "In stock"}
            {already > 0 && <span className="ml-2 font-medium text-slate-500">· {already} already in your cart</span>}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="flex items-center rounded-xl ring-1 ring-border bg-white overflow-hidden h-12 self-start sm:self-auto">
              <button type="button" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-full text-[18px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Decrease quantity">−</button>
              <span className="w-12 text-center text-[15px] font-bold text-navy-900 tabular" aria-live="polite">{qty}</span>
              <button type="button" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="w-11 h-full text-[18px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" disabled={out || maxQty <= 0 || busy !== null} onClick={() => addToCart(false)} className="btn-primary h-12 flex-1 text-[14.5px] disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
              <CartIcon className="w-4 h-4" /> {busy === "add" ? "Adding…" : "Add to cart"}
            </button>
            <button type="button" disabled={out || maxQty <= 0 || busy !== null} onClick={() => addToCart(true)} className="btn-secondary h-12 flex-1 text-[14.5px] border-navy-900 text-navy-900">
              {busy === "buy" ? "Please wait…" : "Buy now"}
            </button>
          </div>
          {!out && maxQty <= 0 && <p className="text-[12.5px] text-amber-700 mt-2">All available stock is already in your cart.</p>}
          {message && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${message.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {message.text}
              {message.ok && <Link to="/portal/cart" className="ml-2 font-semibold underline">View cart</Link>}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-border p-4">
            <div className="text-[13.5px] font-semibold text-navy-900">Delivery</div>
            <p className="text-[13px] text-slate-600 mt-1">
              Home delivery or pickup from {customer?.shop?.name || "the shop"} — choose at checkout.
            </p>
            {customer?.shop?.address && <p className="text-[12px] text-slate-500 mt-1">Shop address: {customer.shop.address}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <section>
        <div className="flex gap-2 border-b border-border pb-3">
          {([
            ["description", "Description"],
            ["specs", "Specifications"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-full text-[13.5px] font-semibold border transition ${tab === k ? "bg-navy-900 text-white border-navy-900" : "bg-white text-slate-600 border-border hover:border-slate-400"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="pt-5">
          {tab === "description" ? (
            product.description && product.description !== product.name ? (
              <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line max-w-3xl">{product.description}</p>
            ) : (
              <p className="text-[13.5px] text-slate-500">The shop hasn't added a description for this product yet.</p>
            )
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 max-w-3xl border border-border rounded-2xl overflow-hidden">
              {[
                ["SKU", product.sku],
                ["Brand", product.brand || "—"],
                ["Category", product.category?.name || "—"],
                ["GST", product.pricing?.gstPercent > 0 ? `${product.pricing.gstPercent}%` : "Included"],
                ["MRP", mrp > 0 ? inr(mrp) : "—"],
                ["Availability", out ? "Out of stock" : "In stock"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 border-b border-slate-100 sm:odd:border-r">
                  <dt className="text-[13px] text-slate-500">{k}</dt>
                  <dd className="text-[13px] font-medium text-navy-900 text-right font-mono">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-[22px] sm:text-[28px] font-semibold tracking-tight">Related products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} qty={inCart(p.id)} updating={updatingId === p.id} onQty={(q) => relatedQty(p.id, q)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
