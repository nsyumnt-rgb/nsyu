import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listProducts } from "../api/products";
import { getInventoryHistory, recordMovement } from "../api/inventory";
import { getOrders } from "../api/orders";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ProductItemIcon from "../components/ProductItemIcon";
import type { InventoryTransaction, Product } from "../types";
import { EmptyState, Icon, Meter, PageHeader, Pagination, SearchInput, Segmented, StatCard, Toast } from "../components/ui";

/* Marketplace wireframe — board 15 (Inventory). */

type Tab = "all" | "low" | "out" | "movements";
type Reason = "count" | "damaged" | "return" | "other";

const REASONS: { key: Reason; label: string; hint: string }[] = [
  { key: "count", label: "Count correction", hint: "Physical count differs from the system" },
  { key: "damaged", label: "Damaged / expired", hint: "Removes stock" },
  { key: "return", label: "Customer return", hint: "Adds stock back" },
  { key: "other", label: "Other", hint: "Explain in the note" },
];

// Online orders that are placed but not yet shipped hold stock (board 15, note 1).
const RESERVING = ["pending", "confirmed", "processing"];

const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

const MOVE_LABEL: Record<string, string> = {
  opening: "Opening stock",
  purchase: "Purchase received",
  purchase_in: "Purchase received",
  sale: "Sale",
  sale_out: "Sale",
  customer_return: "Customer return",
  damage: "Adjustment: damaged",
  damaged: "Adjustment: damaged",
  adjustment: "Adjustment",
  adjustment_in: "Adjustment",
  adjustment_out: "Adjustment",
  purchase_return: "Returned to supplier",
  sale_reversal: "Sale reversed",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
};

