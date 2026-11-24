import { useEffect, useMemo, useState } from "react";
import { getMarketShops, type MarketShop } from "../../api/marketplace";
import MarketCategorySidebar from "../../components/MarketCategorySidebar";
import ShopCard from "./ShopCard";

export default function MarketShops() {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "stock" | "products" | "name">("relevance");
  const [isListView, setIsListView] = useState(false);
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      getMarketShops({ q: q.trim() || undefined, page, limit: 16 })
        .then((r) => {
          setShops(r.data);
          setPages(r.pagination.pages);
          setTotal(r.pagination.total);
        })
        .catch(() => setShops([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, page]);

  // Client-side sorting
  const sortedShops = useMemo(() => {
    const list = [...shops];
    if (sortBy === "stock") {
      return list.sort((a, b) => b.inStockCount - a.inStockCount);
    }
    if (sortBy === "products") {
      return list.sort((a, b) => b.productCount - a.productCount);
    }
    if (sortBy === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [shops, sortBy]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
      
      {/* ============================================================== */}
      {/* LEFT SIDEBAR: CATEGORIES (Image 2 Mockup)                      */}
      {/* ============================================================== */}
      <div className="hidden lg:block sticky top-28 z-10">
        <MarketCategorySidebar />
      </div>

      {/* ============================================================== */}
      {/* RIGHT MAIN CONTENT AREA                                         */}
      {/* ============================================================== */}
      <div className="space-y-6 min-w-0">

        {/* 1. HERO BANNER FOR SHOPS (Image 2 Mockup) */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-100/90 via-emerald-50 to-teal-50 border border-emerald-100 p-6 sm:p-10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 min-h-[260px]">
          {/* Left Hero Content */}
          <div className="max-w-md space-y-3 z-10 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-navy-900 leading-tight tracking-tight">
              Discover Our Premium Shops
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Shop from your favorite stores at the best prices
            </p>
            <div className="pt-2">
              <a
                href="#shops-section"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#047857] hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95"
              >
                <span>Explore Shops →</span>
              </a>
            </div>
          </div>

          {/* Right 3D Storefront Illustration & Graphic */}
          <div className="relative z-10 flex items-center justify-center">
            <div className="relative w-64 sm:w-80 h-44 sm:h-52 rounded-2xl overflow-hidden flex items-center justify-center">
              {/* Modern Storefront 3D Illustration */}
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                {/* Store Roof / Canopy */}
                <div className="w-56 h-7 bg-emerald-600 rounded-t-xl flex justify-between px-2 items-center shadow-md border-b-4 border-emerald-800">
                  <span className="text-[10px] font-black text-white tracking-widest uppercase">
                    NSYU Market Store
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse" />
                </div>
                {/* Store Body & Window */}
                <div className="w-56 h-32 bg-white/95 backdrop-blur-xs rounded-b-xl border border-slate-200/80 p-3 shadow-xl flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="w-full h-12 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center p-1">
                      <span className="text-xl">🏬</span>
                    </div>
                    <div className="h-2 w-3/4 bg-emerald-200/60 rounded" />
                    <div className="h-2 w-1/2 bg-slate-200 rounded" />
                  </div>
                  {/* Shopping Bags Tag */}
                  <div className="w-20 bg-emerald-800 text-white p-2 rounded-xl text-center space-y-0.5 shadow-md">
                    <div className="text-[9px] font-bold text-emerald-200">Shop Better</div>
                    <div className="text-[10px] font-black text-white">Live Better</div>
                    <div className="text-base">🛍️</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. SECTION HEADER & FILTER CONTROLS (Image 2 Mockup) */}
        <div id="shops-section" className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Title & Count */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏪</span>
              <h2 className="text-base sm:text-lg font-extrabold text-navy-900 tracking-tight">
                Our Shops ({total})
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Explore shops from our trusted partners
            </p>
          </div>

          {/* Right Controls: Search, Sort Dropdown, Grid/List Toggles */}
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search shops or area..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
              />
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* Sort by Dropdown */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer appearance-none hover:bg-slate-100 transition"
              >
                <option value="relevance">Sort by: Relevance</option>
                <option value="stock">Highest Stock</option>
                <option value="products">Most Products</option>
                <option value="name">Name A-Z</option>
              </select>
              <svg
                className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Grid / List View Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              {/* Grid Button */}
              <button
                type="button"
                onClick={() => setIsListView(false)}
                className={`p-1.5 rounded-lg transition ${
                  !isListView
                    ? "bg-[#047857] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              {/* List Button */}
              <button
                type="button"
                onClick={() => setIsListView(true)}
                className={`p-1.5 rounded-lg transition ${
                  isListView
                    ? "bg-[#047857] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="List View"
                aria-label="List View"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* 3. SHOPS CARDS DISPLAY (4-Column Grid matching Image 2) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 p-4 h-64 animate-pulse"
              />
            ))}
          </div>
        ) : sortedShops.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-xs text-slate-500">
            No shops match “{q}”.
          </div>
        ) : isListView ? (
          <div className="space-y-3">
            {sortedShops.map((s) => (
              <ShopCard key={s.id} shop={s} isListView={true} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedShops.map((s) => (
              <ShopCard key={s.id} shop={s} isListView={false} />
            ))}
          </div>
        )}

        {/* 4. PAGINATION */}
        {pages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              ‹ Prev
            </button>
            <span className="text-xs font-bold text-slate-600">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next ›
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
