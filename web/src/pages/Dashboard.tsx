import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getCustomerOutstandingReport,
  getSupplierOutstandingReport,
} from "../api/reports";
import { listSales } from "../api/sales";
import { listPurchases } from "../api/purchases";
import { listCustomers } from "../api/customers";
import { listEmployees } from "../api/employees";
import { listProducts } from "../api/products";
import { listShops } from "../api/shops";
import { api } from "../api/client";
import ReferenceLink from "../components/ReferenceLink";
import ProductItemIcon from "../components/ProductItemIcon";
import type { ReactNode } from "react";

export default function Dashboard() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);

  const [loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<any>(null);
  const [invSummary, setInvSummary] = useState<any>(null);
  const [outSummary, setOutSummary] = useState<any>(null);
  const [suppOutSummary, setSuppOutSummary] = useState<any>(null);
  const [liveSales, setLiveSales] = useState<any[]>([]);
  const [livePurchases, setLivePurchases] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [shopsList, setShopsList] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSalesReport().catch(() => ({ data: { data: {} } })),
      getPurchaseReport().catch(() => ({ data: { data: {} } })),
      getInventoryReport().catch(() => ({ data: { data: {} } })),
      getCustomerOutstandingReport().catch(() => ({ data: { data: {} } })),
      getSupplierOutstandingReport().catch(() => ({ data: { data: {} } })),
      listSales({ limit: 5 }).catch(() => ({ data: { data: [] } })),
      listPurchases({ limit: 5 }).catch(() => ({ data: { data: [] } })),
      listCustomers().catch(() => ({ data: { data: [] } })),
      listEmployees().catch(() => ({ data: { data: [] } })),
      listProducts().catch(() => ({ data: { data: [] } })),
      api.get("/activity", { params: { limit: 5 } }).catch(() => ({ data: { data: [] } })),
      listShops().catch(() => ({ data: { data: [] } })),
    ])
      .then(([salesRes, purchRes, invRes, outRes, suppOutRes, recentSalesRes, recentPurchRes, custRes, empRes, prodRes, actRes, shopsRes]) => {
        setSalesSummary(salesRes.data?.data?.summary || null);
        setPurchaseSummary(purchRes.data?.data?.summary || null);
        setInvSummary(invRes.data?.data || null);
        setOutSummary(outRes.data?.data || null);
        setSuppOutSummary(suppOutRes.data?.data || null);
        setLiveSales(recentSalesRes.data?.data || []);
        setLivePurchases(recentPurchRes.data?.data || []);
        setCustomersCount(Array.isArray(custRes.data?.data) ? custRes.data.data.length : 0);
        setEmployeesCount(Array.isArray(empRes.data?.data) ? empRes.data.data.length : 0);
        setProductsList(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
        setActivities(Array.isArray(actRes.data?.data) ? actRes.data.data : []);
        setShopsList(Array.isArray(shopsRes.data?.data) ? shopsRes.data.data : []);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  // Format Helper
  const formatCurrency = (val: number) => {
    return "₹ " + (val || 0).toLocaleString("en-IN");
  };

  // 100% Real Database-Calculated Primary Metrics
  const totalSalesVal = salesSummary?.total ? Number(salesSummary.total) : 0;
  const totalPurchaseVal = purchaseSummary?.total ? Number(purchaseSummary.total) : 0;
  const currentStockVal = invSummary?.summary?.totalCostValue != null
    ? Number(invSummary.summary.totalCostValue)
    : invSummary?.totalValue
    ? Number(invSummary.totalValue)
    : productsList.reduce((acc, p) => acc + ((p.stocks?.[0]?.current_stock ?? 0) * Number(p.purchase_price || p.selling_price || 0)), 0);
  const totalCustomersVal = customersCount;
  const totalEmployeesVal = employeesCount;

  // Real Secondary Metrics computed from live records
  const todayStr = new Date().toDateString();
  const todaySalesList = liveSales.filter(s => new Date(s.invoice_date || s.createdAt).toDateString() === todayStr);
  const todaySalesVal = todaySalesList.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const todaySalesCount = todaySalesList.length;

  const todayPurchList = livePurchases.filter(p => new Date(p.purchase_date || p.createdAt).toDateString() === todayStr);
  const todayPurchaseVal = todayPurchList.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
  const todayPurchaseCount = todayPurchList.length;

  // Report endpoints return { summary: { totalReceivable } } / { summary: { totalPayable } }
  const receivablesVal = Number(outSummary?.summary?.totalReceivable ?? outSummary?.totalOutstanding ?? 0) || 0;
  const payablesVal = Number(suppOutSummary?.summary?.totalPayable ?? suppOutSummary?.totalOutstanding ?? 0) || 0;

  // Real Low Stock Products from actual inventory
  const lowStockProducts = productsList.filter(
    (p) => (p.stocks?.[0]?.current_stock ?? 0) <= (p.min_stock ?? 5)
  );

  const displayName = (owner?.name || employee?.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const tradeTotal = totalSalesVal + totalPurchaseVal;
  const salesShare = tradeTotal > 0 ? Math.round((totalSalesVal / tradeTotal) * 100) : 0;
  const inStockCount = productsList.filter((p) => (p.stocks?.[0]?.current_stock ?? 0) > 0).length;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="section-label">{todayLabel}</div>
          <h1 className="page-title mt-1.5">
            {greeting}
            {displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="page-subtitle">
            Here is how {activeShop?.name || "your business"} is doing today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/purchase" className="btn-secondary">
            <Icon d="M12 5v14M5 12h14" /> Record Purchase
          </Link>
          <Link to="/app/billing" className="btn-primary">
            <Icon d="M12 5v14M5 12h14" /> New Bill
          </Link>
        </div>
      </div>

      {/* ── Hero: revenue + money position ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="hero-brand xl:col-span-7 p-6 sm:p-7">
          <div className="absolute -right-16 -bottom-24 w-72 h-72 rounded-full bg-white/[0.04]" />
          <div className="absolute right-10 -top-20 w-48 h-48 rounded-full bg-brand-400/10" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[12px] font-medium text-brand-100/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Total Sales
            </div>
            <div className={`mt-2 text-[34px] sm:text-[40px] font-bold tracking-tight leading-none tabular ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {formatCurrency(totalSalesVal)}
            </div>
            <div className="mt-2 text-[13px] text-brand-100/70">
              {salesSummary?.count ? `${salesSummary.count} invoices recorded` : "No invoices recorded yet"}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-6 border-t border-white/10 pt-5">
              <HeroStat label="Today's sales" value={formatCurrency(todaySalesVal)} hint={`${todaySalesCount} invoice${todaySalesCount === 1 ? "" : "s"}`} />
              <HeroStat label="Today's purchase" value={formatCurrency(todayPurchaseVal)} hint={`${todayPurchaseCount} bill${todayPurchaseCount === 1 ? "" : "s"}`} />
              <HeroStat label="Stock value" value={formatCurrency(currentStockVal)} hint={`${productsList.length} products`} />
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-5">
          <MoneyCard
            to="/app/ledger"
            tone="due"
            label="To collect from customers"
            value={formatCurrency(receivablesVal)}
            hint="Outstanding customer balances"
            loading={loading}
            icon={<Icon d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}
          />
          <MoneyCard
            to="/app/suppliers"
            tone="pay"
            label="To pay suppliers"
            value={formatCurrency(payablesVal)}
            hint="Outstanding supplier balances"
            loading={loading}
            icon={<Icon d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />}
          />
        </div>
      </div>

      {/* ── KPI tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Total Purchase"
          value={formatCurrency(totalPurchaseVal)}
          hint={purchaseSummary?.count ? `${purchaseSummary.count} bills` : "No bills yet"}
          tint="bg-brand-50 text-brand-600"
          loading={loading}
          icon={<Icon d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />}
        />
        <KpiTile
          label="Active Products"
          value={productsList.length.toLocaleString("en-IN")}
          hint={`${inStockCount} in stock`}
          tint="bg-sky-50 text-sky-600"
          loading={loading}
          icon={<Icon d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />}
        />
        <KpiTile
          label="Customers"
          value={totalCustomersVal.toLocaleString("en-IN")}
          hint="Registered customers"
          tint="bg-teal-50 text-teal-600"
          loading={loading}
          icon={<Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />}
        />
        <KpiTile
          label="Employees"
          value={totalEmployeesVal.toLocaleString("en-IN")}
          hint="Staff members"
          tint="bg-slate-100 text-slate-600"
          loading={loading}
          icon={<Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />}
        />
      </div>

      {/* ── Trend + shops ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="card lg:col-span-8">
          <div className="card-header">
            <div>
              <h2 className="card-title">Sales vs Purchase</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Overall trading volume</p>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[12px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600" /> Sales</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300" /> Purchase</span>
            </div>
          </div>

          {tradeTotal === 0 ? (
            <EmptyState
              icon={<Icon d="M3 3v18h18M7 15l4-4 3 3 5-6" />}
              title="No transactions yet"
              text="Your sales and purchase volume will appear here as soon as you create your first bill."
              action={<Link to="/app/billing" className="btn-primary btn-sm">Create first bill</Link>}
            />
          ) : (
            <div className="p-5 sm:p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="stat-label">Sales</div>
                  <div className="text-[22px] font-bold text-navy-900 tabular mt-1">{formatCurrency(totalSalesVal)}</div>
                </div>
                <div className="text-right">
                  <div className="stat-label">Purchase</div>
                  <div className="text-[22px] font-bold text-navy-900 tabular mt-1">{formatCurrency(totalPurchaseVal)}</div>
                </div>
              </div>
              <div>
                <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 gap-0.5">
                  <div className="bg-brand-600 rounded-l-full transition-all duration-700" style={{ width: `${salesShare}%` }} />
                  <div className="bg-amber-300 rounded-r-full transition-all duration-700" style={{ width: `${100 - salesShare}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[12px] font-medium text-slate-500">
                  <span>{salesShare}% sales</span>
                  <span>{100 - salesShare}% purchase</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Sales − purchase" value={formatCurrency(totalSalesVal - totalPurchaseVal)} tone={totalSalesVal - totalPurchaseVal >= 0 ? "ok" : "due"} />
                <MiniStat label="Receivables" value={formatCurrency(receivablesVal)} tone={receivablesVal > 0 ? "due" : "neutral"} />
                <MiniStat label="Payables" value={formatCurrency(payablesVal)} tone={payablesVal > 0 ? "warn" : "neutral"} />
              </div>
            </div>
          )}
        </section>

        <section className="card lg:col-span-4 flex flex-col">
          <div className="card-header">
            <h2 className="card-title">Shops & Branches</h2>
            <span className="badge-brand">{shopsList.length} active</span>
          </div>
          <div className="p-3 flex-1 space-y-1.5">
            {shopsList.length === 0 ? (
              <EmptyState compact icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" />} title="No shops found" text="Your registered shops will be listed here." />
            ) : (
              shopsList.map((shop) => {
                const current = activeShop?.id === shop.id;
                return (
                  <div
                    key={shop.id}
                    className={`p-3 rounded-xl flex items-center gap-3 transition-colors ${current ? "bg-brand-50 ring-1 ring-brand-100" : "hover:bg-slate-50"}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0 ${current ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {(shop.name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-navy-900 text-[13px] truncate">{shop.name}</div>
                      <div className="text-[11.5px] text-slate-400 font-mono">{shop.code}</div>
                    </div>
                    {current ? <span className="badge-brand">Current</span> : <span className="badge-active">Active</span>}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Recent sales + low stock ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="card overflow-hidden">
          <div className="card-header">
            <h2 className="card-title">Recent Sales</h2>
            <Link to="/app/sales" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">View all →</Link>
          </div>
          {liveSales.length === 0 ? (
            <EmptyState
              icon={<Icon d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />}
              title="No sales yet"
              text="Bills you create will appear here."
              action={<Link to="/app/billing" className="btn-soft btn-sm">+ Create first sale</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="!text-right">Amount</th>
                    <th>Payment</th>
                    <th className="!text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSales.slice(0, 5).map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono font-medium whitespace-nowrap">
                        <ReferenceLink type="sale" id={s.id} refNumber={s.invoice_number} />
                      </td>
                      <td className="font-medium text-slate-800 max-w-[160px] truncate">
                        <ReferenceLink type="customer" id={s.customer_id} refNumber={s.customer?.name || "Walk-in Customer"} className="!font-sans text-slate-800 hover:text-brand-600 font-medium">
                          {s.customer?.name || "Walk-in Customer"}
                        </ReferenceLink>
                      </td>
                      <td className="text-right font-semibold text-navy-900 whitespace-nowrap">₹ {Number(s.total_amount).toLocaleString("en-IN")}</td>
                      <td>
                        {Number(s.due_amount) === 0 ? (
                          <span className="badge-active">Paid</span>
                        ) : (
                          <span className="badge-warn" title={`Status: ${s.status}`}>Partial</span>
                        )}
                      </td>
                      <td className="text-right text-slate-500 whitespace-nowrap">{fmtDate(s.invoice_date || s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <h2 className="card-title">Low Stock</h2>
              {lowStockProducts.length > 0 && <span className="badge-danger">{lowStockProducts.length}</span>}
            </div>
            <Link to="/app/inventory" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">Inventory →</Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <EmptyState
              tone="ok"
              icon={<Icon d="M20 6L9 17l-5-5" />}
              title="All products well stocked"
              text="No product is at or below its minimum stock level."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockProducts.slice(0, 5).map((p) => {
                const currentStock = p.stocks?.[0]?.current_stock ?? 0;
                const min = p.min_stock ?? 5;
                const pct = min > 0 ? Math.max(4, Math.min(100, (currentStock / min) * 100)) : 0;
                return (
                  <li key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-brand-50/30 transition-colors">
                    <ProductItemIcon name={p.name} category={p.category?.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <ReferenceLink type="product" refNumber={p.name} className="!font-sans text-[13px] text-navy-900 hover:text-brand-600 font-semibold truncate block">
                        {p.name}
                      </ReferenceLink>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 w-20 sm:w-24 rounded-full bg-slate-100 overflow-hidden shrink-0">
                          <div className={`h-full rounded-full ${currentStock <= 0 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono truncate">
                          <ReferenceLink type="product" refNumber={p.sku} />
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[15px] font-bold tabular ${currentStock <= 0 ? "text-rose-600" : "text-amber-600"}`}>{currentStock}</div>
                      <div className="text-[10.5px] text-slate-400">min {min}</div>
                    </div>
                    <span className={`hidden sm:inline-flex ${currentStock <= 0 ? "badge-danger" : "badge-warn"}`}>
                      {currentStock <= 0 ? "Out of stock" : "Low stock"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Recent purchases + activity ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="card overflow-hidden">
          <div className="card-header">
            <h2 className="card-title">Recent Purchases</h2>
            <Link to="/app/purchase" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">View all →</Link>
          </div>
          {livePurchases.length === 0 ? (
            <EmptyState
              icon={<Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />}
              title="No purchases recorded"
              text="Stock purchased from suppliers will appear here."
              action={<Link to="/app/purchase" className="btn-soft btn-sm">+ Record first purchase</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Supplier</th>
                    <th className="!text-right">Amount</th>
                    <th>Status</th>
                    <th className="!text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {livePurchases.slice(0, 5).map((pur) => (
                    <tr key={pur.id}>
                      <td className="font-mono whitespace-nowrap">
                        <ReferenceLink type="purchase" refNumber={pur.invoice_number} />
                      </td>
                      <td className="font-medium text-slate-800 max-w-[140px] truncate">
                        <ReferenceLink type="supplier" refNumber={pur.supplier?.name || "Supplier"} className="!font-sans text-slate-800 hover:text-brand-600 font-medium">
                          {pur.supplier?.name || "Supplier"}
                        </ReferenceLink>
                      </td>
                      <td className="text-right font-semibold text-navy-900 whitespace-nowrap">₹ {Number(pur.total_amount).toLocaleString("en-IN")}</td>
                      <td>
                        <span className={`capitalize ${pur.status === "received" || pur.status === "completed" ? "badge-active" : "badge-brand"}`}>
                          {pur.status}
                        </span>
                      </td>
                      <td className="text-right text-slate-500 whitespace-nowrap">{fmtDate(pur.purchase_date || pur.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="card-header">
            <h2 className="card-title">Recent Activity</h2>
            <Link to="/app/reports" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-800">Reports →</Link>
          </div>
          {activities.length === 0 ? (
            <EmptyState
              icon={<Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />}
              title="No recent activity"
              text="Updates to products, bills and customers will be tracked here."
            />
          ) : (
            <ol className="px-5 py-4">
              {activities.slice(0, 5).map((act, idx, arr) => (
                <li key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                  {idx < arr.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
                  <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 ring-4 ring-white flex items-center justify-center shrink-0">
                    <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="text-[13px] font-medium text-slate-800 truncate">
                      {act.action ? `${act.action.charAt(0).toUpperCase()}${act.action.slice(1)} · ${act.entity_type || "System"}` : act.details || "Activity recorded"}
                    </div>
                    <div className="text-[11.5px] text-slate-400 mt-0.5">
                      {act.createdAt ? `${fmtDate(act.createdAt)} · ${new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Just now"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/* ───────────────────────── Presentational helpers ───────────────────────── */

function Icon({ d, className = "w-[18px] h-[18px]" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-brand-100/70 font-medium truncate">{label}</div>
      <div className="text-[14px] sm:text-[17px] font-semibold mt-1 tabular truncate">{value}</div>
      <div className="text-[11px] text-brand-100/50 mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function MoneyCard({
  to, tone, label, value, hint, icon, loading,
}: { to: string; tone: "due" | "pay"; label: string; value: string; hint: string; icon: ReactNode; loading: boolean }) {
  const styles = tone === "due"
    ? { tile: "bg-rose-50 text-rose-600", value: "text-rose-600", bar: "bg-rose-500" }
    : { tile: "bg-amber-50 text-amber-600", value: "text-amber-600", bar: "bg-amber-400" };
  return (
    <Link to={to} className="card card-hover relative overflow-hidden p-5 flex items-center gap-4 group">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${styles.bar}`} />
      <div className={`icon-tile w-11 h-11 ${styles.tile}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="stat-label">{label}</div>
        <div className={`text-[22px] font-bold tracking-tight tabular mt-1 truncate ${styles.value} ${loading ? "opacity-40 animate-pulse" : ""}`}>{value}</div>
        <div className="text-[11.5px] text-slate-400 mt-0.5">{hint}</div>
      </div>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

function KpiTile({
  label, value, hint, icon, tint, loading,
}: { label: string; value: string; hint: string; icon: ReactNode; tint: string; loading: boolean }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="stat-label">{label}</div>
        <div className={`icon-tile w-9 h-9 rounded-lg ${tint}`}>{icon}</div>
      </div>
      <div className={`stat-value mt-2 text-[19px] sm:text-[22px] truncate ${loading ? "opacity-40 animate-pulse" : ""}`}>{value}</div>
      <div className="text-[11.5px] text-slate-400 mt-1.5 truncate">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "ok" | "due" | "warn" | "neutral" }) {
  const color = { ok: "text-emerald-600", due: "text-rose-600", warn: "text-amber-600", neutral: "text-navy-900" }[tone];
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
      <div className="text-[11.5px] text-slate-500 font-medium truncate">{label}</div>
      <div className={`text-[15px] font-bold tabular mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({
  icon, title, text, action, tone = "neutral", compact = false,
}: { icon: ReactNode; title: string; text: string; action?: ReactNode; tone?: "neutral" | "ok"; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? "py-8" : "py-12"}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${tone === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-500"}`}>
        {icon}
      </div>
      <div className="text-[13.5px] font-semibold text-navy-900">{title}</div>
      <p className="text-[12.5px] text-slate-500 mt-1 max-w-xs">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
