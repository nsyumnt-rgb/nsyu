import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getPortalCategoriesApi,
  getPortalProductsApi,
  setCartItemApi,
  removeCartItemApi,
} from "../../api/portal";
import { CatalogCard, type Category, type Product } from "../../components/StoreProduct";
import { KindIcon, productKind } from "../../components/ProductArt";
import { usePortalStore } from "../../store/portalStore";

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
  const [view, setView] = useState<"grid" | "list">(() => {
    try {
      return localStorage.getItem("nsyu.portal.view") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("nsyu.portal.view", view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Categories (with product counts) for the tiles
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

  const allCount = categories.reduce((a, c: any) => a + Number(c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <StoreIcon className="w-8 h-8 text-brand-700" />
            <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-navy-900 leading-none">Product Catalog</h1>
            {customer?.shop?.code && <span className="badge-brand !px-3 !py-1">{customer.shop.code}</span>}
          </div>
          <p className="text-[13.5px] text-slate-500 mt-2">Browse products, filter by category, search by name, SKU or barcode, and add to cart.</p>
        </div>
      </section>

      {/* ── Category tiles ─────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="-mx-4 sm:mx-0">
          <div className="flex gap-3 overflow-x-auto px-4 sm:px-0 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryTile label="All Products" count={allCount || totalCount} active={selectedCategory === null} onClick={() => pickCategory(null)} icon={<GridIcon className="w-8 h-8" />} />
            {categories.map((cat: any) => (
              <CategoryTile
                key={cat.id}
                label={cat.name}
                count={cat.productCount}
                active={selectedCategory === cat.id}
                onClick={() => pickCategory(cat.id)}
                icon={<KindIcon kind={productKind(cat.name)} className="w-8 h-8" />}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <section ref={gridRef} className="scroll-mt-24 space-y-5">
        <div className="card p-3 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product by name, SKU or barcode..."
              className="input h-12 pl-12 pr-10 text-[14.5px]"
              aria-label="Search products"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center" aria-label="Clear search">
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={`h-12 px-4 rounded-lg border text-[14px] font-semibold inline-flex items-center gap-2 ${priceActive || filtersOpen ? "border-brand-400 bg-brand-50 text-brand-800" : "border-border bg-white text-navy-900 hover:bg-slate-50"}`} aria-expanded={filtersOpen}>
              ₹ Price{priceActive ? " •" : ""}
            </button>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
              className="input h-12 flex-1 lg:w-56 lg:flex-none font-semibold text-navy-900"
              aria-label="Sort products"
            >
              <option value="">Sort: Relevance</option>
              <option value="newest">Sort: Latest</option>
              <option value="price_asc">Sort: Price low to high</option>
              <option value="price_desc">Sort: Price high to low</option>
              <option value="popular">Sort: Best selling</option>
              <option value="discount">Sort: Biggest discount</option>
            </select>
            <div className="hidden sm:inline-flex rounded-lg border border-border overflow-hidden shrink-0" role="group" aria-label="Layout">
              <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`w-12 h-12 flex items-center justify-center ${view === "grid" ? "bg-brand-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`} title="Grid view">
                <GridIcon className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`w-12 h-12 flex items-center justify-center ${view === "list" ? "bg-brand-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`} title="List view">
                <ListIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div className="card p-4 flex flex-wrap items-end gap-3 animate-fade-in">
            <label className="block">
              <span className="label">Min price (₹)</span>
              <input type="number" min={0} inputMode="numeric" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="input w-32" />
            </label>
            <label className="block">
              <span className="label">Max price (₹)</span>
              <input type="number" min={0} inputMode="numeric" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="input w-32" />
            </label>
            <button type="button" onClick={applyPrice} className="btn-primary h-10">Apply</button>
            {priceActive && (
              <button type="button" onClick={() => { setAppliedPrice({}); setPriceMin(""); setPriceMax(""); }} className="btn-ghost h-10">Clear price</button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold text-navy-900">
            {activeCategoryName || (search.trim() ? `Results for “${search.trim()}”` : "All Products")}
            {!loading && totalCount !== null && <span className="text-slate-400 font-normal"> ({totalCount})</span>}
          </h2>
          {(priceActive || selectedCategory !== null || sort || search) && (
            <button type="button" onClick={clearAll} className="text-[13px] font-semibold text-rose-600 hover:text-rose-700">Clear all filters</button>
          )}
        </div>

        {loading ? (
          <div className={view === "grid" ? GRID : "space-y-3"}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[200px] rounded-2xl bg-white border border-border animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="card py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
              <SearchIcon className="w-7 h-7" />
            </div>
            <h3 className="text-[16px] font-semibold text-navy-900">No products found</h3>
            <p className="text-[13px] text-slate-500 mt-1">Try a different search or choose another category.</p>
            {(search || selectedCategory !== null || priceActive) && (
              <button type="button" onClick={clearAll} className="btn-secondary mt-5">Clear filters</button>
            )}
          </div>
        ) : (
          <div className={view === "grid" ? GRID : "space-y-3"}>
            {products.map((prod) => (
              <CatalogCard key={prod.id} layout={view} {...cardProps(prod)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-secondary">
              ← Previous
            </button>
            <span className="text-[13px] font-medium text-slate-600 tabular">
              Page <span className="font-bold text-navy-900">{page}</span> of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="btn-secondary">
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const GRID = "grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

/* ───────────────────────── Category tile ───────────────────────── */

function CategoryTile({ label, count, active, onClick, icon }: { label: string; count?: number | null; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`snap-start shrink-0 w-[124px] sm:w-[150px] rounded-2xl border px-3 py-4 flex flex-col items-center gap-2 text-center transition ${
        active ? "bg-brand-50 border-brand-500 ring-2 ring-brand-500/20 text-brand-800" : "bg-white border-border text-navy-900 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-card"
      }`}
    >
      <span className={active ? "text-brand-700" : "text-brand-700/90"}>{icon}</span>
      <span className="text-[14px] font-bold leading-tight line-clamp-1 capitalize">{label.toLowerCase()}</span>
      {count !== undefined && count !== null && <span className="text-[12.5px] font-semibold text-slate-500 tabular">({count})</span>}
    </button>
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
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M5 12v8h14v-8M10 20v-5h4v5" />
    </svg>
  );
}
