import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchMarket, type MarketListing, type MarketSort } from "../../api/marketplace";
import MarketCard from "../../components/MarketCard";

/**
 * Filterable product grid used by Search (wireframe 10) and the shop storefront (wireframe 2).
 * All filter state lives in the URL so results can be shared and bookmarked.
 */
export default function ListingBrowser({
  title,
  categories,
  shops,
  fixedShopId,
}: {
  title: (q: string, total: number | null) => string;
  categories: { name: string; count: number }[];
  shops?: { id: number; name: string }[];
  fixedShopId?: number;
}) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const shopId = fixedShopId ?? (params.get("shop") ? Number(params.get("shop")) : undefined);
  const minPrice = params.get("min") ? Number(params.get("min")) : undefined;
  const maxPrice = params.get("max") ? Number(params.get("max")) : undefined;
  const inStock = params.get("stock") === "1";
  const sort = (params.get("sort") as MarketSort) || "relevance";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [rows, setRows] = useState<MarketListing[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [minIn, setMinIn] = useState(minPrice?.toString() ?? "");
  const [maxIn, setMaxIn] = useState(maxPrice?.toString() ?? "");
  const [sheet, setSheet] = useState(false);

  const set = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    setParams(next);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    searchMarket({ q: q || undefined, category: category || undefined, shopId, minPrice, maxPrice, inStock, sort, page, limit: 24 })
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setTotal(r.pagination.total);
        setPages(r.pagination.pages);
      })
      .catch(() => alive && (setError(true), setRows([])))
      .finally(() => alive && setLoading(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => {
      alive = false;
    };
  }, [q, category, shopId, minPrice, maxPrice, inStock, sort, page]);

  const activeChips: [string, () => void][] = [];
  if (category) activeChips.push([category, () => set({ category: undefined })]);
  if (!fixedShopId && shopId) activeChips.push([shops?.find((s) => s.id === shopId)?.name || "Shop", () => set({ shop: undefined })]);
  if (minPrice !== undefined || maxPrice !== undefined)
    activeChips.push([`₹${minPrice ?? 0} – ${maxPrice !== undefined ? `₹${maxPrice}` : "any"}`, () => { setMinIn(""); setMaxIn(""); set({ min: undefined, max: undefined }); }]);
  if (inStock) activeChips.push(["In stock", () => set({ stock: undefined })]);

  const Filters = (
    <div className="space-y-6">
      <FilterGroup title="Category">
        <Choice label="All categories" active={!category} onClick={() => set({ category: undefined })} />
        {categories.map((c) => (
          <Choice key={c.name} label={c.name} count={c.count} active={category.toLowerCase() === c.name.toLowerCase()} onClick={() => set({ category: c.name })} />
        ))}
      </FilterGroup>
      {shops && shops.length > 0 && !fixedShopId && (
        <FilterGroup title="Shop">
          <Choice label="All shops" active={!shopId} onClick={() => set({ shop: undefined })} />
          {shops.map((s) => (
            <Choice key={s.id} label={s.name} active={shopId === s.id} onClick={() => set({ shop: String(s.id) })} />
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Price (₹)">
        <div className="flex items-center gap-2">
          <input className="input px-2.5" type="number" min={0} placeholder="Min" value={minIn} onChange={(e) => setMinIn(e.target.value)} aria-label="Minimum price" />
          <span className="text-slate-400">–</span>
          <input className="input px-2.5" type="number" min={0} placeholder="Max" value={maxIn} onChange={(e) => setMaxIn(e.target.value)} aria-label="Maximum price" />
        </div>
        <button type="button" className="btn-secondary btn-sm w-full mt-2" onClick={() => { set({ min: minIn || undefined, max: maxIn || undefined }); setSheet(false); }}>Apply</button>
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className="flex items-center gap-2.5 text-[13.5px] text-slate-700 cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={inStock} onChange={(e) => set({ stock: e.target.checked ? "1" : undefined })} className="w-4 h-4 rounded border-border text-brand-600" />
          In stock only
        </label>
      </FilterGroup>
      {activeChips.length > 0 && (
        <button type="button" onClick={() => { setMinIn(""); setMaxIn(""); setParams(q ? { q } : {}); setSheet(false); }} className="text-[13px] font-semibold text-rose-600">Clear all</button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">{title(q, total)}</h1>
        <div className="flex items-center gap-2">
          <button type="button" className="lg:hidden btn-secondary" onClick={() => setSheet(true)}>Filters{activeChips.length ? ` (${activeChips.length})` : ""}</button>
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="hidden sm:inline">Sort:</span>
            <select className="input w-auto pr-8" value={sort} onChange={(e) => set({ sort: e.target.value === "relevance" ? undefined : e.target.value })} aria-label="Sort">
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-8 items-start">
        <aside className="hidden lg:block w-60 shrink-0 sticky top-24">{Filters}</aside>
        {sheet && (
          <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="absolute inset-0 bg-navy-950/40" onClick={() => setSheet(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[17px] font-bold">Filters</span>
                <button type="button" onClick={() => setSheet(false)} className="w-11 h-11 rounded-full hover:bg-slate-100" aria-label="Close filters">✕</button>
              </div>
              {Filters}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-5">
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map(([label, clear]) => (
                <button key={label} type="button" onClick={clear} className="badge-brand py-1 hover:bg-brand-100">{label} ✕</button>
              ))}
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card aspect-[3/4] animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="card p-10 text-center text-[13px] text-rose-600">Couldn't load products. Please try again.</div>
          ) : rows.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-[15px] font-semibold text-navy-900">No products found{q ? ` for “${q}”` : ""}</div>
              <p className="text-[13px] text-slate-500 mt-1">Try fewer words, another category, or remove some filters.</p>
              {categories.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {categories.slice(0, 4).map((c) => (
                    <button key={c.name} type="button" onClick={() => set({ q: undefined, category: c.name })} className="badge-inactive py-1 hover:bg-slate-200">Try: {c.name}</button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {rows.map((l) => <MarketCard key={`${l.shop.id}-${l.productId}`} listing={l} />)}
            </div>
          )}
          {pages > 1 && !loading && (
            <div className="flex justify-center items-center gap-3 pt-2">
              <button type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} className="btn-secondary">‹ Prev</button>
              <span className="text-[13px] text-slate-600">Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} className="btn-secondary">Next ›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-label mb-2">{title}</div>
      <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function Choice({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 text-left px-2.5 min-h-[40px] rounded-lg text-[13.5px] transition ${active ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-700 hover:bg-slate-100"}`}
      aria-pressed={active}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="text-[11.5px] text-slate-400 tabular">{count}</span>}
    </button>
  );
}
