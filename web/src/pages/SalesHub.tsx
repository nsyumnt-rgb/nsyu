import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Billing from "./Billing";
import Sales from "./Sales";
import { getOrders, updateOrderStatus, type OrderRecord } from "../api/orders";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";

/* Sales: new sale (POS billing), online orders queue, invoices. */

type Tab = "pos" | "orders" | "invoices";

// Queue stages mapped onto the existing order statuses (same mapping as the dashboard).
const COLUMNS: { status: string; title: string; next: string; action: string }[] = [
  { status: "pending", title: "New", next: "confirmed", action: "Accept" },
  { status: "confirmed", title: "Accepted", next: "processing", action: "Mark packed" },
  { status: "processing", title: "Packed", next: "shipped", action: "Dispatch" },
  { status: "shipped", title: "Out for delivery", next: "delivered", action: "Mark delivered" },
];

const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

export default function SalesHub() {
  const { can, isOwner } = usePermission();
  const activeShop = useAuthStore((st) => st.activeShop);
  const [params, setParams] = useSearchParams();
  const t = params.get("tab") as Tab | null;
  const tab: Tab = t === "orders" || t === "invoices" ? t : "pos";

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "pos", label: "New sale", show: isOwner || can("billing", "view") },
    { key: "orders", label: "Online orders", show: isOwner || can("orders", "view") },
    { key: "invoices", label: "Invoices", show: isOwner || can("sales", "view") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-navy-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
            <h1 className="text-[26px] sm:text-[30px] font-bold text-navy-900 tracking-tight leading-none">Sales</h1>
            {activeShop?.code && <span className="badge-brand !text-[11.5px] !px-3 !py-1">{activeShop.code}</span>}
          </div>
          <p className="text-[13.5px] text-slate-500 mt-2">
            {tab === "pos" ? "Create bill, add products, apply discount & GST, and save sale." : tab === "orders" ? "Move online orders from new to delivered." : "Every invoice, payment and due."}
          </p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-white border border-border shadow-xs self-start">
          {tabs.filter((x) => x.show).map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setParams(x.key === "pos" ? {} : { tab: x.key })}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition ${tab === x.key ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-navy-900"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pos" && <Billing />}
      {tab === "orders" && <OrdersQueue />}
      {tab === "invoices" && <Sales />}
    </div>
  );
}

/** Online orders queue (board 16, note 2): one card per order, one button moves it to the next stage. */
function OrdersQueue() {
  const { can, isOwner } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const canEdit = isOwner || can("orders", "edit");

  function load() {
    setLoading(true);
    setError(null);
    getOrders()
      .then((r) => setOrders(r.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load orders")))
      .finally(() => setLoading(false));
  }
  useEffect(load, [shopId]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const byStatus = useMemo(() => {
    const m = new Map<string, OrderRecord[]>();
    for (const c of COLUMNS) m.set(c.status, []);
    for (const o of orders) {
      const k = String(o.status).toLowerCase();
      if (m.has(k)) m.get(k)!.push(o);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.order_date || a.created_at) - +new Date(b.order_date || b.created_at));
    return m;
  }, [orders]);

  async function advance(o: OrderRecord, next: string, label: string) {
    setBusy(o.id);
    try {
      await updateOrderStatus(o.id, { status: next });
      setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
      setToast({ ok: true, text: `#${o.order_number} → ${label}` });
    } catch (err) {
      setToast({ ok: false, text: apiErrorMessage(err, "Could not update the order") });
    } finally {
      setBusy(null);
    }
  }

  const openCount = COLUMNS.reduce((a, c) => a + (byStatus.get(c.status)?.length || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-slate-500">
          {loading ? "Loading…" : `${openCount} open order${openCount === 1 ? "" : "s"}`} · oldest first in each column
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="btn-ghost btn-sm">Refresh</button>
          <Link to="/app/orders" className="btn-secondary btn-sm">All orders & billing →</Link>
        </div>
      </div>
      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status) || [];
          const nextTitle = COLUMNS.find((c) => c.status === col.next)?.title || "Delivered";
          return (
            <section key={col.status} className="rounded-2xl bg-slate-100/70 border border-border p-3">
              <header className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-600">{col.title}</h2>
                <span className="min-w-[24px] h-6 px-2 rounded-full bg-white text-[12px] font-bold text-navy-900 flex items-center justify-center shadow-xs">{list.length}</span>
              </header>
              <div className="space-y-2.5 min-h-[80px]">
                {loading ? (
                  <div className="h-24 rounded-xl bg-white/70 animate-pulse" />
                ) : list.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-slate-400">Nothing here</div>
                ) : (
                  list.map((o) => {
                    const items = (o.items || []).reduce((a, i) => a + Number(i.quantity || 0), 0);
                    return (
                      <article key={o.id} className="rounded-xl bg-white border border-border p-3.5 shadow-xs">
                        <div className="flex items-start justify-between gap-2">
                          <Link to="/app/orders" className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline">#{String(o.order_number || o.id).replace(/^#/, "")}</Link>
                          <span className="text-[13.5px] font-bold text-navy-900 tabular">{inr(Number(o.total_amount))}</span>
                        </div>
                        <div className="mt-1 text-[13px] text-slate-700 truncate">{o.customer?.name || "Customer"}</div>
                        <div className="text-[11.5px] text-slate-400">
                          {items} item{items === 1 ? "" : "s"} · {new Date(o.order_date || o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {o.order_type ? ` · ${o.order_type}` : ""}
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={busy === o.id}
                            onClick={() => advance(o, col.next, nextTitle)}
                            className="mt-3 w-full btn-navy btn-sm"
                          >
                            {busy === o.id ? "Saving…" : col.action}
                          </button>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-[12px] text-slate-400">Convert an order into a bill, or cancel it, from “All orders & billing”.</p>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lift text-[13px] font-medium animate-fade-in ${toast.ok ? "bg-navy-900 text-white" : "bg-rose-600 text-white"}`}>{toast.text}</div>
      )}
    </div>
  );
}
