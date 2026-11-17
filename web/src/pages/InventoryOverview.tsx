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

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Stock on hand, what's held by open orders, and every movement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/inventory/manage?tab=Stock%20Transfer" className="btn-ghost">Transfers & advanced</Link>
          <button type="button" onClick={exportCsv} className="btn-secondary">Export CSV</button>
          {can("purchase", "create") && <Link to="/app/purchase" className="btn-navy">+ Receive stock</Link>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Total SKUs" value={kpi.skus.toLocaleString("en-IN")} loading={loading} />
        <Stat label="Stock value (cost)" value={inr(kpi.value)} loading={loading} />
        <Stat label="Low stock" value={String(kpi.low)} tone={kpi.low ? "warn" : undefined} loading={loading} onClick={() => setTab("low")} />
        <Stat label="Out of stock" value={String(kpi.out)} tone={kpi.out ? "due" : undefined} loading={loading} onClick={() => setTab("out")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Stock table / movements */}
        <section className="card overflow-hidden xl:col-span-8">
          <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 overflow-x-auto self-start">
              {([
                ["all", "All stock"],
                ["low", `Low stock (${kpi.low})`],
                ["out", `Out of stock (${kpi.out})`],
                ["movements", "Stock movements"],
              ] as [Tab, string][]).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${tab === k ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {tab !== "movements" && (
              <input className="input sm:max-w-[240px]" placeholder="Search name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
            )}
          </div>

          {error && <div className="m-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>}

          {tab === "movements" ? (
            <MovementList moves={moves} loading={loading} full />
          ) : loading ? (
            <div className="py-14 text-center text-[13px] text-slate-500">Loading stock…</div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-[13px] text-slate-500">
              {tab === "low" ? "Nothing is low on stock." : tab === "out" ? "Nothing is out of stock." : "No products match."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="!text-right">On hand</th>
                      <th className="!text-right">Reserved</th>
                      <th className="!text-right">Available</th>
                      <th className="!text-right">Reorder at</th>
                      <th className="!text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.p.id} className={adjusting?.id === r.p.id ? "bg-brand-50/50" : ""}>
                        <td>
                          <div className="flex items-center gap-3 min-w-0">
                            <ProductItemIcon name={r.p.name} category={r.p.category?.name} imageUrl={r.p.images?.[0]?.url} size="sm" />
                            <div className="min-w-0">
                              <Link to={`/app/products/${r.p.id}`} className="block max-w-[260px] truncate text-[13px] font-medium text-navy-900 hover:text-brand-700">{r.p.name}</Link>
                              <div className="text-[11.5px] text-slate-400 font-mono">{r.p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right font-semibold tabular">{r.onHand}</td>
                        <td className="text-right tabular text-slate-500">{r.res || "—"}</td>
                        <td className="text-right">
                          <span className={`inline-flex items-center gap-1.5 font-semibold tabular ${r.state === "out" ? "text-rose-600" : r.state === "low" ? "text-amber-600" : "text-emerald-600"}`}>
                            {r.available}
                            <span className={r.state === "out" ? "badge-danger" : r.state === "low" ? "badge-warn" : "badge-active"}>
                              {r.state === "out" ? "Out" : r.state === "low" ? "Low" : "OK"}
                            </span>
                          </span>
                        </td>
                        <td className="text-right tabular text-slate-500">{r.reorderAt}</td>
                        <td className="text-right whitespace-nowrap">
                          {r.state === "ok" ? (
                            canAdjust && <button type="button" className="btn-secondary btn-sm" onClick={() => openAdjust(r.p)}>Adjust</button>
                          ) : (
                            <div className="inline-flex gap-1">
                              {canAdjust && <button type="button" className="btn-ghost btn-sm" onClick={() => openAdjust(r.p)}>Adjust</button>}
                              <Link to="/app/purchase" className="btn-soft btn-sm">Reorder</Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-[12.5px] text-slate-500">
                  <span>
                    {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary btn-sm">‹ Prev</button>
                    <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary btn-sm">Next ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right column: adjust + recent movements */}
        <div className="xl:col-span-4 space-y-5 xl:sticky xl:top-24">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Adjust stock</h2>
              {adjusting && <button type="button" onClick={() => setAdjusting(null)} className="text-[12px] text-slate-400 hover:text-slate-700">Clear</button>}
            </div>
            {!adjusting ? (
              <p className="p-5 text-[13px] text-slate-500">Choose <b>Adjust</b> on a product to correct its stock. Every change needs a reason and is saved in the movement log.</p>
            ) : (
              <form onSubmit={saveAdjustment} className="p-5 space-y-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[13.5px] font-semibold text-navy-900 truncate">{adjusting.name}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">Current stock <b className="text-navy-900 tabular">{current}</b></div>
                </div>
                <div>
                  <label className="label">Reason</label>
                  <div className="space-y-1.5">
                    {REASONS.map((r) => (
                      <label key={r.key} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 cursor-pointer ring-1 transition ${reason === r.key ? "ring-brand-400 bg-brand-50/60" : "ring-border hover:ring-slate-300"}`}>
                        <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="mt-0.5 text-brand-600" />
                        <span>
                          <span className="block text-[13px] font-medium text-navy-900">{r.label}</span>
                          <span className="block text-[11.5px] text-slate-500">{r.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {(reason === "count" || reason === "other") && (
                  <div className="inline-flex p-1 rounded-lg bg-slate-100">
                    {([
                      ["change", "Change by ±"],
                      ["set", "Set counted qty"],
                    ] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setMode(k)} className={`px-3 py-1 rounded-md text-[12px] font-semibold ${mode === k ? "bg-white shadow-sm text-navy-900" : "text-slate-500"}`}>{l}</button>
                    ))}
                  </div>
                )}
                <div>
                  <label className="label">
                    {reason === "damaged" ? "Quantity to remove" : reason === "return" ? "Quantity returned" : mode === "set" ? "Counted quantity" : "Quantity change (use − to reduce)"}
                  </label>
                  <input type="number" step={1} className="input text-[15px] font-semibold tabular" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={mode === "set" ? String(current) : "e.g. 5 or -2"} autoFocus />
                  {delta !== 0 && (
                    <p className={`text-[12px] mt-1.5 font-medium ${current + delta < 0 ? "text-rose-600" : "text-slate-600"}`}>
                      {current} → <b className="tabular">{current + delta}</b> ({delta > 0 ? "+" : ""}{delta})
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Note {reason === "other" ? "" : "(optional)"}</label>
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Shelf count on 17 Nov" maxLength={200} />
                </div>
                {adjError && <p className="text-[12.5px] text-rose-600">{adjError}</p>}
                <button type="submit" disabled={saving} className="btn-navy w-full">{saving ? "Saving…" : "Save adjustment"}</button>
              </form>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="card-header">
              <h2 className="card-title">Recent movements</h2>
              <button type="button" onClick={() => setTab("movements")} className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">All →</button>
            </div>
            <MovementList moves={moves.slice(0, 6)} loading={loading} />
          </section>
        </div>
      </div>

      {toast && <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lift bg-navy-900 text-white text-[13px] font-medium animate-fade-in">{toast}</div>}
    </div>
  );
}

function Stat({ label, value, loading, tone, onClick }: { label: string; value: string; loading: boolean; tone?: "warn" | "due"; onClick?: () => void }) {
  const cls = `card p-4 sm:p-5 text-left w-full ${onClick ? "card-hover" : ""}`;
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className={`mt-2 text-[22px] sm:text-[26px] font-bold tracking-tight tabular truncate ${tone === "due" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-navy-900"} ${loading ? "opacity-40 animate-pulse" : ""}`}>{value}</div>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

function MovementList({ moves, loading, full = false }: { moves: InventoryTransaction[]; loading: boolean; full?: boolean }) {
  if (loading) return <div className="py-10 text-center text-[13px] text-slate-500">Loading…</div>;
  if (!moves.length) return <div className="py-10 text-center text-[13px] text-slate-500">No stock movements yet.</div>;
  return (
    <ul className="divide-y divide-slate-100">
      {moves.map((m) => {
        const q = Number(m.signed_quantity);
        const reason = (m.notes || "").match(/\[Reason: ([^\]]+)\]/)?.[1];
        return (
          <li key={m.id} className="px-5 py-3 flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0 ${q >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{q >= 0 ? "+" : "−"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-navy-900 truncate">
                {reason && m.type === "adjustment" ? `Adjustment: ${reason.toLowerCase()}` : MOVE_LABEL[m.type] || m.type}
              </div>
              <div className="text-[11.5px] text-slate-400 truncate">
                {m.product?.name || `Product #${m.product_id}`} · {new Date(m.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
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
