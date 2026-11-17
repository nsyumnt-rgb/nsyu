import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getPortalCategoriesApi,
  getPortalProductsApi,
  getPortalProductApi,
  setCartItemApi,
  removeCartItemApi,
} from "../../api/portal";
import { resolveAssetUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  brand?: string | null;
  unit: string;
  description?: string | null;
  mrp?: number;
  category?: Category | null;
  images?: Array<{ id: number; url: string; is_primary: boolean }>;
  pricing: {
    unitPrice: number;
    gstPercent: number;
    sellingPriceInclTax: number;
    mrp?: number;
  };
  inventory: {
    availableStock: number;
    isAvailable: boolean;
  };
}

const inr = (n: number, digits = 2) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Real price/MRP comparison from the API — no invented discounts. */
function priceInfo(p: Product) {
  const price = Number(p.pricing?.sellingPriceInclTax || 0);
  const mrp = Number(p.pricing?.mrp ?? p.mrp ?? 0);
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { price, mrp, off };
}

function primaryImage(p: Product) {
  return resolveAssetUrl(p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url);
}

export default function PortalCatalog() {
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);
  const customer = usePortalStore((s) => s.customer);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [quickView, setQuickView] = useState<Product | null>(null);

  // Load categories
  useEffect(() => {
    getPortalCategoriesApi().then(setCategories).catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPortalProductsApi({
        search: search.trim() || undefined,
        categoryId: selectedCategory ?? undefined,
        page,
        limit: 12,
      });
      setProducts(res?.data || []);
      setTotalPages(res?.pagination?.pages || 1);
      setTotalCount(typeof res?.pagination?.total === "number" ? res.pagination.total : null);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const getCartQuantity = (productId: number): number => {
    const item = cart?.items?.find((i) => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const handleUpdateQuantity = async (productId: number, newQty: number) => {
    setUpdatingId(productId);
    try {
      if (newQty <= 0) {
        const updated = await removeCartItemApi(productId);
        setCart(updated);
      } else {
        const updated = await setCartItemApi(productId, newQty);
        setCart(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update cart");
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCategoryName = categories.find((c) => c.id === selectedCategory)?.name;
  const cartCount = cart?.itemCount ?? cart?.items?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Store banner + search ─────────────────────────────── */}
      <section className="hero-brand px-5 py-7 sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-16 w-64 h-64 rounded-full bg-white/[0.06]" />
        <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-brand-400/10" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-[12px] font-medium text-brand-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            {customer?.shop?.name || "Online Store"} · Order online
          </div>
          <h1 className="mt-3 text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight !text-white">
            Shop genuine products at shop prices
          </h1>
          <p className="mt-1.5 text-[14px] text-brand-100/80">
            Browse live stock, add items to your cart and place your order in a few taps.
          </p>
          <div className="relative mt-5">
            <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search products, brands or SKU…"
              className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-white text-[14.5px] text-slate-800 placeholder:text-slate-400 shadow-lift focus:outline-none focus:ring-4 focus:ring-white/25"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Category chips ────────────────────────────────────── */}
      <div className="sticky top-16 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-canvas/90 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[{ id: null as number | null, name: "All products" }, ...categories].map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id ?? "all"}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition border ${
                  active
                    ? "bg-navy-900 text-white border-navy-900 shadow-sm"
                    : "bg-white text-slate-600 border-border hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Results header ────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-navy-900">{activeCategoryName || (search ? "Search results" : "All products")}</h2>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {loading ? "Loading…" : totalCount !== null ? `${totalCount} product${totalCount === 1 ? "" : "s"}` : `${products.length} shown`}
            {search && !loading ? ` for “${search}”` : ""}
          </p>
        </div>
        {cartCount > 0 && (
          <Link to="/portal/cart" className="hidden md:inline-flex btn-soft">
            <CartIcon className="w-4 h-4" /> View cart ({cartCount})
          </Link>
        )}
      </div>

      {/* ── Product grid ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 w-1/3 bg-slate-100 rounded" />
                <div className="h-4 w-4/5 bg-slate-100 rounded" />
                <div className="h-5 w-1/2 bg-slate-100 rounded" />
                <div className="h-9 w-full bg-slate-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-brand-50 text-brand-500 rounded-2xl flex items-center justify-center">
            <SearchIcon className="w-7 h-7" />
          </div>
          <h3 className="text-[16px] font-bold text-navy-900">No products found</h3>
          <p className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">
            Try a different search or choose another category.
          </p>
          {(search || selectedCategory !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory(null);
              }}
              className="btn-soft mt-5"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {products.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              qty={getCartQuantity(prod.id)}
              updating={updatingId === prod.id}
              onQty={(q) => handleUpdateQuantity(prod.id, q)}
              onOpen={() => setQuickView(prod)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn-secondary"
          >
            ← Previous
          </button>
          <span className="text-[13px] font-medium text-slate-600 tabular">
            Page <span className="font-bold text-navy-900">{page}</span> of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn-secondary"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Mobile floating cart bar ──────────────────────────── */}
      {cart && cartCount > 0 && (
        <div className="md:hidden fixed bottom-[76px] left-3 right-3 z-30 animate-fade-in">
          <Link
            to="/portal/cart"
            className="w-full bg-navy-900 text-white py-3 px-4 rounded-2xl shadow-lift flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <CartIcon className="w-5 h-5" />
              </span>
              <div className="leading-tight">
                <div className="text-[11.5px] text-brand-100/80">{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</div>
                <div className="text-[15px] font-bold tabular">{inr(cart.estimatedTotal)}</div>
              </div>
            </div>
            <span className="text-[13.5px] font-semibold flex items-center gap-1">View cart →</span>
          </Link>
        </div>
      )}

      {quickView && (
        <QuickView
          product={quickView}
          qty={getCartQuantity(quickView.id)}
          updating={updatingId === quickView.id}
          onQty={(q) => handleUpdateQuantity(quickView.id, q)}
          onClose={() => setQuickView(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Product card ───────────────────────── */

function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="badge-danger">Out of stock</span>;
  if (stock <= 5) return <span className="badge-warn">Only {stock} left</span>;
  return <span className="badge-active">In stock</span>;
}

function ProductCard({
  product,
  qty,
  updating,
  onQty,
  onOpen,
}: {
  product: Product;
  qty: number;
  updating: boolean;
  onQty: (q: number) => void;
  onOpen: () => void;
}) {
  const img = primaryImage(product);
  const [imgFailed, setImgFailed] = useState(false);
  const { price, mrp, off } = priceInfo(product);
  const stock = product.inventory.availableStock;
  const out = stock <= 0;

  return (
    <div className="group card overflow-hidden flex flex-col transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5 hover:border-brand-200">
      {/* Image */}
      <button type="button" onClick={onOpen} className="relative block aspect-square bg-gradient-to-b from-slate-50 to-white overflow-hidden text-left">
        {img && !imgFailed ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 w-full h-full object-contain p-4 sm:p-6 transition-transform duration-300 group-hover:scale-105 ${out ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
            <BoxIcon className="w-12 h-12" />
            <span className="text-[11px] mt-1.5 font-medium">No image</span>
          </div>
        )}
        {off > 0 && (
          <span className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shadow-sm">
            {off}% OFF
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 hidden sm:block">
          <StockPill stock={stock} />
        </span>
        <span className="absolute inset-x-3 bottom-3 hidden md:flex justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition">
          <span className="px-3 py-1.5 rounded-full bg-white/95 text-[12px] font-semibold text-navy-900 shadow-card ring-1 ring-border">
            Quick view
          </span>
        </span>
      </button>

      {/* Body */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 truncate">
          {product.brand || product.category?.name || "General"}
        </div>
        <button
          type="button"
          onClick={onOpen}
          title={product.name}
          className="mt-1 text-left text-[13.5px] sm:text-[14px] font-semibold text-navy-900 leading-snug line-clamp-2 min-h-[2.5em] hover:text-brand-700"
        >
          {product.name}
        </button>

        <div className="mt-2 flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-[17px] sm:text-[19px] font-bold text-navy-900 tabular">{inr(price, price % 1 ? 2 : 0)}</span>
          {off > 0 && <span className="text-[12.5px] text-slate-400 line-through tabular">{inr(mrp, mrp % 1 ? 2 : 0)}</span>}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {product.pricing.gstPercent > 0 ? `Incl. ${product.pricing.gstPercent}% GST` : "Inclusive of all taxes"}
          <span className="sm:hidden"> · {out ? "Out of stock" : stock <= 5 ? `Only ${stock} left` : "In stock"}</span>
        </div>

        <div className="mt-auto pt-3">
          {qty > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 ring-1 ring-brand-200 p-1">
              <button
                type="button"
                disabled={updating}
                onClick={() => onQty(qty - 1)}
                className="w-9 h-9 rounded-lg bg-white text-brand-800 text-[18px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="text-[13px] font-bold text-brand-800 tabular">{updating ? "…" : qty}</span>
              <button
                type="button"
                disabled={updating || qty >= stock}
                onClick={() => onQty(qty + 1)}
                className="w-9 h-9 rounded-lg bg-white text-brand-800 text-[18px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={updating || out}
              onClick={() => onQty(1)}
              className="w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none text-white text-[13.5px] font-semibold transition shadow-brand flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <CartIcon className="w-4 h-4" />
              {out ? "Out of stock" : updating ? "Adding…" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Quick view modal ───────────────────────── */

function QuickView({
  product,
  qty,
  updating,
  onQty,
  onClose,
}: {
  product: Product;
  qty: number;
  updating: boolean;
  onQty: (q: number) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Product>(product);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    let alive = true;
    getPortalProductApi(product.id)
      .then((d) => alive && d && setDetail({ ...product, ...d }))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose]);

  const images = (detail.images || []).map((i) => resolveAssetUrl(i.url)).filter(Boolean) as string[];
  const { price, mrp, off } = priceInfo(detail);
  const stock = detail.inventory?.availableStock ?? product.inventory.availableStock;
  const out = stock <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-6 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Gallery */}
          <div className="bg-gradient-to-b from-slate-50 to-white p-5 sm:p-8 md:rounded-l-3xl">
            <div className="relative aspect-square rounded-2xl bg-white ring-1 ring-border flex items-center justify-center overflow-hidden">
              {images.length > 0 ? (
                <img src={images[activeImg]} alt={detail.name} className="w-full h-full object-contain p-6" />
              ) : (
                <div className="text-slate-300 flex flex-col items-center">
                  <BoxIcon className="w-16 h-16" />
                  <span className="text-[12px] mt-2">No image available</span>
                </div>
              )}
              {off > 0 && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[12px] font-bold">{off}% OFF</span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 shrink-0 rounded-xl bg-white overflow-hidden ring-2 transition ${i === activeImg ? "ring-brand-500" : "ring-transparent hover:ring-slate-200"}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-5 sm:p-8 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-brand-700">
                {[detail.brand, detail.category?.name].filter(Boolean).join(" · ") || "General"}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mt-1 -mr-1 w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <h2 className="mt-1.5 text-[20px] sm:text-[22px] font-bold leading-snug">{detail.name}</h2>
            <div className="mt-1 text-[12px] text-slate-400 font-mono">SKU {detail.sku}</div>

            <div className="mt-5 flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <span className="text-[28px] font-bold text-navy-900 tabular">{inr(price)}</span>
              {off > 0 && (
                <>
                  <span className="text-[15px] text-slate-400 line-through tabular">MRP {inr(mrp)}</span>
                  <span className="text-[13px] font-bold text-emerald-600">Save {inr(mrp - price)}</span>
                </>
              )}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {detail.pricing?.gstPercent > 0 ? `Price includes ${detail.pricing.gstPercent}% GST` : "Inclusive of all taxes"}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <StockPill stock={stock} />
              {!out && <span className="text-[12px] text-slate-500">{stock} available</span>}
            </div>

            {detail.description && detail.description !== detail.name && (
              <div className="mt-5">
                <div className="section-label mb-1.5">About this product</div>
                <p className="text-[13.5px] text-slate-600 leading-relaxed whitespace-pre-line">{detail.description}</p>
              </div>
            )}

            <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-2.5">
              {qty > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-brand-50 ring-1 ring-brand-200 p-1 sm:w-40">
                  <button type="button" disabled={updating} onClick={() => onQty(qty - 1)} className="w-10 h-10 rounded-lg bg-white text-brand-800 text-[18px] font-bold shadow-xs disabled:opacity-50" aria-label="Decrease quantity">−</button>
                  <span className="text-[14px] font-bold text-brand-800 tabular">{updating ? "…" : qty}</span>
                  <button type="button" disabled={updating || qty >= stock} onClick={() => onQty(qty + 1)} className="w-10 h-10 rounded-lg bg-white text-brand-800 text-[18px] font-bold shadow-xs disabled:opacity-50" aria-label="Increase quantity">+</button>
                </div>
              ) : (
                <button type="button" disabled={updating || out} onClick={() => onQty(1)} className="btn-primary btn-lg flex-1 h-12 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
                  <CartIcon className="w-4 h-4" /> {out ? "Out of stock" : updating ? "Adding…" : "Add to cart"}
                </button>
              )}
              {qty > 0 && (
                <Link to="/portal/cart" className="btn-navy btn-lg flex-1 h-12">
                  Go to cart & checkout →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Icons ───────────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
