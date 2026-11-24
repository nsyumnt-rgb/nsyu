import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Icon, Modal, Pagination, SearchInput, Segmented, StatCard, Toast } from "../components/ui";
import { apiErrorMessage } from "../api/client";
import { cancelTransfer, dispatchTransfer, listTransfers, receiveTransfer, transferStock, type TransferStatus } from "../api/inventory";
import { listShops } from "../api/shops";
import { listProducts } from "../api/products";
import { useAuthStore } from "../store/authStore";
import type { Product, Shop, StockTransfer } from "../types";

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_CHIP: Record<TransferStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  in_transit: "bg-sky-50 text-sky-700 ring-sky-600/15",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const PAGE_SIZE = 15;

function itemsOf(t: StockTransfer) {
  if (Array.isArray(t.items) && t.items.length) return t.items;
  return t.product ? [{ productId: t.product.id, productName: t.product.name, quantity: t.quantity ?? 0 }] : [];
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Move stock between the owner's shops: create, dispatch, receive and cancel transfers. */
export default function StockTransfers() {
  const activeShopId = useAuthStore((s) => s.shopId);
  const [status, setStatus] = useState<"all" | TransferStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof listTransfers>>["data"]["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<StockTransfer | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok = true) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listTransfers({ status: status === "all" ? undefined : status, search: search.trim() || undefined, page, limit: PAGE_SIZE });
      setData(r.data.data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const t = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    listShops()
      .then((r) => setShops((r.data.data || []).filter((s) => s.status !== "inactive")))
      .catch(() => setShops([]));
  }, []);

  const act = async (t: StockTransfer, kind: "dispatch" | "receive") => {
    setBusyId(t.id);
    try {
      const r = kind === "dispatch" ? await dispatchTransfer(t.id) : await receiveTransfer(t.id);
      flash((r.data as any).message || (kind === "dispatch" ? "Dispatched" : "Received"));
      load();
    } catch (e) {
      flash(apiErrorMessage(e), false);
    } finally {
      setBusyId(null);
    }
  };

  const m = data?.metrics;
  const canTransfer = shops.length >= 2;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Transfers" value={m?.totalTransfers ?? "—"} icon="repeat" tone="brand" />
        <StatCard label="Units moved" value={m?.totalItemsTransferred ?? "—"} icon="layers" tone="emerald" />
        <StatCard label="Pending" value={m?.pendingTransfers ?? "—"} icon="clock" tone="amber" />
        <StatCard label="Completed" value={m?.completedTransfers ?? "—"} icon="checkCircle" tone="sky" />
      </div>

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <Segmented
            size="sm"
            value={status}
            onChange={(k) => {
              setStatus(k);
              setPage(1);
            }}
            options={[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "in_transit", label: "In transit" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ]}
          />
          <div className="flex gap-2 items-center">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Transfer no. or note"
              className="w-full sm:w-56"
            />
            <button type="button" className="btn btn-primary whitespace-nowrap" disabled={!canTransfer} title={canTransfer ? undefined : "You need at least two shops to transfer stock"} onClick={() => setCreating(true)}>
              <Icon name="plus" /> New transfer
            </button>
          </div>
        </div>

        {!canTransfer && shops.length > 0 && (
          <p className="px-5 pt-3 text-[12.5px] text-slate-500">Transfers move stock between your shops. Add a second shop to start.</p>
        )}

        <div className="card-body p-0">
          {error ? (
            <EmptyState icon="alert" tone="rose" title="Could not load transfers" text={error} action={<button className="btn btn-secondary" onClick={load}>Try again</button>} />
          ) : loading && !data ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
          ) : !data?.transfers.length ? (
            <EmptyState icon="repeat" title="No transfers" text={status === "all" && !search ? "Stock you move between shops shows up here." : "Nothing matches this filter."} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.transfers.map((t) => {
                const items = itemsOf(t);
                const units = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
                const atSource = t.from_shop_id === activeShopId;
                const atDest = t.to_shop_id === activeShopId;
                return (
                  <li key={t.id} className="px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-navy-900 text-[13.5px]">{t.transfer_no || `#${t.id}`}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${STATUS_CHIP[t.status] || STATUS_CHIP.completed}`}>{STATUS_LABEL[t.status] || t.status}</span>
                      </div>
                      <div className="text-[12.5px] text-slate-600 mt-0.5 flex items-center gap-1.5">
                        <span className="font-semibold">{t.fromShop?.name ?? `Shop ${t.from_shop_id}`}</span>
                        <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{t.toShop?.name ?? `Shop ${t.to_shop_id}`}</span>
                        <span className="text-slate-400">· {fmtDate(t.created_at)}</span>
                      </div>
                      <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                        {units} unit{units === 1 ? "" : "s"} · {items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}
                        {t.notes ? ` · ${t.notes}` : ""}
                        {t.status === "cancelled" && t.cancellation_reason ? ` · Cancelled: ${t.cancellation_reason}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {t.status === "pending" && (
                        <button className="btn btn-secondary" disabled={busyId === t.id} onClick={() => act(t, "dispatch")} title={atSource ? undefined : "Takes the stock out of the source shop"}>
                          <Icon name="truck" /> Dispatch
                        </button>
                      )}
                      {(t.status === "pending" || t.status === "in_transit") && (
                        <button className="btn btn-primary" disabled={busyId === t.id} onClick={() => act(t, "receive")} title={atDest ? undefined : "Adds the stock to the destination shop"}>
                          <Icon name="check" /> Receive
                        </button>
                      )}
                      {t.status !== "cancelled" && (
                        <button className="btn btn-ghost text-rose-600" disabled={busyId === t.id} onClick={() => setCancelling(t)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {data && data.totalPages > 1 && (
          <div className="px-5 pb-4">
            <Pagination page={data.page} pages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={setPage} noun="transfers" />
          </div>
        )}
      </div>

      {creating && (
        <NewTransferModal
          shops={shops}
          defaultFrom={activeShopId}
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setCreating(false);
            flash(msg);
            setPage(1);
            load();
          }}
        />
      )}
      {cancelling && (
        <CancelModal
          transfer={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(msg, ok) => {
            setCancelling(null);
            flash(msg, ok);
            if (ok) load();
          }}
        />
      )}
      {toast && <Toast text={toast.text} ok={toast.ok} />}
    </div>
  );
}

function CancelModal({ transfer, onClose, onDone }: { transfer: StockTransfer; onClose: () => void; onDone: (msg: string, ok: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const effect =
    transfer.status === "completed"
      ? `The stock goes back: it is taken out of ${transfer.toShop?.name ?? "the destination"} and returned to ${transfer.fromShop?.name ?? "the source"}.`
      : transfer.status === "in_transit"
        ? `The stock already taken out of ${transfer.fromShop?.name ?? "the source"} is put back.`
        : "No stock has moved yet, so nothing changes in either shop.";
  const submit = async () => {
    setBusy(true);
    try {
      const r = await cancelTransfer(transfer.id, reason.trim() || undefined);
      onDone((r.data as any).message || "Transfer cancelled", true);
    } catch (e) {
      onDone(apiErrorMessage(e), false);
    }
  };
  return (
    <Modal
      size="sm"
      title={`Cancel ${transfer.transfer_no || "transfer"}?`}
      icon="alert"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Keep it</button>
          <button className="btn btn-danger" disabled={busy} onClick={submit}>{busy ? "Cancelling…" : "Cancel transfer"}</button>
        </>
      }
    >
      <p className="text-[13px] text-slate-600 mb-3">{effect}</p>
      <label className="label">Reason (optional)</label>
      <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Wrong shop selected" />
    </Modal>
  );
}

type Line = { productId: number; name: string; available: number | null; quantity: string };

function NewTransferModal({ shops, defaultFrom, onClose, onDone }: { shops: Shop[]; defaultFrom: number | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [fromShopId, setFromShopId] = useState<number>(defaultFrom && shops.some((s) => s.id === defaultFrom) ? defaultFrom : shops[0]?.id);
  const [toShopId, setToShopId] = useState<number>(() => shops.find((s) => s.id !== fromShopId)?.id ?? 0);
  const [mode, setMode] = useState<"completed" | "in_transit" | "pending">("completed");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [pick, setPick] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Products with their stock at the SOURCE shop (reloaded when the source changes)
  useEffect(() => {
    let live = true;
    setProducts(null);
    listProducts({ status: "active", limit: 500, shopId: fromShopId })
      .then((r) => live && setProducts(r.data.data || []))
      .catch((e) => live && setErr(apiErrorMessage(e)));
    return () => {
      live = false;
    };
  }, [fromShopId]);

  const stockAt = useCallback((p: Product, shopId: number) => {
    const s = p.stocks?.find((x) => x.shop_id === shopId);
    if (s) return Number(s.current_stock);
    const cur = (p as Product & { current_stock?: number }).current_stock;
    return cur === undefined || cur === null ? null : Number(cur);
  }, []);

  // Refresh the shown stock when the source shop changes
  useEffect(() => {
    if (!products) return;
    setLines((ls) => ls.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      return { ...l, available: p ? stockAt(p, fromShopId) : null };
    }));
  }, [fromShopId, products, stockAt]);

  const matches = useMemo(() => {
    const q = pick.trim().toLowerCase();
    if (!q || !products) return [];
    return products.filter((p) => !lines.some((l) => l.productId === p.id) && (p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))).slice(0, 8);
  }, [pick, products, lines]);

  const add = (p: Product) => {
    setLines((ls) => [...ls, { productId: p.id, name: p.name, available: stockAt(p, fromShopId), quantity: "1" }]);
    setPick("");
  };

  const submit = async () => {
    setErr(null);
    if (!fromShopId || !toShopId || fromShopId === toShopId) return setErr("Choose two different shops.");
    if (!lines.length) return setErr("Add at least one product.");
    const items = lines.map((l) => ({ productId: l.productId, quantity: Math.floor(Number(l.quantity)) }));
    if (items.some((i) => !(i.quantity > 0))) return setErr("Every quantity must be at least 1.");
    if (mode !== "pending") {
      const short = lines.find((l, i) => l.available !== null && items[i].quantity > l.available);
      if (short) return setErr(`Only ${short.available} of “${short.name}” in the source shop.`);
    }
    setBusy(true);
    try {
      const r = await transferStock({ fromShopId, toShopId, items, status: mode, notes: notes.trim() || undefined });
      onDone((r.data as any).message || "Transfer created");
    } catch (e) {
      setErr(apiErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      size="lg"
      title="New stock transfer"
      subtitle="Move stock from one of your shops to another."
      icon="repeat"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={busy || !lines.length} onClick={submit}>{busy ? "Saving…" : "Create transfer"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">From shop</label>
            <select className="input" value={fromShopId} onChange={(e) => {
              const v = Number(e.target.value);
              setFromShopId(v);
              if (v === toShopId) setToShopId(shops.find((s) => s.id !== v)?.id ?? 0);
            }}>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To shop</label>
            <select className="input" value={toShopId} onChange={(e) => setToShopId(Number(e.target.value))}>
              {shops.filter((s) => s.id !== fromShopId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">When does the stock move?</label>
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { key: "completed", label: "Now (both shops)" },
              { key: "in_transit", label: "Send now, receive later" },
              { key: "pending", label: "Plan only" },
            ]}
          />
          <p className="text-[12px] text-slate-500 mt-1.5">
            {mode === "completed" ? "Stock leaves the source and arrives at the destination immediately." : mode === "in_transit" ? "Stock leaves the source now. The destination adds it when they press Receive." : "Nothing moves until someone presses Dispatch or Receive."}
          </p>
        </div>

        <div>
          <label className="label">Products</label>
          <div className="relative">
            <SearchInput value={pick} onChange={setPick} placeholder={products ? "Search a product to add" : "Loading products…"} />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-pop ring-1 ring-slate-200 max-h-64 overflow-auto">
                {matches.map((p) => {
                  const st = stockAt(p, fromShopId);
                  return (
                    <li key={p.id}>
                      <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between gap-3 text-[13px]" onClick={() => add(p)}>
                        <span className="truncate">{p.name} <span className="text-slate-400">{p.sku}</span></span>
                        {st !== null && <span className="text-slate-500 shrink-0">{st} in stock</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {lines.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {lines.map((l, idx) => (
                <li key={l.productId} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-navy-900 truncate">{l.name}</div>
                    {l.available !== null && <div className="text-[11.5px] text-slate-500">{l.available} in source shop</div>}
                  </div>
                  <input
                    className="input w-24 text-right"
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                    aria-label={`Quantity of ${l.name}`}
                  />
                  <button type="button" className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${l.name}`} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={250} placeholder="Restock for weekend sale" />
        </div>
        {err && <p className="text-[13px] text-rose-600 font-medium">{err}</p>}
      </div>
    </Modal>
  );
}
