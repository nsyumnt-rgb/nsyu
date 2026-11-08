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

export default function Dashboard() {
  const shopId = useAuthStore((s) => s.shopId);

  const [_loading, setLoading] = useState(true);
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
  const currentStockVal = invSummary?.totalValue
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

  const receivablesVal = outSummary?.totalOutstanding ? Number(outSummary.totalOutstanding) : 0;
  const payablesVal = suppOutSummary?.totalOutstanding ? Number(suppOutSummary.totalOutstanding) : 0;

  // Real Low Stock Products from actual inventory
  const lowStockProducts = productsList.filter(
    (p) => (p.stocks?.[0]?.current_stock ?? 0) <= (p.min_stock ?? 5)
  );

  return (
    <div className="space-y-5 pb-10">
      {/* ============================================================== */}
      {/* 1. TOP 5 PRIMARY METRIC CARDS                                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <div>
            <div className="text-[12px] text-slate-500 font-medium leading-none">Total Sales</div>
            <div className="text-[19px] font-bold text-slate-800 tracking-tight mt-1">
              {formatCurrency(totalSalesVal)}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {salesSummary?.count ? `${salesSummary.count} invoices` : "Live database record"}
            </div>
          </div>
        </div>

        {/* Total Purchase */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <div className="text-[12px] text-slate-500 font-medium leading-none">Total Purchase</div>
            <div className="text-[19px] font-bold text-slate-800 tracking-tight mt-1">
              {formatCurrency(totalPurchaseVal)}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {purchaseSummary?.count ? `${purchaseSummary.count} bills` : "Live database record"}
            </div>
          </div>
        </div>

        {/* Current Stock Value */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </div>
          <div>
            <div className="text-[12px] text-slate-500 font-medium leading-none">Current Stock Value</div>
            <div className="text-[19px] font-bold text-slate-800 tracking-tight mt-1">
              {formatCurrency(currentStockVal)}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {productsList.length} products in catalog
            </div>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-[12px] text-slate-500 font-medium leading-none">Total Customers</div>
            <div className="text-[19px] font-bold text-slate-800 tracking-tight mt-1">
              {totalCustomersVal.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              Registered customers
            </div>
          </div>
        </div>

        {/* Total Employees */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <div className="text-[12px] text-slate-500 font-medium leading-none">Total Employees</div>
            <div className="text-[19px] font-bold text-slate-800 tracking-tight mt-1">
              {totalEmployeesVal}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              Staff members
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CHARTS SECTION (Sales & Purchase Trends)                    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Sales & Purchase Trend */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="text-[15px] font-bold text-slate-800">Sales & Purchase Trend</div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-slate-600">Sales: {formatCurrency(totalSalesVal)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Purchase: {formatCurrency(totalPurchaseVal)}</span>
              </div>
            </div>
          </div>

          {/* Database-Driven Trend Visualization or Clean Empty State */}
          {totalSalesVal === 0 && totalPurchaseVal === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl mb-2">
                📊
              </div>
              <div className="text-sm font-semibold text-slate-700">No Transaction Trend Data Yet</div>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Sales and purchase volume over time will be graphed dynamically here as invoices are created.
              </p>
              <div className="flex gap-3 mt-4">
                <Link to="/app/billing" className="text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  + Create Sale
                </Link>
                <Link to="/app/purchase" className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                  + Record Purchase
                </Link>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[220px] flex flex-col justify-end pb-2">
              <div className="flex items-end justify-around h-40 gap-4 px-4 border-b border-slate-200">
                <div className="flex flex-col items-center flex-1 max-w-[80px]">
                  <div className="text-[11px] font-bold text-blue-600 mb-1">{formatCurrency(totalSalesVal)}</div>
                  <div
                    className="w-full bg-blue-500 rounded-t-md transition-all"
                    style={{ height: `${Math.min(130, Math.max(16, (totalSalesVal / (totalSalesVal + totalPurchaseVal || 1)) * 130))}px` }}
                  />
                  <div className="text-[11px] text-slate-500 font-medium mt-1">Sales</div>
                </div>
                <div className="flex flex-col items-center flex-1 max-w-[80px]">
                  <div className="text-[11px] font-bold text-emerald-600 mb-1">{formatCurrency(totalPurchaseVal)}</div>
                  <div
                    className="w-full bg-emerald-500 rounded-t-md transition-all"
                    style={{ height: `${Math.min(130, Math.max(16, (totalPurchaseVal / (totalSalesVal + totalPurchaseVal || 1)) * 130))}px` }}
                  />
                  <div className="text-[11px] text-slate-500 font-medium mt-1">Purchases</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Shop Distribution */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[15px] font-bold text-slate-800">Shops & Portals</div>
            <span className="text-xs font-semibold text-slate-500">{shopsList.length} active</span>
          </div>

          <div className="flex flex-col justify-center gap-3 my-auto pt-2">
            {shopsList.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No active shop profiles found.
              </div>
            ) : (
              shopsList.map((shop) => (
                <div key={shop.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">{shop.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{shop.code}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SECONDARY 5 KPI CARDS                                       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Today's Sales */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Today's Sales</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(todaySalesVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {todaySalesCount} invoices today
            </div>
          </div>
        </div>

        {/* Today's Purchase */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Today's Purchase</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(todayPurchaseVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {todayPurchaseCount} bills today
            </div>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Customer Receivables</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(receivablesVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Due from customers
            </div>
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Supplier Payables</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(payablesVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Due to suppliers
            </div>
          </div>
        </div>

        {/* Catalog Items */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Active Products</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {productsList.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              In stock: {productsList.filter(p => (p.stocks?.[0]?.current_stock ?? 0) > 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. MIDDLE TWO TABLES (Recent Sales + Low Stock Products)       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recent Sales */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Recent Sales</div>
            <Link to="/app/sales" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          {liveSales.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mb-2">
                🛒
              </div>
              <div className="text-sm font-semibold text-slate-700">No Recent Sales</div>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Invoices and billings created through the point of sale will appear here.
              </p>
              <Link
                to="/app/billing"
                className="mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                + Create First Sale
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2.5 pr-2">Invoice No.</th>
                    <th className="py-2.5 px-2">Customer</th>
                    <th className="py-2.5 px-2">Amount</th>
                    <th className="py-2.5 px-2">Payment</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 pl-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {liveSales.slice(0, 5).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pr-2 font-mono font-medium">
                        <ReferenceLink type="sale" id={s.id} refNumber={s.invoice_number} />
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800">
                        <ReferenceLink type="customer" id={s.customer_id} refNumber={s.customer?.name || "Walk-in Customer"} className="text-slate-800 hover:text-blue-600 font-normal">
                          {s.customer?.name || "Walk-in Customer"}
                        </ReferenceLink>
                      </td>
                      <td className="py-3 px-2 font-semibold text-slate-900">₹ {Number(s.total_amount).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            Number(s.due_amount) === 0
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {Number(s.due_amount) === 0 ? "Paid" : "Partial"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`font-medium ${
                            s.status === "completed" ? "text-emerald-600" : "text-amber-500"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 pl-2 text-right text-slate-400">
                        {new Date(s.invoice_date || s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Low Stock Products */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Low Stock Products</div>
            <Link to="/app/inventory" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-2">
                ✓
              </div>
              <div className="text-sm font-semibold text-slate-700">All Products Well Stocked</div>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                No products are currently at or below their minimum reorder stock level.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2.5 pr-2">Product</th>
                    <th className="py-2.5 px-2">SKU</th>
                    <th className="py-2.5 px-2 text-center">Current Stock</th>
                    <th className="py-2.5 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {lowStockProducts.slice(0, 5).map((p) => {
                    const currentStock = p.stocks?.[0]?.current_stock ?? 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-2 flex items-center gap-2.5">
                          <ProductItemIcon name={p.name} category={p.category?.name} size="sm" />
                          <ReferenceLink type="product" refNumber={p.name} className="text-slate-800 hover:text-blue-600 font-medium">
                            {p.name}
                          </ReferenceLink>
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-500 text-[11.5px]">
                          <ReferenceLink type="product" refNumber={p.sku} />
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-rose-500">{currentStock}</td>
                        <td className="py-3 pl-2 text-right">
                          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-500 border border-rose-100">
                            {currentStock <= 0 ? "Out of Stock" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. BOTTOM CARDS (Recent Purchases & Recent Activities)          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Purchases */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Recent Purchases</div>
            <Link to="/app/purchase" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          {livePurchases.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mb-2">
                🚚
              </div>
              <div className="text-sm font-semibold text-slate-700">No Purchases Recorded Yet</div>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Inward inventory purchases from suppliers will appear here.
              </p>
              <Link
                to="/app/purchase"
                className="mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                + Record First Purchase
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2 pr-1">Bill No.</th>
                    <th className="py-2 px-1">Supplier</th>
                    <th className="py-2 px-1">Amount</th>
                    <th className="py-2 px-1">Status</th>
                    <th className="py-2 pl-1 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {livePurchases.slice(0, 5).map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 pr-1 font-mono text-[11px]">
                        <ReferenceLink type="purchase" refNumber={pur.invoice_number} />
                      </td>
                      <td className="py-2.5 px-1 font-medium text-slate-800 truncate max-w-[95px]">
                        <ReferenceLink type="supplier" refNumber={pur.supplier?.name || "Supplier"} className="text-slate-800 hover:text-blue-600 font-normal">
                          {pur.supplier?.name || "Supplier"}
                        </ReferenceLink>
                      </td>
                      <td className="py-2.5 px-1 font-semibold text-slate-800">
                        ₹ {Number(pur.total_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                            pur.status === "received" || pur.status === "completed"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {pur.status}
                        </span>
                      </td>
                      <td className="py-2.5 pl-1 text-right text-slate-400 text-[11px]">
                        {new Date(pur.purchase_date || pur.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Recent Activities</div>
            <Link to="/app/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mb-2">
                📋
              </div>
              <div className="text-sm font-semibold text-slate-700">No Recent Activity</div>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Audits, product updates, and business actions will be tracked here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {activities.slice(0, 5).map((act, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
                      ⚡
                    </div>
                    <span className="font-medium text-slate-700 truncate">
                      {act.action ? `${act.action.toUpperCase()} on ${act.entity_type || 'System'}` : act.details || "Activity recorded"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