function InventoryInner() {
  const { can } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && ["all", "low", "out", "movements"].includes(tabParam) ? tabParam : "all";
  const setTab = (t: Tab) => setParams(t === "all" ? {} : { tab: t });

  const [products, setProducts] = useState<Product[]>([]);
  const [reserved, setReserved] = useState<Map<number, number>>(new Map());
  const [moves, setMoves] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE = 25;

  // Adjust panel
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [reason, setReason] = useState<Reason>("count");
  const [mode, setMode] = useState<"change" | "set">("change");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      listProducts(),
      getOrders().catch(() => ({ data: { data: [] as any[] } })),
      getInventoryHistory({ limit: 60 }).catch(() => ({ data: { data: [] as InventoryTransaction[] } })),
    ])
      .then(([p, o, h]) => {
        setProducts(p.data.data ?? []);
        const map = new Map<number, number>();
        for (const order of (o.data.data ?? []) as any[]) {
          if (!RESERVING.includes(String(order.status).toLowerCase())) continue;
          for (const it of order.items ?? []) {
            if (!it.product_id) continue;
            map.set(it.product_id, (map.get(it.product_id) || 0) + Number(it.quantity || 0));
          }
        }
        setReserved(map);
        setMoves((h.data.data as any) ?? []);
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load inventory")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = useMemo(
    () =>
      products.map((p) => {
        const onHand = Number(p.stocks?.[0]?.current_stock ?? 0);
        const res = reserved.get(p.id) || 0;
        const reorderAt = Number((p as any).min_stock ?? p.stocks?.[0]?.min_stock ?? 0);
        const available = onHand - res;
        const state: "ok" | "low" | "out" = onHand <= 0 ? "out" : onHand <= reorderAt ? "low" : "ok";
        return { p, onHand, res, available, reorderAt, state };
      }),
    [products, reserved]
  );

  const kpi = useMemo(
    () => ({
      skus: rows.length,
      value: rows.reduce((a, r) => a + Math.max(0, r.onHand) * Number(r.p.purchase_price || 0), 0),
      low: rows.filter((r) => r.state === "low").length,
      out: rows.filter((r) => r.state === "out").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "low" ? r.state === "low" : tab === "out" ? r.state === "out" : true))
      .filter((r) => !q || r.p.name.toLowerCase().includes(q) || String(r.p.sku || "").toLowerCase().includes(q) || String((r.p as any).barcode || "").includes(q))
      .sort((a, b) => (tab === "all" ? a.p.name.localeCompare(b.p.name) : a.onHand - b.onHand));
  }, [rows, tab, search]);

  useEffect(() => setPage(1), [tab, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  function openAdjust(p: Product) {
    setAdjusting(p);
    setReason("count");
    setMode("change");
    setQty("");
    setNote("");
    setAdjError(null);
  }

  const current = Number(adjusting?.stocks?.[0]?.current_stock ?? 0);
  const delta = (() => {
    const n = Number(qty);
    if (qty.trim() === "" || !Number.isFinite(n)) return 0;
    if (reason === "damaged") return -Math.abs(Math.trunc(n));
    if (reason === "return") return Math.abs(Math.trunc(n));
    return mode === "set" ? Math.trunc(n) - current : Math.trunc(n);
  })();

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjusting) return;
    setAdjError(null);
    if (delta === 0) return setAdjError(mode === "set" ? "Counted quantity matches the current stock — nothing to change." : "Enter a quantity.");
    if (current + delta < 0) return setAdjError(`Stock can't go below 0 (current ${current}).`);
    if (reason === "other" && !note.trim()) return setAdjError("Add a note explaining this adjustment.");

    const label = REASONS.find((r) => r.key === reason)!.label;
    const type = reason === "damaged" ? "damage" : reason === "return" ? "customer_return" : "adjustment";
    const quantity = type === "adjustment" ? delta : Math.abs(delta);
    setSaving(true);
    try {
      await recordMovement({ productId: adjusting.id, type: type as any, quantity, notes: `[Reason: ${label}]${note.trim() ? ` ${note.trim()}` : ""}` });
      setToast(`${adjusting.name}: ${delta > 0 ? "+" : ""}${delta} → ${current + delta} in stock`);
      setAdjusting(null);
      load();
    } catch (err) {
      setAdjError(apiErrorMessage(err, "Could not save the adjustment"));
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const head = ["Product", "SKU", "On hand", "Reserved", "Available", "Reorder at", "Status", "Cost price", "Stock value"];
    const body = filtered.map((r) => [r.p.name, r.p.sku, r.onHand, r.res, r.available, r.reorderAt, r.state, Number(r.p.purchase_price || 0), Math.max(0, r.onHand) * Number(r.p.purchase_price || 0)]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canAdjust = can("inventory", "edit") || can("inventory", "create");
  const okCount = Math.max(0, kpi.skus - kpi.low - kpi.out);
  const pct = (n: number) => (kpi.skus ? (n / kpi.skus) * 100 : 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Stock"
        title="Inventory"
        subtitle="Stock on hand, what's held by open orders, and every movement."
        actions={
          <>
            <Link to="/app/settings/inventory" className="btn-ghost">
              <Icon name="layers" /> Transfers & advanced
            </Link>
            <button type="button" onClick={exportCsv} className="btn-secondary">
              <Icon name="download" className="w-4 h-4 text-slate-500" /> Export CSV
            </button>
            {can("purchase", "create") && (
              <Link to="/app/purchase" className="btn-primary">
                <Icon name="truck" /> Receive stock
              </Link>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total SKUs" icon="box" tone="brand" value={kpi.skus.toLocaleString("en-IN")} loading={loading} active={tab === "all"} onClick={() => setTab("all")} hint={`${okCount.toLocaleString("en-IN")} healthy`} />
        <StatCard label="Stock value (cost)" icon="rupee" tone="violet" value={inr(kpi.value)} loading={loading} hint="Units on hand × cost price" />
        <StatCard label="Low stock" icon="alert" tone="amber" value={String(kpi.low)} valueClass={kpi.low ? "text-amber-600" : undefined} loading={loading} active={tab === "low"} onClick={() => setTab("low")} hint="At or below reorder level" />
        <StatCard label="Out of stock" icon="archive" tone="rose" value={String(kpi.out)} valueClass={kpi.out ? "text-rose-600" : undefined} loading={loading} active={tab === "out"} onClick={() => setTab("out")} hint="Can't be sold right now" />
      </div>

      {/* Stock health bar */}
      {!loading && kpi.skus > 0 && (
        <div className="card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-[13px] font-semibold text-navy-900">Stock health</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Healthy <b className="text-navy-900 tabular">{okCount}</b></span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Low <b className="text-navy-900 tabular">{kpi.low}</b></span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Out <b className="text-navy-900 tabular">{kpi.out}</b></span>
            </div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-[2px]">
            <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${pct(okCount)}%` }} />
            <div className="bg-amber-400 transition-all duration-700" style={{ width: `${pct(kpi.low)}%` }} />
            <div className="bg-rose-500 transition-all duration-700" style={{ width: `${pct(kpi.out)}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Stock table / movements */}
        <section className="card overflow-hidden xl:col-span-8">
          <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { key: "all", label: "All stock", count: kpi.skus },
                { key: "low", label: "Low", count: kpi.low, tone: "amber" },
                { key: "out", label: "Out", count: kpi.out, tone: "rose" },
                { key: "movements", label: "Movements" },
              ]}
            />
            {tab !== "movements" && <SearchInput className="md:w-[260px]" value={search} onChange={setSearch} placeholder="Search name, SKU or barcode…" />}
          </div>

          {error && (
            <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
              <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {tab === "movements" ? (
            <MovementList moves={moves} loading={loading} full />
          ) : loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-slate-100" />
                  <div className="flex-1 h-3 rounded bg-slate-100" />
                  <div className="w-16 h-3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            tab === "low" || tab === "out" ? (
              <EmptyState icon="checkCircle" tone="emerald" title={tab === "low" ? "Nothing is low on stock" : "Nothing is out of stock"} text="Nice — your shelves are covered." />
            ) : (
              <EmptyState icon="search" title="No products match" text={search ? "Try a different name, SKU or barcode." : "Add products to start tracking stock."} />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="!text-right whitespace-nowrap">On hand</th>
                      <th>Available</th>
                      <th className="!text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.p.id} className={adjusting?.id === r.p.id ? "!bg-brand-50/60" : ""}>
                        <td>
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <ProductItemIcon name={r.p.name} category={r.p.category?.name} imageUrl={r.p.images?.[0]?.url} size="sm" />
                            <div className="min-w-0">
                              <Link to={`/app/products/${r.p.id}`} className="block max-w-[240px] truncate text-[13px] font-semibold text-navy-900 hover:text-brand-700">{r.p.name}</Link>
                              <div className="text-[11.5px] text-slate-400 font-mono">{r.p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="font-semibold tabular text-navy-900">{r.onHand}</div>
                          {r.res > 0 && <div className="text-[11px] font-medium text-brand-700 tabular">{r.res} reserved</div>}
                        </td>
                        <td>
                          <div className="w-[130px]">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={`text-[13.5px] font-bold tabular ${r.state === "out" ? "text-rose-600" : r.state === "low" ? "text-amber-600" : "text-emerald-600"}`}>{r.available}</span>
                              <span className={r.state === "out" ? "badge-danger" : r.state === "low" ? "badge-warn" : "badge-active"}>
                                {r.state === "out" ? "Out" : r.state === "low" ? "Low" : "OK"}
                              </span>
                            </div>
                            <Meter value={Math.max(0, r.available)} max={Math.max(r.reorderAt * 3, r.onHand, 1)} tone={r.state === "out" ? "rose" : r.state === "low" ? "amber" : "emerald"} className="mt-1" />
                            <div className="mt-0.5 text-[10.5px] text-slate-400 tabular">Reorder at {r.reorderAt}</div>
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            {canAdjust && (
                              <button type="button" className={adjusting?.id === r.p.id ? "btn-soft btn-sm" : "btn-secondary btn-sm"} onClick={() => openAdjust(r.p)}>
                                <Icon name="sliders" className="w-3.5 h-3.5" /> Adjust
                              </button>
                            )}
                            {r.state !== "ok" && (
                              <Link to="/app/purchase" className="btn-soft btn-sm" title="Reorder — record a purchase">
                                <Icon name="truck" className="w-3.5 h-3.5" /> <span className="hidden 2xl:inline">Reorder</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} total={filtered.length} pageSize={PAGE} onPage={(p) => setPage(Math.min(pages, Math.max(1, p)))} noun="products" />
            </>
          )}
        </section>

        {/* Right column: adjust + recent movements */}
        <div className="xl:col-span-4 space-y-5 xl:sticky xl:top-24">
          <section className={`card overflow-hidden transition ${adjusting ? "ring-4 ring-brand-500/10 border-brand-300" : ""}`}>
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center">
                  <Icon name="sliders" className="w-4 h-4" />
                </span>
                <h2 className="card-title text-[14px]">Adjust stock</h2>
              </div>
              {adjusting && <button type="button" onClick={() => setAdjusting(null)} className="btn-ghost btn-sm">Clear</button>}
            </div>
            {!adjusting ? (
              <EmptyState compact icon="sliders" tone="brand" title="Pick a product" text={<>Choose <b>Adjust</b> on any row to correct its stock. Every change needs a reason and is saved in the movement log.</>} />
            ) : (
              <form onSubmit={saveAdjustment} className="p-5 space-y-4">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <ProductItemIcon name={adjusting.name} category={adjusting.category?.name} imageUrl={adjusting.images?.[0]?.url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-navy-900 truncate">{adjusting.name}</div>
                    <div className="text-[12px] text-slate-500">In stock now</div>
                  </div>
                  <div className="text-[20px] font-bold tabular text-navy-900">{current}</div>
                </div>
                <div>
                  <label className="label">Reason</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REASONS.map((r) => (
                      <label key={r.key} className={`relative flex flex-col rounded-xl px-3 py-2.5 cursor-pointer ring-1 transition ${reason === r.key ? "ring-2 ring-brand-500 bg-brand-50/60" : "ring-border hover:ring-slate-300"}`}>
                        <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="sr-only" />
                        <span className="text-[12.5px] font-semibold text-navy-900">{r.label}</span>
                        <span className="text-[11px] text-slate-500 leading-snug mt-0.5">{r.hint}</span>
                        {reason === r.key && <Icon name="checkCircle" className="absolute top-2 right-2 w-3.5 h-3.5 text-brand-600" />}
                      </label>
                    ))}
                  </div>
                </div>
                {(reason === "count" || reason === "other") && (
                  <Segmented
                    size="sm"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { key: "change", label: "Change by ±" },
                      { key: "set", label: "Set counted qty" },
                    ]}
                  />
                )}
                <div>
                  <label className="label">
                    {reason === "damaged" ? "Quantity to remove" : reason === "return" ? "Quantity returned" : mode === "set" ? "Counted quantity" : "Quantity change (use − to reduce)"}
                  </label>
                  <input type="number" step={1} className="input text-[16px] font-semibold tabular" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={mode === "set" ? String(current) : "e.g. 5 or -2"} autoFocus />
                  {delta !== 0 && (
                    <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium ${current + delta < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
                      <span className="tabular">{current}</span>
                      <Icon name="arrowRight" className="w-3.5 h-3.5" />
                      <b className="tabular text-navy-900">{current + delta}</b>
                      <span className={`ml-auto font-bold tabular ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{delta > 0 ? "+" : ""}{delta}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Note {reason === "other" ? "" : "(optional)"}</label>
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Shelf count on 17 Nov" maxLength={200} />
                </div>
                {adjError && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {adjError}</p>
                )}
                <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Saving…" : "Save adjustment"}</button>
              </form>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="card-header">
              <h2 className="card-title text-[14px]">Recent movements</h2>
              <button type="button" onClick={() => setTab("movements")} className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
                View all <Icon name="arrowRight" className="w-3.5 h-3.5" />
              </button>
            </div>
            <MovementList moves={moves.slice(0, 6)} loading={loading} />
          </section>
        </div>
      </div>

      {toast && <Toast text={toast} />}
    </div>
  );
}

function MovementList({ moves, loading, full = false }: { moves: InventoryTransaction[]; loading: boolean; full?: boolean }) {
  if (loading) return <div className="py-10 text-center text-[13px] text-slate-500">Loading…</div>;
  if (!moves.length) return <EmptyState compact icon="clock" title="No stock movements yet" text="Purchases, sales and adjustments will be logged here." />;
  return (
    <ul className="divide-y divide-slate-100">
      {moves.map((m) => {
        const q = Number(m.signed_quantity);
        const reason = (m.notes || "").match(/\[Reason: ([^\]]+)\]/)?.[1];
        return (
          <li key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
            <span className={`w-9 h-9 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 ${q >= 0 ? "bg-emerald-50 text-emerald-600 ring-emerald-600/10" : "bg-rose-50 text-rose-600 ring-rose-600/10"}`}>
              <Icon name={q >= 0 ? "arrowDown" : "arrowUp"} className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-navy-900 truncate">
                {reason && m.type === "adjustment" ? `Adjustment: ${reason.toLowerCase()}` : MOVE_LABEL[m.type] || m.type}
              </div>
              <div className="text-[11.5px] text-slate-400 truncate">
                {m.product?.name || `Product #${m.product_id}`} · {new Date(m.created_at || (m as any).createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                {full && ` · balance ${m.balance_after}`}
              </div>
            </div>
            <span className={`text-[14px] font-bold tabular ${q >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{q > 0 ? "+" : q < 0 ? "−" : ""}{Math.abs(q)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function InventoryOverview() {
  return (
    <RequireModule module="inventory">
      <InventoryInner />
    </RequireModule>
  );
}
