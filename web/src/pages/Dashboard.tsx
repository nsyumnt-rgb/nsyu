import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { listSales } from "../api/sales";
import { listOutstandingBalances } from "../api/ledger";
import { listProducts } from "../api/products";
import { getOrders, updateOrderStatus, type OrderRecord } from "../api/orders";
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
  const days = period === "month" ? 30 : 7;
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
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((a, r) => a + f(r), 0);

/* ───────────────────────── order workflow ───────────────────────── */

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

  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ sales: 0, prevSales: 0, orders: 0, prevOrders: 0, productsCount: 0 });
  const [hasPrev, setHasPrev] = useState(true);
  const [chartSales, setChartSales] = useState<any[]>([]);
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
    const ordersQ = (r: Range) => getOrders({ startDate: iso(r.from), endDate: iso(r.to) }).catch(() => empty);

    const [s, ps, o, po, cs, out, prod, allOrders] = await Promise.all([
      salesQ(cur),
      prev ? salesQ(prev) : Promise.resolve(empty),
      ordersQ(cur),
      prev ? ordersQ(prev) : Promise.resolve(empty),
      salesQ(chart.range),
      listOutstandingBalances().catch((e) => ({ denied: e?.response?.status === 403 }) as any),
      listProducts({ shopId: shopId || undefined } as any).catch(() => empty),
      getOrders().catch(() => empty),
    ]);

    const arr = (r: any) => (Array.isArray(r?.data?.data) ? r.data.data : []);
    setKpi({
      sales: sum(arr(s), saleValue),
      prevSales: sum(arr(ps), saleValue),
      orders: arr(o).length,
      prevOrders: arr(po).length,
      productsCount: arr(prod).length,
    });
    setHasPrev(Boolean(prev));
    setChartSales(arr(cs));

    if ((out as any)?.denied) {
      setDues({ total: 0, top: [], denied: true });
    } else {
      const custList = Array.isArray(out?.data?.data) ? out.data.data : [];
      const list = custList
        .map((c: any) => ({ id: c.id, name: c.name || "Customer", amount: Number(c.current_balance || 0) }))
        .filter((c: any) => c.amount > 0)
        .sort((a: any, b: any) => b.amount - a.amount);
      const totalRec = list.reduce((acc: number, c: any) => acc + c.amount, 0);
      setDues({ total: totalRec, top: list.slice(0, 5), denied: false });
    }
    setProducts(arr(prod));
    setOrders(arr(allOrders));
    setLoading(false);
  }, [period, chart.range, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const advanceOrder = async (order: OrderRecord) => {
    const next = stageOf(order.status).next;
    if (!next) return;
    setBusyOrder(order.id);
    try {
      await updateOrderStatus(order.id, { status: next.status });
      setToast({ ok: true, text: `Order #${order.order_number || order.id} marked ${next.status}.` });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next.status } : o)));
    } catch {
      setToast({ ok: false, text: "Could not update order status." });
    } finally {
      setBusyOrder(null);
    }
  };

  const name = owner?.name;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Bucket sales for chart
  const series = useMemo(() => {
    const bucket = (rows: any[], dateField: string, val: (r: any) => number) => {
      const map = new Map<string, number>();
      for (const r of rows) {
        const raw = r[dateField] || r.created_at;
        if (!raw) continue;
        const d = new Date(raw);
        const k = chart.monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        map.set(k, (map.get(k) || 0) + val(r));
      }
      return map;
    };
    const sm = bucket(chartSales, "sale_date", saleValue);
    return chart.buckets.map((b) => ({ label: b.label, sales: sm.get(b.key) || 0 }));
  }, [chartSales, chart]);

  // Low stock products
  const lowStock = useMemo(() => {
    return products
      .map((p) => {
        const s = (p.productStockEntries || [])[0];
        const stock = Number(s?.current_stock ?? p.current_stock ?? p.stock ?? 0);
        const min = Number(p.min_stock ?? 5);
        return { p, stock, min };
      })
      .filter((x) => x.stock <= x.min);
  }, [products]);

  const totals = {
    sales: sum(series, (x) => x.sales),
  };
  const openOrders = orders.filter((o) => stageOf(o.status).next).length;
  const outCount = lowStock.filter((x) => x.stock <= 0).length;
  const maxDue = Math.max(1, ...dues.top.map((d) => d.amount));

  return (
    <div className="space-y-6 pb-10">
      {/* Hero */}
      <section className="hero-brand p-5 sm:p-7 rounded-2xl relative overflow-hidden bg-gradient-to-r from-[#064E3B] to-[#047857] text-white shadow-sm">
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-inset ring-white/15 px-3 py-1 text-[11.5px] font-semibold text-emerald-50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              {activeShop?.name || "Your Store"}
            </div>
            <h1 className="mt-3 text-[24px] sm:text-[30px] font-bold tracking-tight text-white leading-tight">
              {greet}{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1 text-[13.5px] text-emerald-50/80">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}
              {openOrders > 0 ? `${openOrders} order${openOrders > 1 ? "s" : ""} waiting for processing` : "No pending orders"}
              {lowStock.length > 0 && ` · ${lowStock.length} item${lowStock.length > 1 ? "s" : ""} low stock`}
            </p>
            <div className="mt-5 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Link to="/app/billing" className="btn bg-white text-navy-900 hover:bg-emerald-50 shadow-sm font-bold text-center justify-center">
                <Icon name="receipt" /> New Bill (POS)
              </Link>
              <Link to="/app/products" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15 text-center justify-center">
                <Icon name="plus" /> Add Product
              </Link>
              <Link to="/app/customers" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15 text-center justify-center">
                <Icon name="users" /> Customers
              </Link>
              <Link to="/app/ledger" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15 text-center justify-center">
                <Icon name="wallet" /> Customer Ledger
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
            <HeroFigure label="Total Sales" value={inr(totals.sales)} loading={loading} />
            <HeroFigure label="Active Orders" value={String(orders.length)} loading={loading} />
            <div className="col-span-2 text-[11px] text-emerald-50/70 text-right">{chart.monthly ? "Last 12 months" : `Last ${series.length} days`}</div>
          </div>
        </div>
      </section>

      {/* Period + KPIs (2-Column Mobile App Grid) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-navy-900">Store Overview</h2>
          <Segmented
            size="sm"
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ key: p, label: PERIOD_LABEL[p] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Total Sales" icon="trend" tone="brand" value={inr(kpi.sales)} loading={loading} to="/app/sales" hint={<DeltaPill cur={kpi.sales} prev={kpi.prevSales} hasPrev={hasPrev} />} />
          <StatCard label="Orders" icon="cart" tone="sky" value={kpi.orders.toLocaleString("en-IN")} loading={loading} to="/app/orders" hint={<DeltaPill cur={kpi.orders} prev={kpi.prevOrders} hasPrev={hasPrev} />} />
          <StatCard label="Products" icon="layers" tone="violet" value={String(kpi.productsCount)} loading={loading} to="/app/products" hint="Total catalog" />
          <StatCard
            label="Khata Dues"
            icon="wallet"
            tone="rose"
            value={dues.denied ? "—" : inr(dues.total)}
            valueClass={dues.denied ? "text-slate-400" : "text-rose-600"}
            loading={loading}
            to="/app/ledger"
            hint={dues.denied ? "No permission" : `${dues.top.length ? `${dues.top.length} pending` : "Cleared"}`}
          />
        </div>
      </div>

      {/* Sales trend + Low stock */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="card xl:col-span-8 bg-white p-5 rounded-2xl border border-gray-200">
          <div className="card-header flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 className="card-title text-[14.5px] font-bold text-navy-950">Daily Sales Trend</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{chart.monthly ? "Monthly revenue" : `Daily revenue, last ${series.length} days`}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Real API Revenue
            </div>
          </div>
          <div className="pt-4">
            <BarChart data={series} loading={loading} />
          </div>
        </section>

        <section className="card xl:col-span-4 flex flex-col bg-white p-5 rounded-2xl border border-gray-200">
          <div className="card-header flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="card-title text-[14.5px] font-bold text-navy-950">Low Stock</h2>
              {lowStock.length > 0 && <span className="badge-danger px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">{lowStock.length}</span>}
              {outCount > 0 && <span className="text-[11.5px] text-slate-400">{outCount} out</span>}
            </div>
            <Link to="/app/inventory" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              Inventory →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            loading ? <Skeleton rows={4} /> : <EmptyState compact icon="checkCircle" tone="emerald" title="Stock healthy" text="All catalog items are stocked above safety levels." />
          ) : (
            <ul className="divide-y divide-slate-100 flex-1 my-2">
              {lowStock.slice(0, 5).map(({ p, stock, min }) => (
                <li key={p.id} className="py-2.5 flex items-center gap-3">
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
          <div className="pt-3 mt-auto">
            <Link to="/app/inventory" className="btn-soft w-full text-center block py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800">
              Manage Stock in Inventory →
            </Link>
          </div>
        </section>
      </div>

      {/* Recent orders */}
      <section className="card overflow-hidden bg-white p-5 rounded-2xl border border-gray-200">
        <div className="card-header flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="card-title text-[14.5px] font-bold text-navy-950">Store Orders</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Customer orders requiring fulfillment and delivery</p>
          </div>
          <Link to="/app/orders" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">
            View all orders →
          </Link>
        </div>

        {orders.length === 0 ? (
          loading ? <Skeleton rows={3} /> : <EmptyState compact icon="cart" title="No orders placed yet" text="Incoming orders from the marketplace will show here in real-time." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5">Order #</th>
                    <th className="py-2.5">Customer</th>
                    <th className="py-2.5">Amount</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.slice(0, 5).map((o) => {
                    const st = stageOf(o.status);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/60 transition">
                        <td className="py-3 font-bold text-navy-900">#{o.order_number || o.id}</td>
                        <td className="py-3 text-gray-700">{o.customer?.name || "Customer"}</td>
                        <td className="py-3 font-semibold text-emerald-800">{inr(Number(o.total_amount || 0))}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.tone}`}>{st.label}</span>
                        </td>
                        <td className="py-3 text-right">
                          {st.next && (
                            <button
                              type="button"
                              disabled={busyOrder === o.id}
                              onClick={() => advanceOrder(o)}
                              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] disabled:opacity-50"
                            >
                              {busyOrder === o.id ? "..." : st.next.action}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-2 mt-2">
              {orders.slice(0, 5).map((o) => {
                const st = stageOf(o.status);
                return (
                  <div key={o.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-navy-900">#{o.order_number || o.id}</span>
                      <span className="font-bold text-emerald-800 tabular">{inr(Number(o.total_amount || 0))}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="truncate max-w-[150px]">{o.customer?.name || "Customer"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.tone}`}>{st.label}</span>
                    </div>
                    {st.next && (
                      <div className="pt-1.5 border-t border-gray-200/60 flex justify-end">
                        <button
                          type="button"
                          disabled={busyOrder === o.id}
                          onClick={() => advanceOrder(o)}
                          className="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {busyOrder === o.id ? "Updating..." : st.next.action}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Top customer dues + Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card bg-white p-5 rounded-2xl border border-gray-200">
          <div className="card-header flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="card-title text-[14.5px] font-bold text-navy-950">Customer Khata Dues</h2>
            <Link to="/app/ledger" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">
              Open Ledger →
            </Link>
          </div>
          {dues.denied ? (
            <EmptyState compact icon="ban" title="No access" text="Customer balance access is restricted." />
          ) : dues.top.length === 0 ? (
            loading ? <Skeleton rows={4} /> : <EmptyState compact icon="checkCircle" tone="emerald" title="All cleared" text="No customer has an outstanding balance due." />
          ) : (
            <ul className="divide-y divide-slate-100 my-2">
              {dues.top.map((c) => (
                <li key={`${c.id}-${c.name}`} className="py-3 flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/app/ledger?customerId=${c.id}`} className="block text-[13.5px] font-medium text-navy-900 hover:text-brand-700 truncate">{c.name}</Link>
                    <Meter value={c.amount} max={maxDue} tone="rose" className="mt-1.5" />
                  </div>
                  <span className="text-[13.5px] font-bold text-rose-600 tabular whitespace-nowrap">{inr(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 6 Core Modules Quick Navigation */}
        <section className="card bg-white p-5 rounded-2xl border border-gray-200">
          <div className="card-header pb-3 border-b border-gray-100">
            <h2 className="card-title text-[14.5px] font-bold text-navy-950">Store Operations</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Core shop management modules</p>
          </div>
          <div className="pt-3 grid grid-cols-2 gap-2.5">
            {[
              { label: "POS Billing", desc: "Ring up retail sale", to: "/app/billing", icon: "receipt", tone: "brand" as const },
              { label: "Sales Invoices", desc: "Past bills & GST", to: "/app/sales", icon: "trend" as const, tone: "emerald" as const },
              { label: "Live Inventory", desc: "Stock management", to: "/app/inventory", icon: "layers" as const, tone: "sky" as const },
              { label: "Products Catalog", desc: "Add & edit products", to: "/app/products", icon: "plus" as const, tone: "violet" as const },
              { label: "Customer Ledger", desc: "Udhaar & statements", to: "/app/ledger", icon: "wallet" as const, tone: "amber" as const },
              { label: "Store Orders", desc: "Dispatch & tracking", to: "/app/orders", icon: "cart" as const, tone: "sky" as const },
            ].map((m) => (
              <Link
                key={m.to}
                to={m.to}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition group"
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TONE[m.tone].tile}`}>
                  <Icon name={m.icon} className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-navy-900 group-hover:text-emerald-800 truncate">{m.label}</div>
                  <div className="text-[11px] text-gray-500 truncate">{m.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {toast && <Toast ok={toast.ok} text={toast.text} />}
    </div>
  );
}

function HeroFigure({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
      <div className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-lg sm:text-xl font-black text-white">{loading ? "..." : value}</div>
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  );
}

function BarChart({ data, loading }: { data: { label: string; sales: number }[]; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.sales));
  const top = Math.ceil(max * 1.15);
  const H = 180;

  if (loading) return <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">Loading sales data...</div>;
  if (!loading && data.every((d) => d.sales === 0)) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <EmptyState compact icon="trend" title="No sales in this period" text="Create sales in POS Billing to view revenue analytics." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-[180px] flex items-end justify-between gap-1 sm:gap-2 pt-6">
        {data.map((d, i) => (
          <div
            key={d.label + i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer"
          >
            <div
              className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 transition-all duration-300"
              style={{ height: `${Math.max(4, (d.sales / top) * H)}px` }}
            />
            <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="text-center text-xs font-bold text-emerald-800">
          {data[hover].label}: {inr(data[hover].sales)}
        </div>
      )}
    </div>
  );
}
