import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getCustomerOutstandingReport } from "../api/reports";
import { listSales } from "../api/sales";
import { listPurchases } from "../api/purchases";
import { listProducts } from "../api/products";
import { getOrders, updateOrderStatus, type OrderRecord } from "../api/orders";
import { apiErrorMessage } from "../api/client";
import ReferenceLink from "../components/ReferenceLink";
import ProductItemIcon from "../components/ProductItemIcon";

/* ───────────────────────── period helpers ───────────────────────── */

type Period = "today" | "week" | "month" | "all";
const PERIOD_LABEL: Record<Period, string> = { today: "Today", week: "Last 7 days", month: "Last 30 days", all: "All time" };

interface Range {
  from?: Date;
  to?: Date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function rangesFor(period: Period): { cur: Range; prev: Range | null } {
  if (period === "all") return { cur: {}, prev: null };
  const today = startOfDay(new Date());
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const from = addDays(today, -(days - 1));
  const to = new Date(); // now
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = addDays(from, -days);
  return { cur: { from, to }, prev: { from: prevFrom, to: prevTo } };
}

/** Chart window: daily bars for short periods, monthly for "all time". */
function chartWindow(period: Period): { range: Range; buckets: { key: string; label: string }[]; monthly: boolean } {
  const today = startOfDay(new Date());
  if (period === "all") {
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }) };
    });
    return { range: { from: new Date(today.getFullYear(), today.getMonth() - 11, 1), to: new Date() }, buckets, monthly: true };
  }
  const days = period === "month" ? 30 : 7; // "Today" still shows the last week so there is a trend to read
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = addDays(today, -(days - 1 - i));
    return {
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: days === 7 ? d.toLocaleDateString("en-IN", { weekday: "short" }) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    };
  });
  return { range: { from: addDays(today, -(days - 1)), to: new Date() }, buckets, monthly: false };
}

const iso = (d?: Date) => (d ? d.toISOString() : undefined);
const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const saleValue = (s: any) => (s.status === "cancelled" ? 0 : Number(s.total_amount) || 0);
const purchaseValue = (p: any) => (p.status === "cancelled" ? 0 : (Number(p.total_amount) || 0) - (Number(p.returned_amount) || 0));
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((a, r) => a + f(r), 0);

/* ───────────────────────── order workflow (board 7, note 4) ───────────────────────── */

// Wireframe stages mapped onto the existing order statuses — no backend change.
const STAGE: Record<string, { label: string; tone: string; next?: { status: string; action: string } }> = {
  pending: { label: "New", tone: "badge-brand", next: { status: "confirmed", action: "Accept" } },
  confirmed: { label: "Accepted", tone: "badge-warn", next: { status: "processing", action: "Pack" } },
  processing: { label: "Packed", tone: "badge-warn", next: { status: "shipped", action: "Dispatch" } },
  shipped: { label: "Out for delivery", tone: "badge-brand", next: { status: "delivered", action: "Mark delivered" } },
  delivered: { label: "Delivered", tone: "badge-active" },
  completed: { label: "Completed", tone: "badge-active" },
  converted_to_bill: { label: "Billed", tone: "badge-active" },
  billed: { label: "Billed", tone: "badge-active" },
  cancelled: { label: "Cancelled", tone: "badge-inactive" },
};
const stageOf = (status: string) => STAGE[status] || STAGE[String(status).toLowerCase()] || { label: status, tone: "badge-inactive" };

/* ───────────────────────── page ───────────────────────── */

