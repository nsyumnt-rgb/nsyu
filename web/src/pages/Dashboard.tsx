import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Avatar, DeltaPill, EmptyState, Icon, Meter, Segmented, StatCard, TONE, Toast } from "../components/ui";

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
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
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

  const [period, setPeriod] = useState<Period>("month");
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
    const salesQ = (r: Range) => listSales({ from: iso(r.from), to: iso(r.to), limit: 1000, allShops: true } as any).catch(() => empty);
    const purchQ = (r: Range) => listPurchases({ from: iso(r.from), to: iso(r.to), limit: 500, allShops: true } as any).catch(() => empty);
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
      listProducts({ shopId: shopId || undefined } as any).catch(() => empty),
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
        .map((p) => {
          const match = shopId ? p.stocks?.find((s: any) => s.shop_id === shopId) : null;
          const stock = Number(match?.current_stock ?? p.stocks?.[0]?.current_stock ?? 0);
          return { p, stock, min: Number(p.min_stock ?? 5) };
        })
        .filter((x) => x.stock <= x.min)
        .sort((a, b) => a.stock - b.stock),
    [products, shopId]
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
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const totals = {
    sales: sum(series, (x) => x.sales),
    purchases: sum(series, (x) => x.purchases),
  };
  const net = totals.sales - totals.purchases;
  const openOrders = orders.filter((o) => stageOf(o.status).next).length;
  const outCount = lowStock.filter((x) => x.stock <= 0).length;
  const maxDue = Math.max(1, ...dues.top.map((d) => d.amount));

  return (
    <div className="space-y-6 pb-10">
      {/* Hero */}
      <section className="hero-brand p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-24 w-72 h-72 rounded-full border-[28px] border-white/5" />
        <div aria-hidden className="pointer-events-none absolute right-24 -top-20 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-inset ring-white/15 px-3 py-1 text-[11.5px] font-semibold text-emerald-50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              {activeShop?.name || "Your business"}
            </div>
            <h1 className="mt-3 text-[24px] sm:text-[30px] font-bold tracking-tight text-white leading-tight">
              {greet}{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1 text-[13.5px] text-emerald-50/80">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}
              {openOrders > 0 ? `${openOrders} order${openOrders > 1 ? "s" : ""} waiting for you` : "No orders waiting"}
              {lowStock.length > 0 && ` · ${lowStock.length} item${lowStock.length > 1 ? "s" : ""} low on stock`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/app/billing" className="btn bg-white text-navy-900 hover:bg-emerald-50 shadow-sm">
                <Icon name="receipt" /> New bill
              </Link>
              <Link to="/app/products" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">
                <Icon name="plus" /> Add product
              </Link>
              <Link to="/app/purchase" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">
                <Icon name="truck" /> New purchase
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[420px]">
            <HeroFigure label="Sales" value={inr(totals.sales)} loading={loading} />
            <HeroFigure label="Purchases" value={inr(totals.purchases)} loading={loading} />
            <HeroFigure label="Net" value={inr(net)} loading={loading} accent={net >= 0 ? "text-emerald-200" : "text-rose-200"} />
            <div className="col-span-3 text-[11px] text-emerald-50/60 text-right">{chart.monthly ? "Last 12 months" : `Last ${series.length} days`}</div>
          </div>
        </div>
      </section>

      {/* Period + KPIs */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-navy-900">Overview</h2>
          <Segmented
            size="sm"
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ key: p, label: PERIOD_LABEL[p] }))}
          />
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Sales" icon="trend" tone="brand" value={inr(kpi.sales)} loading={loading} to="/app/sales" hint={<DeltaPill cur={kpi.sales} prev={kpi.prevSales} hasPrev={hasPrev} />} />
          <StatCard label="Orders" icon="cart" tone="sky" value={kpi.orders.toLocaleString("en-IN")} loading={loading} to="/app/orders" hint={<DeltaPill cur={kpi.orders} prev={kpi.prevOrders} hasPrev={hasPrev} />} />
          <StatCard label="Purchases" icon="truck" tone="violet" value={inr(kpi.purchases)} loading={loading} to="/app/purchase" hint={<DeltaPill cur={kpi.purchases} prev={kpi.prevPurchases} hasPrev={hasPrev} />} />
          <StatCard
            label="Outstanding dues"
            icon="wallet"
            tone="rose"
            value={dues.denied ? "—" : inr(dues.total)}
            valueClass={dues.denied ? "text-slate-400" : "text-rose-600"}
            loading={loading}
            to="/app/ledger"
            hint={dues.denied ? "No permission" : `${dues.top.length ? `${dues.top.length}+ customers` : "Nobody"} owe you`}
          />
        </div>
      </div>

      {/* Sales trend + Low stock */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="card xl:col-span-8">
          <div className="card-header flex-wrap">
            <div>
              <h2 className="card-title text-[14.5px]">Sales vs purchases</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{chart.monthly ? "Monthly, last 12 months" : `Daily, last ${series.length} days`}</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-600" /> Sales</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /> Purchases</span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <BarChart data={series} loading={loading} />
          </div>
        </section>

        <section className="card xl:col-span-4 flex flex-col">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <h2 className="card-title text-[14.5px]">Low stock</h2>
              {lowStock.length > 0 && <span className="badge-danger">{lowStock.length}</span>}
              {outCount > 0 && <span className="text-[11.5px] text-slate-400">{outCount} out</span>}
            </div>
            <Link to="/app/inventory?tab=low" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              Inventory <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            loading ? <Skeleton rows={4} /> : <EmptyState compact icon="checkCircle" tone="emerald" title="Stock looks healthy" text="Every product is above its reorder level." />
          ) : (
            <ul className="divide-y divide-slate-100 flex-1">
              {lowStock.slice(0, 5).map(({ p, stock, min }) => (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <ProductItemIcon name={p.name} category={p.category?.name} imageUrl={p.images?.[0]?.url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <ReferenceLink type="product" refNumber={p.name} className="!font-sans block truncate text-[13px] font-medium text-navy-900 hover:text-brand-600">
                      {p.name}
                    </ReferenceLink>
                    <Meter value={stock} max={Math.max(min * 2, 1)} tone={stock <= 0 ? "rose" : "amber"} className="mt-1.5" />
                  </div>
                  <span className={`text-[12px] font-bold tabular whitespace-nowrap ${stock <= 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {stock <= 0 ? "Out" : `${stock} / ${min}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="p-4 pt-2 mt-auto">
            <Link to="/app/purchase" className="btn-soft w-full">
              <Icon name="truck" /> Reorder stock
            </Link>
          </div>
        </section>
      </div>

      {/* Recent orders */}
      <section className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title text-[14.5px]">Recent orders</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Open orders first — move each one forward in one click.</p>
          </div>
          <Link to="/app/orders" className="btn-secondary btn-sm">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          loading ? <Skeleton rows={4} /> : <EmptyState icon="cart" title="No orders yet" text="Orders from your online store will appear here." />
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
                  <th className="!text-right">Next step</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const st = stageOf(o.status);
                  const cname = o.customer?.name || "Customer";
                  return (
                    <tr key={o.id}>
                      <td className="font-mono font-semibold whitespace-nowrap">
                        <Link to="/app/orders" className="text-brand-700 hover:underline">#{String(o.order_number || o.id).replace(/^#/, "")}</Link>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5 max-w-[220px]">
                          <Avatar name={cname} size="sm" />
                          <span className="truncate text-navy-900 font-medium">{cname}</span>
                        </div>
                      </td>
                      <td className="text-slate-500 whitespace-nowrap">{new Date(o.order_date || o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td><span className={st.tone}>{st.label}</span></td>
                      <td className="text-right font-semibold text-navy-900 whitespace-nowrap tabular">{inr(Number(o.total_amount))}</td>
                      <td className="text-right whitespace-nowrap">
                        {st.next ? (
                          <button type="button" disabled={busyOrder === o.id} onClick={() => advance(o)} className="btn-soft btn-sm min-w-[118px]">
                            {busyOrder === o.id ? "Saving…" : <>{st.next.action} <Icon name="arrowRight" className="w-3.5 h-3.5" /></>}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12px] text-emerald-600 font-medium"><Icon name="check" className="w-3.5 h-3.5" /> Done</span>
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
            <h2 className="card-title text-[14.5px]">Top customer dues</h2>
            <Link to="/app/ledger" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              Ledger <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          </div>
          {dues.denied ? (
            <EmptyState compact icon="ban" title="No access" text="You don't have permission to see customer balances." />
          ) : dues.top.length === 0 ? (
            loading ? <Skeleton rows={4} /> : <EmptyState compact icon="checkCircle" tone="emerald" title="All settled" text="No customer has an outstanding balance." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dues.top.map((c) => (
                <li key={`${c.id}-${c.name}`} className="px-5 py-3 flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    {c.id ? (
                      <Link to={`/app/ledger?customerId=${c.id}`} className="block text-[13.5px] font-medium text-navy-900 hover:text-brand-700 truncate">{c.name}</Link>
                    ) : (
                      <span className="block text-[13.5px] font-medium text-navy-900 truncate">{c.name}</span>
                    )}
                    <Meter value={c.amount} max={maxDue} tone="rose" className="mt-1.5" />
                  </div>
                  <span className="text-[13.5px] font-bold text-rose-600 tabular whitespace-nowrap">{inr(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title text-[14.5px]">Reports</h2>
            <Link to="/app/reports" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              All reports <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
            {(
              [
                ["Sales report", "sales", "trend", "brand"],
                ["Purchase report", "purchases", "truck", "violet"],
                ["Stock valuation", "inventory", "layers", "sky"],
                ["Gross profit", "profit", "rupee", "emerald"],
                ["Customer ledger", "outstanding", "users", "amber"],
              ] as const
            ).map(([label, tab, icon, tone]) => (
              <Link
                key={tab}
                to={`/app/reports?tab=${tab}`}
                className="group flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 hover:border-brand-200 hover:bg-brand-50/40 transition"
              >
                <span className={`w-9 h-9 rounded-lg ring-1 ring-inset flex items-center justify-center shrink-0 ${TONE[tone].tile}`}>
                  <Icon name={icon} className="w-4 h-4" />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-navy-900">{label}</span>
                <Icon name="right" className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition" />
              </Link>
            ))}
            <Link to="/app/reports" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-[12.5px] font-semibold text-slate-500 hover:border-brand-300 hover:text-brand-700 transition">
              <Icon name="download" /> Export CSV / PDF
            </Link>
          </div>
        </section>
      </div>

      {toast && <Toast ok={toast.ok} text={toast.text} />}
    </div>
  );
}

/* ───────────────────────── components ───────────────────────── */

function HeroFigure({ label, value, loading, accent }: { label: string; value: string; loading: boolean; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] ring-1 ring-inset ring-white/10 px-3 py-3 sm:px-4 min-w-0">
      <div className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-50/70">{label}</div>
      <div className={`mt-1 text-[15px] sm:text-[19px] font-bold tabular truncate ${accent || "text-white"} ${loading ? "opacity-50 animate-pulse" : ""}`}>{value}</div>
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-slate-100 w-2/3" />
            <div className="h-2 rounded bg-slate-100 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grouped bar chart (sales vs purchases) — plain SVG-free CSS bars, no chart library. */
function BarChart({ data, loading }: { data: { label: string; sales: number; purchases: number }[]; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.sales, d.purchases)));
  const H = 220;
  const n = data.length;
  const showEvery = n > 14 ? Math.ceil(n / 10) : 1;
  const nice = (v: number) => {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / p) * p;
  };
  const top = nice(max);
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const fmt = (t: number) => (t >= 100000 ? `₹${(t / 100000).toFixed(t % 100000 ? 1 : 0)}L` : t >= 1000 ? `₹${Math.round(t / 1000)}k` : `₹${Math.round(t)}`);

  if (!loading && data.every((d) => d.sales === 0 && d.purchases === 0)) {
    return (
      <div className="h-[250px] rounded-xl bg-slate-50/70 border border-dashed border-slate-200">
        <EmptyState compact icon="trend" title="Nothing to chart yet" text="Sales and purchases in this window will show up here." />
      </div>
    );
  }

  return (
    <div className={`relative ${loading ? "opacity-40 animate-pulse" : ""}`}>
      <div className="flex">
        <div className="relative pr-2 text-[10.5px] text-slate-400 tabular text-right w-12 shrink-0" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative border-b border-slate-200" style={{ height: H }}>
            {ticks.slice(1).map((t) => (
              <div key={t} className="absolute left-0 right-0 border-t border-dashed border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
              {data.map((d, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full flex items-end justify-center gap-[2px] rounded-t-md transition-colors ${hover === i ? "bg-brand-50/70" : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="w-1/2 max-w-[16px] rounded-t-[4px] bg-gradient-to-t from-brand-700 to-brand-500 transition-all duration-500" style={{ height: `${(d.sales / top) * H}px` }} />
                  <div className="w-1/2 max-w-[16px] rounded-t-[4px] bg-gradient-to-t from-amber-400 to-amber-200 transition-all duration-500" style={{ height: `${(d.purchases / top) * H}px` }} />
                </div>
              ))}
            </div>
            {hover !== null && (
              <div
                className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg bg-navy-900 text-white text-[11.5px] shadow-lift whitespace-nowrap pointer-events-none"
                style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / n) * 100))}%` }}
              >
                <div className="font-semibold mb-0.5">{data[hover].label}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-400" /> Sales {inr(data[hover].sales)}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-300" /> Purchases {inr(data[hover].purchases)}</div>
              </div>
            )}
          </div>
          <div className="flex mt-2">
            {data.map((d, i) => (
              <div key={i} className={`flex-1 text-center text-[10.5px] truncate ${hover === i ? "text-navy-900 font-semibold" : "text-slate-400"}`}>{i % showEvery === 0 ? d.label : ""}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
