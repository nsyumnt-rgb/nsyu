import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getPortalCategoriesApi,
  getPortalProductsApi,
  setCartItemApi,
  removeCartItemApi,
} from "../../api/portal";
import { resolveAssetUrl } from "../../api/client";
import { ProductCard, type Category, type Product } from "../../components/StoreProduct";
import { usePortalStore } from "../../store/portalStore";

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
  const gridRef = useRef<HTMLDivElement>(null);

  // Listing filters (wireframe p3): sort + price range, applied server-side
  const [sort, setSort] = useState<"" | "newest" | "price_asc" | "price_desc" | "popular" | "discount">("");

  // Header search, category links and "View all" rails arrive as URL params (?q=, ?category=, ?sort=).
  const [params] = useSearchParams();
  useEffect(() => {
    const q = params.get("q");
    const cat = params.get("category");
    const so = params.get("sort");
    setSearch(q || "");
    setSelectedCategory(cat && Number.isFinite(Number(cat)) ? Number(cat) : null);
    setSort(so === "newest" || so === "price_asc" || so === "price_desc" || so === "popular" || so === "discount" ? so : "");
    setPage(1);
  }, [params]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [appliedPrice, setAppliedPrice] = useState<{ min?: number; max?: number }>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        sort: sort || undefined,
        minPrice: appliedPrice.min,
        maxPrice: appliedPrice.max,
      });
      setProducts(res?.data || []);
      setTotalPages(res?.pagination?.pages || 1);
      setTotalCount(typeof res?.pagination?.total === "number" ? res.pagination.total : null);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, page, sort, appliedPrice]);

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
  const priceActive = appliedPrice.min !== undefined || appliedPrice.max !== undefined;
  const browsing = !search.trim() && selectedCategory === null && !priceActive && !sort;

  const applyPrice = () => {
    const toNum = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Number(v)));
    setAppliedPrice({ min: toNum(priceMin), max: toNum(priceMax) });
    setPage(1);
    setFiltersOpen(false);
  };
  const clearAll = () => {
    setSearch("");
    setSelectedCategory(null);
    setPriceMin("");
    setPriceMax("");
    setAppliedPrice({});
    setSort("");
    setPage(1);
  };

  const cardProps = (prod: Product) => ({
    product: prod,
    qty: getCartQuantity(prod.id),
    updating: updatingId === prod.id,
    onQty: (q: number) => handleUpdateQuantity(prod.id, q),
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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-tight">
              {activeCategoryName || (search.trim() ? "Search results" : "All Products")}
              {!loading && totalCount !== null && <span className="text-slate-400 font-normal text-[18px] sm:text-[20px]"> ({totalCount})</span>}
            </h2>
            {search.trim() && !loading && <p className="text-[13px] text-slate-500 mt-1">for “{search.trim()}”</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="lg:hidden btn-secondary rounded-full">
              Filters{priceActive || selectedCategory !== null ? " •" : ""}
            </button>
            <label className="flex items-center gap-2 text-[13px] text-slate-500">
              <span className="hidden sm:inline">Sort:</span>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
                className="input w-auto rounded-full py-2 pr-8 text-[13px] font-medium"
                aria-label="Sort products"
              >
                <option value="">Relevance</option>
                <option value="newest">Newest first</option>
                <option value="popular">Best selling</option>
                <option value="discount">Biggest discount</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Filter sidebar (bottom sheet on phones) */}
          {filtersOpen && <div className="lg:hidden fixed inset-0 z-40 bg-navy-950/40" onClick={() => setFiltersOpen(false)} aria-hidden="true" />}
          <aside
            className={`${filtersOpen ? "fixed inset-x-0 bottom-0 z-50 block bg-white rounded-t-3xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto" : "hidden"} lg:static lg:z-auto lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-24 lg:p-0 lg:shadow-none lg:rounded-none lg:bg-transparent lg:max-h-none space-y-6`}
          >
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-[16px] font-bold">Filters</span>
              <button type="button" onClick={() => setFiltersOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100" aria-label="Close filters">✕</button>
            </div>
            <div>
              <div className="section-label mb-2">Category</div>
              <ul className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
                {[{ id: null as number | null, name: "All products" }, ...categories].map((c) => (
                  <li key={c.id ?? "all"}>
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory(c.id); setPage(1); setFiltersOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13.5px] transition ${selectedCategory === c.id ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="section-label mb-2">Price (₹)</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} inputMode="numeric" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="input px-2.5" aria-label="Minimum price" />
                <span className="text-slate-400">–</span>
                <input type="number" min={0} inputMode="numeric" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="input px-2.5" aria-label="Maximum price" />
              </div>
              <button type="button" onClick={applyPrice} className="btn-secondary btn-sm w-full mt-2">Apply price</button>
            </div>
            {(priceActive || selectedCategory !== null || sort || search) && (
              <button type="button" onClick={clearAll} className="text-[13px] font-semibold text-rose-600 hover:text-rose-700">Clear all filters</button>
            )}
          </aside>

          <div className="flex-1 min-w-0 space-y-6">
            {(priceActive || selectedCategory !== null) && (
              <div className="flex flex-wrap gap-2">
                {selectedCategory !== null && (
                  <button type="button" onClick={() => setSelectedCategory(null)} className="badge-brand hover:bg-brand-100">{activeCategoryName} ✕</button>
                )}
                {priceActive && (
                  <button type="button" onClick={() => { setAppliedPrice({}); setPriceMin(""); setPriceMax(""); }} className="badge-brand hover:bg-brand-100">
                    {appliedPrice.min !== undefined ? `₹${appliedPrice.min}` : "₹0"} – {appliedPrice.max !== undefined ? `₹${appliedPrice.max}` : "any"} ✕
                  </button>
                )}
              </div>
            )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6">
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
            {(search || selectedCategory !== null || priceActive) && (
              <button type="button" onClick={clearAll} className="btn-secondary mt-5 rounded-full">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
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
          </div>
        </div>
      </section>

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
