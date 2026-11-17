import { useEffect, useState } from "react";
import { getMarketShops, type MarketShop } from "../../api/marketplace";
import ShopCard from "./ShopCard";

/** All active shops on the marketplace, searchable. */
export default function MarketShops() {
  const [q, setQ] = useState("");
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      getMarketShops({ q: q.trim() || undefined, page, limit: 12 })
        .then((r) => {
          setShops(r.data);
          setPages(r.pagination.pages);
          setTotal(r.pagination.total);
        })
        .catch(() => setShops([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Shops</h1>
          <p className="page-subtitle">{loading ? "Loading…" : `${total} shop${total === 1 ? "" : "s"}`}</p>
        </div>
        <input className="input sm:max-w-xs" placeholder="Search shops or area…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search shops" />
      </div>
      {!loading && shops.length === 0 ? (
        <div className="card p-10 text-center text-[13px] text-slate-500">No shops match “{q}”.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-40 animate-pulse" />) : shops.map((s) => <ShopCard key={s.id} shop={s} />)}
        </div>
      )}
      {pages > 1 && (
        <div className="flex justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary">‹ Prev</button>
          <span className="self-center text-[13px] text-slate-600">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary">Next ›</button>
        </div>
      )}
    </div>
  );
}
