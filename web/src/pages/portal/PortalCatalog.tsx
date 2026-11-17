import { useEffect, useState, useCallback, useRef } from "react";
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
  imageUrl?: string | null;
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

/** Indian-grouped rupees; drops ".00" for whole amounts like a retail price tag. */
const inr = (n: number) => {
  const v = Number(n || 0);
  const whole = Math.abs(v % 1) < 0.005;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};

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
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Categories + newest products (for the New Arrivals rail)
  useEffect(() => {
    getPortalCategoriesApi().then(setCategories).catch(() => {});
    getPortalProductsApi({ sort: "newest", page: 1, limit: 12 })
      .then((res) => setNewArrivals(res?.data || []))
      .catch(() => setNewArrivals([]));
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

  const pickCategory = (id: number | null) => {
    setSelectedCategory(id);
    setPage(1);
    requestAnimationFrame(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const activeCategoryName = categories.find((c) => c.id === selectedCategory)?.name;
  const cartCount = cart?.itemCount ?? cart?.items?.length ?? 0;
  const browsing = !search.trim() && selectedCategory === null;

  const cardProps = (prod: Product) => ({
    product: prod,
    qty: getCartQuantity(prod.id),
    updating: updatingId === prod.id,
    onQty: (q: number) => handleUpdateQuantity(prod.id, q),
    onOpen: () => setQuickView(prod),
  });

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* ── Store header + search ─────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="section-label">{customer?.shop?.name || "Online store"}</div>
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight mt-1">Shop</h1>
        </div>
        <div className="relative w-full md:w-[420px]">
          <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search products, brands or SKU…"
            className="w-full pl-12 pr-11 py-3 rounded-full bg-white border border-border text-[14.5px] text-slate-800 placeholder:text-slate-400 shadow-xs focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </section>

      {/* ── Category rail (round tiles) ───────────────────────── */}
      {categories.length > 0 && (
        <section className="-mx-4 sm:mx-0 bg-[#EEEEEE] sm:rounded-3xl">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto px-4 sm:px-8 py-6 sm:py-8 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryTile
              label="All Products"
              active={selectedCategory === null}
              onClick={() => pickCategory(null)}
              icon={<GridIcon className="w-9 h-9 text-slate-500" />}
            />
            {categories.map((cat) => (
              <CategoryTile
                key={cat.id}
                label={cat.name}
                active={selectedCategory === cat.id}
                onClick={() => pickCategory(cat.id)}
                imageUrl={resolveAssetUrl(cat.imageUrl)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── New Arrivals carousel ─────────────────────────────── */}
      {browsing && newArrivals.length > 0 && (
        <ProductRail title="New Arrivals">
          {newArrivals.map((prod) => (
            <div key={prod.id} className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[calc((100%-4*24px)/5)]">
              <ProductCard {...cardProps(prod)} />
            </div>
          ))}
        </ProductRail>
      )}

      {/* ── All products grid ─────────────────────────────────── */}
      <section ref={gridRef} className="scroll-mt-24 space-y-6">
        <div className="text-center">
          <h2 className="text-[26px] sm:text-[34px] font-semibold tracking-tight">
            {activeCategoryName || (search.trim() ? "Search results" : "All Products")}
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            {loading ? "Loading…" : totalCount !== null ? `${totalCount} product${totalCount === 1 ? "" : "s"}` : `${products.length} shown`}
            {search.trim() && !loading ? ` for “${search.trim()}”` : ""}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-[22px] bg-[#EEEEEE]" />
                <div className="h-4 w-4/5 bg-slate-100 rounded mt-4 mx-auto" />
                <div className="h-4 w-1/2 bg-slate-100 rounded mt-2 mx-auto" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#EEEEEE] text-slate-400 rounded-full flex items-center justify-center">
              <SearchIcon className="w-7 h-7" />
            </div>
            <h3 className="text-[16px] font-semibold text-navy-900">No products found</h3>
            <p className="text-[13px] text-slate-500 mt-1">Try a different search or choose another category.</p>
            {(search || selectedCategory !== null) && (
              <button type="button" onClick={() => { setSearch(""); setSelectedCategory(null); }} className="btn-secondary mt-5 rounded-full">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10 sm:gap-x-6">
            {products.map((prod) => (
              <ProductCard key={prod.id} {...cardProps(prod)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-secondary rounded-full">
              ← Previous
            </button>
            <span className="text-[13px] font-medium text-slate-600 tabular">
              Page <span className="font-bold text-navy-900">{page}</span> of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="btn-secondary rounded-full">
              Next →
            </button>
          </div>
        )}
      </section>

      {/* ── Mobile floating cart bar ──────────────────────────── */}
      {cart && cartCount > 0 && (
        <div className="md:hidden fixed bottom-[76px] left-3 right-3 z-30 animate-fade-in">
          <Link to="/portal/cart" className="w-full bg-navy-900 text-white py-3 px-4 rounded-2xl shadow-lift flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <CartIcon className="w-5 h-5" />
              </span>
              <div className="leading-tight">
                <div className="text-[11.5px] text-brand-100/80">{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</div>
                <div className="text-[15px] font-bold tabular">{inr(cart.estimatedTotal)}</div>
              </div>
            </div>
            <span className="text-[13.5px] font-semibold">View cart →</span>
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

/* ───────────────────────── Category tile ───────────────────────── */

function CategoryTile({
  label,
  active,
  onClick,
  imageUrl,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  imageUrl?: string | null;
  icon?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" onClick={onClick} className="snap-start shrink-0 w-[92px] sm:w-[128px] flex flex-col items-center gap-3 group">
      <span
        className={`w-[84px] h-[84px] sm:w-[124px] sm:h-[124px] rounded-full bg-white flex items-center justify-center overflow-hidden transition-all duration-200 ${
          active ? "ring-[3px] ring-brand-600 ring-offset-2 ring-offset-[#EEEEEE]" : "group-hover:-translate-y-1 group-hover:shadow-card"
        }`}
      >
        {imageUrl && !failed ? (
          <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="w-[72%] h-[72%] object-contain transition-transform duration-300 group-hover:scale-105" />
        ) : (
          icon ?? <span className="text-[26px] sm:text-[34px] font-bold text-slate-400">{label.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className={`text-[12.5px] sm:text-[15px] font-semibold text-center leading-snug line-clamp-2 ${active ? "text-brand-700" : "text-navy-900"}`}>
        {label}
      </span>
    </button>
  );
}

/* ───────────────────────── Product rail (carousel) ───────────────────────── */

function ProductRail({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [children]);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <section className="space-y-6 sm:space-y-8">
      <h2 className="text-center text-[26px] sm:text-[40px] font-semibold tracking-tight">{title}</h2>
      <div className="relative">
        <div ref={ref} onScroll={update} className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {!edge.start && (
          <button type="button" onClick={() => scroll(-1)} aria-label="Previous" className="hidden md:flex absolute -left-6 top-[38%] -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-border shadow-card items-center justify-center text-slate-600 hover:text-navy-900">
            ←
          </button>
        )}
        {!edge.end && (
          <button type="button" onClick={() => scroll(1)} aria-label="Next" className="hidden md:flex absolute -right-6 top-[38%] -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-border shadow-card items-center justify-center text-slate-600 hover:text-navy-900">
            →
          </button>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Product card ───────────────────────── */

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
    <div className="group flex flex-col">
      <button type="button" onClick={onOpen} className="relative block aspect-square rounded-[22px] bg-[#EEEEEE] overflow-hidden" aria-label={`View ${product.name}`}>
        {img && !imgFailed ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 w-full h-full object-contain p-[12%] mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.06] ${out ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <BoxIcon className="w-12 h-12" />
            <span className="text-[11px] mt-1.5 font-medium">No image</span>
          </div>
        )}
        {off > 0 && (
          <span className="absolute left-3 bottom-3 px-3 py-1 rounded-full bg-white text-[12px] sm:text-[13px] font-bold text-rose-600 shadow-xs">
            {off}% OFF
          </span>
        )}
        {out ? (
          <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-semibold text-slate-600">Out of stock</span>
        ) : stock <= 5 ? (
          <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-semibold text-amber-700">Only {stock} left</span>
        ) : null}
      </button>

      <button type="button" onClick={onOpen} title={product.name} className="mt-4 text-center text-[13.5px] sm:text-[15.5px] text-slate-800 leading-snug line-clamp-2 min-h-[2.6em] hover:text-brand-700 tracking-[0.01em]">
        {product.name}
      </button>
      <div className="mt-1.5 flex items-baseline justify-center flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-[15px] sm:text-[17px] font-bold text-navy-900 tabular">{inr(price)}</span>
        {off > 0 && <span className="text-[12.5px] sm:text-[13.5px] text-slate-400 line-through tabular">{inr(mrp)}</span>}
      </div>

      <div className="mt-3">
        {qty > 0 ? (
          <div className="mx-auto flex items-center justify-between max-w-[180px] rounded-full bg-brand-50 ring-1 ring-brand-200 p-1">
            <button type="button" disabled={updating} onClick={() => onQty(qty - 1)} className="w-8 h-8 rounded-full bg-white text-brand-800 text-[17px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50" aria-label="Decrease quantity">
              −
            </button>
            <span className="text-[13px] font-bold text-brand-800 tabular">{updating ? "…" : `${qty} in cart`}</span>
            <button type="button" disabled={updating || qty >= stock} onClick={() => onQty(qty + 1)} className="w-8 h-8 rounded-full bg-white text-brand-800 text-[17px] font-bold hover:bg-brand-100 shadow-xs disabled:opacity-50" aria-label="Increase quantity">
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={updating || out}
            onClick={() => onQty(1)}
            className="mx-auto flex w-full max-w-[180px] h-10 rounded-full border border-navy-900 text-navy-900 text-[13px] font-semibold items-center justify-center gap-2 transition hover:bg-navy-900 hover:text-white disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent active:scale-[0.98]"
          >
            <CartIcon className="w-4 h-4" />
            {out ? "Out of stock" : updating ? "Adding…" : "Add to cart"}
          </button>
        )}
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
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-5 sm:p-8">
            <div className="relative aspect-square rounded-[22px] bg-[#EEEEEE] flex items-center justify-center overflow-hidden">
              {images.length > 0 ? (
                <img src={images[activeImg]} alt={detail.name} className="w-full h-full object-contain p-[10%] mix-blend-multiply" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <BoxIcon className="w-16 h-16" />
                  <span className="text-[12px] mt-2">No image available</span>
                </div>
              )}
              {off > 0 && (
                <span className="absolute left-3 bottom-3 px-3 py-1 rounded-full bg-white text-[13px] font-bold text-rose-600">{off}% OFF</span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 shrink-0 rounded-xl bg-[#EEEEEE] overflow-hidden ring-2 transition ${i === activeImg ? "ring-brand-500" : "ring-transparent hover:ring-slate-300"}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-contain p-1.5 mix-blend-multiply" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-8 md:pl-2 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-brand-700">
                {[detail.brand, detail.category?.name].filter(Boolean).join(" · ") || "General"}
              </div>
              <button type="button" onClick={onClose} className="-mt-1 -mr-1 w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0" aria-label="Close">
                ✕
              </button>
            </div>
            <h2 className="mt-1.5 text-[20px] sm:text-[24px] font-semibold leading-snug">{detail.name}</h2>
            <div className="mt-1 text-[12px] text-slate-400 font-mono">SKU {detail.sku}</div>

            <div className="mt-5 flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <span className="text-[28px] font-bold text-navy-900 tabular">{inr(price)}</span>
              {off > 0 && (
                <>
                  <span className="text-[16px] text-slate-400 line-through tabular">{inr(mrp)}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-[12.5px] font-bold text-rose-600">{off}% OFF</span>
                </>
              )}
            </div>
            <div className="text-[12px] text-slate-500 mt-1">
              {off > 0 && <span className="text-emerald-700 font-semibold">You save {inr(mrp - price)} · </span>}
              {detail.pricing?.gstPercent > 0 ? `Price includes ${detail.pricing.gstPercent}% GST` : "Inclusive of all taxes"}
            </div>

            <div className="mt-4 text-[13px] font-medium">
              {out ? <span className="text-rose-600">Out of stock</span> : stock <= 5 ? <span className="text-amber-700">Only {stock} left in stock</span> : <span className="text-emerald-700">In stock</span>}
            </div>

            {detail.description && detail.description !== detail.name && (
              <div className="mt-5">
                <div className="section-label mb-1.5">About this product</div>
                <p className="text-[13.5px] text-slate-600 leading-relaxed whitespace-pre-line">{detail.description}</p>
              </div>
            )}

            <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-2.5">
              {qty > 0 ? (
                <div className="flex items-center justify-between rounded-full bg-brand-50 ring-1 ring-brand-200 p-1 sm:w-44">
                  <button type="button" disabled={updating} onClick={() => onQty(qty - 1)} className="w-10 h-10 rounded-full bg-white text-brand-800 text-[18px] font-bold shadow-xs disabled:opacity-50" aria-label="Decrease quantity">−</button>
                  <span className="text-[14px] font-bold text-brand-800 tabular">{updating ? "…" : qty}</span>
                  <button type="button" disabled={updating || qty >= stock} onClick={() => onQty(qty + 1)} className="w-10 h-10 rounded-full bg-white text-brand-800 text-[18px] font-bold shadow-xs disabled:opacity-50" aria-label="Increase quantity">+</button>
                </div>
              ) : (
                <button type="button" disabled={updating || out} onClick={() => onQty(1)} className="btn-navy btn-lg flex-1 h-12 rounded-full disabled:bg-slate-200 disabled:text-slate-500">
                  <CartIcon className="w-4 h-4" /> {out ? "Out of stock" : updating ? "Adding…" : "Add to cart"}
                </button>
              )}
              {qty > 0 && (
                <Link to="/portal/cart" className="btn-primary btn-lg flex-1 h-12 rounded-full">
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

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
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
