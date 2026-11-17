import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listPortalOrdersApi,
  cancelPortalOrderApi,
  getPortalLedgerSummaryApi,
  setCartItemApi,
} from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

/* E-commerce wireframe p8 — My account › Orders (tabs, progress tracker, khata). */

const inr = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STEPS = [
  { key: "pending", label: "Placed" },
  { key: "confirmed", label: "Accepted" },
  { key: "processing", label: "Packed" },
  { key: "shipped", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
const DONE = ["delivered", "completed", "converted_to_bill", "billed"];
const isActive = (s: string) => ["pending", "confirmed", "processing", "shipped"].includes(String(s).toLowerCase());
const stepIndex = (s: string) => {
  const v = String(s).toLowerCase();
  if (DONE.includes(v)) return STEPS.length - 1;
  return Math.max(0, STEPS.findIndex((x) => x.key === v));
};
const statusLabel = (s: string) => {
  const v = String(s).toLowerCase();
  if (v === "cancelled") return "Cancelled";
  if (v === "converted_to_bill" || v === "billed") return "Billed";
  if (v === "completed") return "Completed";
  return STEPS.find((x) => x.key === v)?.label || s;
};

type Tab = "active" | "past" | "khata";

export default function PortalOrders() {
  const navigate = useNavigate();
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);
  const customer = usePortalStore((s) => s.customer);

  const [tab, setTab] = useState<Tab>("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [khata, setKhata] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Most recent 100 orders; tabs filter client-side so counts stay consistent.
      const res = await listPortalOrdersApi({ limit: 100, page: 1 });
      setOrders(res?.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    getPortalLedgerSummaryApi().then(setKhata).catch(() => setKhata(null));
  }, []);

  const shopsInOrders = useMemo(() => {
    const map = new Map<number, string>();
    for (const o of orders) {
      if (o.shop?.id && o.shop?.name) map.set(o.shop.id, o.shop.name);
    }
    return Array.from(map.entries());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (selectedShopId === "all") return orders;
    return orders.filter((o) => o.shop_id === selectedShopId || o.shop?.id === selectedShopId);
  }, [orders, selectedShopId]);

  const active = useMemo(() => filteredOrders.filter((o) => isActive(o.status)), [filteredOrders]);
  const past = useMemo(() => filteredOrders.filter((o) => !isActive(o.status)), [filteredOrders]);
  const list = tab === "active" ? active : past;
  const balance = Number(khata?.currentOutstanding ?? customer?.currentBalance ?? 0);

  async function cancel(o: any) {
    if (!window.confirm(`Cancel order ${o.order_number}?`)) return;
    setBusy(`cancel-${o.id}`);
    setNotice(null);
    try {
      await cancelPortalOrderApi(o.id);
      setNotice({ ok: true, text: `Order ${o.order_number} cancelled.` });
      await load();
    } catch (err: any) {
      setNotice({ ok: false, text: err?.response?.data?.message || "Could not cancel this order." });
    } finally {
      setBusy(null);
    }
  }

  async function reorder(o: any) {
    const items = (o.items || []).filter((i: any) => i.product_id);
    if (!items.length) return setNotice({ ok: false, text: "These items are no longer available to reorder." });
    setBusy(`reorder-${o.id}`);
    setNotice(null);
    let latest = cart;
    const failed: string[] = [];
    for (const it of items) {
      const already = latest?.items?.find((c) => c.productId === it.product_id)?.quantity ?? 0;
      try {
        latest = await setCartItemApi(it.product_id, already + Number(it.quantity || 1));
      } catch {
        failed.push(it.product_name);
      }
    }
    if (latest) setCart(latest);
    setBusy(null);
    if (failed.length === items.length) setNotice({ ok: false, text: "None of these items could be added (out of stock or unavailable)." });
    else navigate("/portal/cart");
  }

  return (
    <div className="space-y-6">
      <nav className="text-[13px] text-slate-500 flex items-center gap-1.5">
        <Link to="/portal/home" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <span>My account</span>
        <span>/</span>
        <span className="text-navy-900 font-medium">Orders</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h1 className="page-title">My orders</h1>
            <Link to="/portal/catalog" className="btn-secondary btn-sm">Continue shopping</Link>
          </div>

          {/* Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100">
            {([
              ["active", `Active (${active.length})`],
              ["past", `Past (${past.length})`],
              ["khata", "Khata"],
            ] as [Tab, string][]).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition ${tab === k ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {shopsInOrders.length > 1 && tab !== "khata" && (
            <div className="flex flex-wrap gap-1.5 items-center pt-1">
              <span className="text-[12px] text-slate-500 font-medium mr-1">Shop:</span>
              <button
                type="button"
                onClick={() => setSelectedShopId("all")}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold transition ${selectedShopId === "all" ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                All shops
              </button>
              {shopsInOrders.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedShopId(id)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold transition ${selectedShopId === id ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {notice && (
            <div className={`rounded-xl px-4 py-3 text-[13px] ${notice.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>{notice.text}</div>
          )}

          {tab === "khata" ? (
            <KhataPanel khata={khata} balance={balance} />
          ) : loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="card h-36 animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-[15px] font-semibold text-navy-900">{tab === "active" ? "No active orders" : "No past orders yet"}</div>
              <p className="text-[13px] text-slate-500 mt-1">{tab === "active" ? "Orders you place show up here until they're delivered." : "Delivered and cancelled orders appear here."}</p>
              <Link to="/portal/catalog" className="btn-primary mt-5">Start shopping</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((o) => {
                const cancelled = String(o.status).toLowerCase() === "cancelled";
                const idx = stepIndex(o.status);
                const itemsCount = (o.items || []).reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
                const billId = o.converted_sale_id || o.billed_bill_id;
                return (
                  <li key={o.id} className="card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link to={`/portal/orders/${o.id}`} className="text-[15px] font-semibold text-navy-900 hover:text-brand-700">
                          Order #{String(o.order_number || o.id).replace(/^#/, "")}
                        </Link>
                        <div className="text-[12.5px] text-slate-500 mt-0.5">
                          {o.shop?.name || customer?.shop?.name || "Shop"} · {new Date(o.order_date || o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <span className={cancelled ? "badge-danger" : DONE.includes(String(o.status).toLowerCase()) ? "badge-active" : "badge-brand"}>{statusLabel(o.status)}</span>
                    </div>

                    {/* Progress tracker */}
                    {cancelled ? (
                      <div className="mt-4 text-[12.5px] text-rose-600 font-medium">This order was cancelled.</div>
                    ) : (
                      <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Order progress">
                        {STEPS.map((st, i) => {
                          const done = i <= idx;
                          return (
                            <li key={st.key} className="flex flex-col items-center text-center">
                              <div className="flex items-center w-full">
                                <span className={`h-[3px] flex-1 rounded ${i === 0 ? "invisible" : done ? "bg-brand-600" : "bg-slate-200"}`} />
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${done ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"} ${i === idx ? "ring-4 ring-brand-100" : ""}`}>
                                  {done ? "✓" : i + 1}
                                </span>
                                <span className={`h-[3px] flex-1 rounded ${i === STEPS.length - 1 ? "invisible" : i < idx ? "bg-brand-600" : "bg-slate-200"}`} />
                              </div>
                              <span className={`mt-1.5 text-[10.5px] sm:text-[11.5px] leading-tight ${done ? "text-navy-900 font-semibold" : "text-slate-400"}`}>{st.label}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[13px] text-slate-600">
                        {itemsCount} item{itemsCount === 1 ? "" : "s"} · <span className="font-bold text-navy-900 tabular">{inr(o.total_amount)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {billId ? (
                          <Link to={`/portal/bills/${billId}`} className="btn-secondary btn-sm">View / download bill</Link>
                        ) : null}
                        {String(o.status).toLowerCase() === "pending" && (
                          <button type="button" disabled={busy !== null} onClick={() => cancel(o)} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">
                            {busy === `cancel-${o.id}` ? "Cancelling…" : "Cancel"}
                          </button>
                        )}
                        <button type="button" disabled={busy !== null} onClick={() => reorder(o)} className="btn-soft btn-sm">
                          {busy === `reorder-${o.id}` ? "Adding…" : "Reorder"}
                        </button>
                        <Link to={`/portal/orders/${o.id}`} className="btn-ghost btn-sm">Details →</Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Side panel: khata + account */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          <div className="hero-brand p-5">
            <div className="relative">
              <div className="text-[12px] text-brand-100/80">Khata balance with {customer?.shop?.name || "the shop"}</div>
              <div className="mt-1.5 text-[28px] font-bold tabular">{inr(Math.abs(balance))}</div>
              <div className="text-[12px] text-brand-100/70 mt-0.5">{balance > 0 ? "Due to the shop" : balance < 0 ? "Advance with the shop" : "All settled"}</div>
              <Link to="/portal/ledger" className="mt-4 inline-flex px-4 py-2 rounded-xl bg-white text-navy-900 text-[13px] font-semibold hover:bg-brand-50">
                View statement →
              </Link>
            </div>
          </div>
          <nav className="card divide-y divide-slate-100 overflow-hidden">
            {[
              ["My account", "/portal/profile"],
              ["Bills & invoices", "/portal/bills"],
              ["Notifications", "/portal/notifications"],
            ].map(([l, to]) => (
              <Link key={to} to={to} className="flex items-center justify-between px-4 py-3 text-[13.5px] text-slate-700 hover:bg-slate-50 hover:text-brand-700">
                {l} <span className="text-slate-300">›</span>
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function KhataPanel({ khata, balance }: { khata: any; balance: number }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-[11.5px] text-slate-500">{balance < 0 ? "Advance" : "Outstanding"}</div>
          <div className={`text-[20px] font-bold tabular mt-1 ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{inr(Math.abs(balance))}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-[11.5px] text-slate-500">Last payment</div>
          <div className="text-[16px] font-bold text-navy-900 tabular mt-1">{khata?.lastPaymentAmount ? inr(khata.lastPaymentAmount) : "—"}</div>
          {khata?.lastPaymentDate && <div className="text-[11.5px] text-slate-400">{new Date(khata.lastPaymentDate).toLocaleDateString("en-IN")}</div>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-[11.5px] text-slate-500">Last bill</div>
          <div className="text-[16px] font-bold text-navy-900 tabular mt-1">{khata?.lastBillAmount ? inr(khata.lastBillAmount) : "—"}</div>
          {khata?.lastBillNumber && <div className="text-[11.5px] text-slate-400 font-mono">{khata.lastBillNumber}</div>}
        </div>
      </div>
      <p className="text-[12.5px] text-slate-500">Payments are recorded by the shop. Pay at the counter or by UPI to the shop, and it will show here.</p>
      <Link to="/portal/ledger" className="btn-primary">Open full statement</Link>
    </div>
  );
}