export default function Dashboard() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);

  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ sales: 0, prevSales: 0, orders: 0, prevOrders: 0, purchases: 0, prevPurchases: 0 });
  const [hasPrev, setHasPrev] = useState(true);
  const [chartSales, setChartSales] = useState<any[]>([]);
  const [chartPurchases, setChartPurchases] = useState<any[]>([]);
  const [dues, setDues] = useState<{ total: number; top: { id?: number; name: string; amount: number }[]; denied: boolean }>({ total: 0, top: [], denied: false });
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const chart = useMemo(() => chartWindow(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const { cur, prev } = rangesFor(period);
    const empty = { data: { data: [] as any[] } };
    const salesQ = (r: Range) => listSales({ from: iso(r.from), to: iso(r.to), limit: 1000 } as any).catch(() => empty);
    const purchQ = (r: Range) => listPurchases({ from: iso(r.from), to: iso(r.to), limit: 500 }).catch(() => empty);
    const ordersQ = (r: Range) => getOrders({ startDate: iso(r.from), endDate: iso(r.to) }).catch(() => empty);

    const [s, ps, p, pp, o, po, cs, cp, out, prod, allOrders] = await Promise.all([
      salesQ(cur),
      prev ? salesQ(prev) : Promise.resolve(empty),
      purchQ(cur),
      prev ? purchQ(prev) : Promise.resolve(empty),
      ordersQ(cur),
      prev ? ordersQ(prev) : Promise.resolve(empty),
      salesQ(chart.range),
      purchQ(chart.range),
      getCustomerOutstandingReport().catch((e) => ({ denied: e?.response?.status === 403 }) as any),
      listProducts().catch(() => empty),
      getOrders().catch(() => empty),
    ]);

    const arr = (r: any) => (Array.isArray(r?.data?.data) ? r.data.data : []);
    setKpi({
      sales: sum(arr(s), saleValue),
      prevSales: sum(arr(ps), saleValue),
      orders: arr(o).length,
      prevOrders: arr(po).length,
      purchases: sum(arr(p), purchaseValue),
      prevPurchases: sum(arr(pp), purchaseValue),
    });
    setHasPrev(Boolean(prev));
    setChartSales(arr(cs));
    setChartPurchases(arr(cp));

    if ((out as any)?.denied) {
      setDues({ total: 0, top: [], denied: true });
    } else {
      const data = (out as any)?.data?.data || {};
      const list = (data.customers || [])
        .map((c: any) => ({ id: c.id ?? c.customer?.id, name: c.name ?? c.customer?.name ?? "Customer", amount: Number(c.current_balance ?? c.balance ?? 0) }))
        .filter((c: any) => c.amount > 0)
        .sort((a: any, b: any) => b.amount - a.amount);
      setDues({ total: Number(data.summary?.totalReceivable ?? 0), top: list.slice(0, 5), denied: false });
    }
    setProducts(arr(prod));
    setOrders(arr(allOrders));
    setLoading(false);
  }, [period, chart.range]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, period]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Chart series (real records bucketed by day / month)
  const series = useMemo(() => {
    const keyOf = (d: Date) => (chart.monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    const bucket = (rows: any[], dateField: string, val: (r: any) => number) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const raw = r[dateField] || r.created_at || r.createdAt;
        if (!raw) continue;
        const k = keyOf(new Date(raw));
        m.set(k, (m.get(k) || 0) + val(r));
      }
      return m;
    };
    const sm = bucket(chartSales, "invoice_date", saleValue);
    const pm = bucket(chartPurchases, "purchase_date", purchaseValue);
    return chart.buckets.map((b) => ({ label: b.label, sales: sm.get(b.key) || 0, purchases: pm.get(b.key) || 0 }));
  }, [chartSales, chartPurchases, chart]);

  const lowStock = useMemo(
    () =>
      products
        .map((p) => ({ p, stock: Number(p.stocks?.[0]?.current_stock ?? 0), min: Number(p.min_stock ?? 5) }))
        .filter((x) => x.stock <= x.min)
        .sort((a, b) => a.stock - b.stock),
    [products]
  );

  const recentOrders = useMemo(() => {
    const open = orders.filter((o) => stageOf(o.status).next);
    const rest = orders.filter((o) => !stageOf(o.status).next);
    return [...open, ...rest].slice(0, 6);
  }, [orders]);

  async function advance(o: OrderRecord) {
    const next = stageOf(o.status).next;
    if (!next) return;
    setBusyOrder(o.id);
    try {
      await updateOrderStatus(o.id, { status: next.status });
      setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: next.status } : x)));
      setToast({ ok: true, text: `Order ${o.order_number} → ${stageOf(next.status).label}` });
    } catch (err) {
      setToast({ ok: false, text: apiErrorMessage(err, "Could not update the order") });
    } finally {
      setBusyOrder(null);
    }
  }

  const name = (owner?.name || employee?.name || "").split(" ")[0];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="section-label">{activeShop?.name || "Your business"}</div>
          <h1 className="page-title mt-1">Dashboard{name ? ` · Hi ${name}` : ""}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-2 pr-8 font-medium" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
            ))}
          </select>
          <Link to="/app/products" className="btn-secondary">
            <Plus /> Add product
          </Link>
          <Link to="/app/purchase" className="btn-navy">
            <Plus /> New purchase
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Sales" value={inr(kpi.sales)} cur={kpi.sales} prev={kpi.prevSales} hasPrev={hasPrev} loading={loading} to="/app/sales" />
        <Kpi label="Orders" value={kpi.orders.toLocaleString("en-IN")} cur={kpi.orders} prev={kpi.prevOrders} hasPrev={hasPrev} loading={loading} to="/app/orders" />
        <Kpi label="Purchases" value={inr(kpi.purchases)} cur={kpi.purchases} prev={kpi.prevPurchases} hasPrev={hasPrev} loading={loading} to="/app/purchase" />
        <Kpi
          label="Outstanding dues"
          value={dues.denied ? "—" : inr(dues.total)}
          hint={dues.denied ? "No permission" : "Customers owe you"}
          loading={loading}
          to="/app/ledger"
          tone="due"
        />
      </div>

      {/* Sales trend + Low stock */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="card xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <Num n={2} />
              <h2 className="card-title">Sales trend</h2>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600" /> Sales</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300" /> Purchases</span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <BarChart data={series} loading={loading} />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-slate-500">
              <span>Sales <b className="text-navy-900 tabular">{inr(sum(series, (x) => x.sales))}</b></span>
              <span>Purchases <b className="text-navy-900 tabular">{inr(sum(series, (x) => x.purchases))}</b></span>
              <span>
                Difference{" "}
                <b className={`tabular ${sum(series, (x) => x.sales - x.purchases) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {inr(sum(series, (x) => x.sales - x.purchases))}
                </b>
              </span>
              <span className="text-slate-400">{chart.monthly ? "Last 12 months" : `Last ${series.length} days`}</span>
            </div>
          </div>
        </section>

        <section className="card xl:col-span-4 flex flex-col">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <Num n={3} />
              <h2 className="card-title">Low stock alerts</h2>
              {lowStock.length > 0 && <span className="badge-danger">{lowStock.length}</span>}
            </div>
            <Link to="/app/inventory" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">Inventory →</Link>
          </div>
          {lowStock.length === 0 ? (
            <Empty text={loading ? "Loading…" : "All products are above their reorder level."} ok={!loading} />
          ) : (
            <ul className="divide-y divide-slate-100 flex-1">
              {lowStock.slice(0, 5).map(({ p, stock }) => (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <ProductItemIcon name={p.name} category={p.category?.name} imageUrl={p.images?.[0]?.url} size="sm" />
                  <ReferenceLink type="product" refNumber={p.name} className="!font-sans flex-1 min-w-0 truncate text-[13px] font-medium text-navy-900 hover:text-brand-600">
                    {p.name}
                  </ReferenceLink>
                  <span className={`badge ring-1 ring-inset ${stock <= 0 ? "bg-rose-50 text-rose-700 ring-rose-600/15" : "bg-white text-slate-700 ring-slate-300"}`}>
                    {stock <= 0 ? "Out" : `${stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="p-4 pt-2">
            <Link to="/app/purchase" className="btn-secondary w-full">Reorder · record a purchase</Link>
          </div>
        </section>
      </div>

      {/* Recent orders */}
      <section className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2.5">
            <Num n={4} />
            <h2 className="card-title">Recent orders</h2>
          </div>
          <Link to="/app/orders" className="btn-secondary btn-sm">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <Empty text={loading ? "Loading…" : "No orders yet. Orders from your online store appear here."} />
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="!text-right">Amount</th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const st = stageOf(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="font-mono font-medium whitespace-nowrap">
                        <Link to="/app/orders" className="text-brand-700 hover:underline">#{String(o.order_number || o.id).replace(/^#/, "")}</Link>
                      </td>
                      <td className="max-w-[180px] truncate text-slate-800">{o.customer?.name || "Customer"}</td>
                      <td className="text-slate-500 whitespace-nowrap">{new Date(o.order_date || o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                      <td><span className={st.tone}>{st.label}</span></td>
                      <td className="text-right font-semibold text-navy-900 whitespace-nowrap">{inr(Number(o.total_amount))}</td>
                      <td className="text-right whitespace-nowrap">
                        {st.next ? (
                          <button type="button" disabled={busyOrder === o.id} onClick={() => advance(o)} className="btn-secondary btn-sm min-w-[118px]">
                            {busyOrder === o.id ? "Saving…" : st.next.action}
                          </button>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top dues + Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <Num n={5} />
              <h2 className="card-title">Top customers & dues</h2>
            </div>
            <Link to="/app/ledger" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">Ledger →</Link>
          </div>
          {dues.denied ? (
            <Empty text="You don't have permission to see customer balances." />
          ) : dues.top.length === 0 ? (
            <Empty text={loading ? "Loading…" : "No customer has an outstanding balance."} ok={!loading} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dues.top.map((c) => (
                <li key={`${c.id}-${c.name}`} className="px-5 py-3 flex items-center justify-between gap-3">
                  {c.id ? (
                    <Link to={`/app/ledger?customerId=${c.id}`} className="text-[13.5px] text-navy-900 hover:text-brand-700 truncate">{c.name}</Link>
                  ) : (
                    <span className="text-[13.5px] text-navy-900 truncate">{c.name}</span>
                  )}
                  <span className="text-[13.5px] font-semibold text-rose-600 tabular whitespace-nowrap">Due {inr(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <Num n={6} />
              <h2 className="card-title">Reports</h2>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["Sales report", "sales"],
                ["Purchase report", "purchases"],
                ["Stock valuation", "inventory"],
                ["Gross profit", "profit"],
                ["Customer ledger", "outstanding"],
              ].map(([label, tab]) => (
                <Link key={tab} to={`/app/reports?tab=${tab}`} className="px-3 py-1.5 rounded-full border border-border text-[12.5px] font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition">
                  {label}
                </Link>
              ))}
            </div>
            <Link to="/app/reports" className="btn-secondary w-full">Open reports · export CSV / PDF</Link>
          </div>
        </section>
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lift text-[13px] font-medium animate-fade-in ${toast.ok ? "bg-navy-900 text-white" : "bg-rose-600 text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── components ───────────────────────── */

function Plus() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  );
}

function Num({ n }: { n: number }) {
  return <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11.5px] font-bold flex items-center justify-center shrink-0">{n}</span>;
}

function Empty({ text, ok = false }: { text: string; ok?: boolean }) {
  return (
    <div className="px-5 py-10 text-center text-[13px] text-slate-500 flex flex-col items-center gap-2">
      {ok && (
        <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
      )}
      {text}
    </div>
  );
}

function Kpi({
  label, value, cur, prev, hasPrev, loading, to, hint, tone,
}: { label: string; value: string; cur?: number; prev?: number; hasPrev?: boolean; loading: boolean; to: string; hint?: string; tone?: "due" }) {
  let delta: ReactNode = hint ? <span className="text-slate-400">{hint}</span> : null;
  if (cur !== undefined && prev !== undefined) {
    if (!hasPrev) delta = <span className="text-slate-400">All time</span>;
    else if (prev === 0) delta = <span className="text-slate-400">vs previous period: {cur === 0 ? "no change" : "new"}</span>;
    else {
      const pct = Math.round(((cur - prev) / prev) * 100);
      delta = (
        <span className={pct >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% <span className="text-slate-400 font-normal">vs previous period</span>
        </span>
      );
    }
  }
  return (
    <Link to={to} className="card card-hover p-4 sm:p-5 block">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className={`mt-2 text-[22px] sm:text-[26px] font-bold tracking-tight tabular truncate ${tone === "due" ? "text-rose-600" : "text-navy-900"} ${loading ? "opacity-40 animate-pulse" : ""}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] font-medium truncate">{delta}</div>
    </Link>
  );
}

/** Grouped bar chart (sales vs purchases) — plain SVG, no chart library. */
function BarChart({ data, loading }: { data: { label: string; sales: number; purchases: number }[]; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.sales, d.purchases)));
  const H = 200;
  const n = data.length;
  const showEvery = n > 14 ? Math.ceil(n / 10) : 1;
  const nice = (v: number) => {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / p) * p;
  };
  const top = nice(max);
  const ticks = [0, top / 2, top];

  if (!loading && data.every((d) => d.sales === 0 && d.purchases === 0)) {
    return <div className="h-[230px] rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[13px] text-slate-500">No sales or purchases in this window yet.</div>;
  }

  return (
    <div className={`relative ${loading ? "opacity-40 animate-pulse" : ""}`}>
      <div className="flex">
        <div className="flex flex-col justify-between h-[200px] pr-2 text-[10.5px] text-slate-400 tabular text-right w-14 shrink-0">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t >= 100000 ? `₹${(t / 100000).toFixed(t % 100000 ? 1 : 0)}L` : t >= 1000 ? `₹${Math.round(t / 1000)}k` : `₹${Math.round(t)}`}</span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-[200px] border-b border-slate-200">
            {ticks.slice(1).map((t) => (
              <div key={t} className="absolute left-0 right-0 border-t border-dashed border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
              {data.map((d, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full flex items-end justify-center gap-[2px] rounded-t ${hover === i ? "bg-brand-50/60" : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="w-1/2 max-w-[14px] bg-brand-600 rounded-t-[3px] transition-all duration-500" style={{ height: `${(d.sales / top) * H}px` }} />
                  <div className="w-1/2 max-w-[14px] bg-amber-300 rounded-t-[3px] transition-all duration-500" style={{ height: `${(d.purchases / top) * H}px` }} />
                </div>
              ))}
            </div>
            {hover !== null && (
              <div
                className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg bg-navy-900 text-white text-[11.5px] shadow-lift whitespace-nowrap pointer-events-none"
                style={{ left: `${((hover + 0.5) / n) * 100}%` }}
              >
                <div className="font-semibold">{data[hover].label}</div>
                <div>Sales {inr(data[hover].sales)}</div>
                <div>Purchases {inr(data[hover].purchases)}</div>
              </div>
            )}
          </div>
          <div className="flex mt-1.5">
            {data.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[10.5px] text-slate-400 truncate">{i % showEvery === 0 ? d.label : ""}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
