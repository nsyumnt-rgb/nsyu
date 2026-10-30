import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  getSalesReport,
  getPurchaseReport,
  getProfitReport,
  getInventoryReport,
  getCustomerOutstandingReport,
  getShopPerformanceReport,
} from "../api/reports";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";

function ReportsInner() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = ["sales", "purchases", "profit", "inventory", "outstanding", "performance"];
  const urlTab = searchParams.get("tab");
  const activeTab: "sales" | "purchases" | "profit" | "inventory" | "outstanding" | "performance" =
    urlTab && validTabs.includes(urlTab) ? (urlTab as any) : "sales";

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Date range filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (tabId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabId);
      return next;
    });
  };

  function loadReport() {
    setLoading(true);
    setError(null);
    const params = {
      from: from || undefined,
      to: to || undefined,
      allShops: isOwner && allShopsToggle ? true : undefined,
    };

    let fetcher: Promise<any>;
    switch (activeTab) {
      case "sales":
        fetcher = getSalesReport(params);
        break;
      case "purchases":
        fetcher = getPurchaseReport(params);
        break;
      case "profit":
        fetcher = getProfitReport(params);
        break;
      case "inventory":
        fetcher = getInventoryReport(params);
        break;
      case "outstanding":
        fetcher = getCustomerOutstandingReport(params);
        break;
      case "performance":
        fetcher = getShopPerformanceReport(params);
        break;
      default:
        fetcher = getSalesReport(params);
        break;
    }

    fetcher
      .then((res) => setReportData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err, "Could not load report data")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
  }, [shopId, activeTab, allShopsToggle, from, to]);

  return (
    <div className="space-y-6">
      {/* Page Title & Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Intelligence & Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial analytics, gross profit, inventory valuation, and multi-shop performance.
          </p>
        </div>

        {isOwner && (
          <label className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
            <input
              type="checkbox"
              checked={allShopsToggle}
              onChange={(e) => setAllShopsToggle(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Consolidated (All Shops)
          </label>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2 sm:gap-3">
        {[
          { id: "sales", label: "Sales Analytics" },
          { id: "purchases", label: "Purchases" },
          { id: "profit", label: "Gross Profit & Margins" },
          { id: "inventory", label: "Inventory Valuation" },
          { id: "outstanding", label: "Customer Outstanding" },
          ...(isOwner ? [{ id: "performance", label: "Shop Performance" }] : []),
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                isActive
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scope:</span>
          <span className="badge bg-slate-100 text-slate-800 font-medium text-xs px-2.5 py-1 rounded-md">
            {allShopsToggle ? "All Authorized Shops (Consolidated)" : activeShop?.name || "Selected Shop"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500 font-medium">From:</label>
          <input
            type="date"
            className="input py-1.5 px-2 text-xs font-mono rounded-md border border-slate-200"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label className="text-slate-500 font-medium ml-2">To:</label>
          <input
            type="date"
            className="input py-1.5 px-2 text-xs font-mono rounded-md border border-slate-200"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="text-blue-600 hover:underline font-semibold ml-2 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Content based on Active Tab */}
      {loading ? (
        <div className="card p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
          <div className="text-xs font-medium">Calculating reports from database…</div>
        </div>
      ) : !reportData ? (
        <div className="card p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
          <div className="text-sm font-semibold">No data available for this period.</div>
        </div>
      ) : activeTab === "sales" ? (
        /* ========================================================================= */
        /* 1. SALES ANALYTICS REPORT                                                 */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoiced Revenue</div>
              <div className="text-2xl font-mono font-bold text-blue-600 mt-1">
                ₹{Number(reportData.summary?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">{reportData.summary?.count || 0} invoices issued</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount Collected</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.summary?.paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Settled payments</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Due Balance</div>
              <div className="text-2xl font-mono font-bold text-rose-600 mt-1">
                ₹{Number(reportData.summary?.due || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Pending collection</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Discounts Given</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Number(reportData.summary?.discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Customer concessions</div>
            </div>
          </div>

          <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Sales Transactions & Breakdown</h2>
              <span className="text-xs text-slate-400 font-mono">{(reportData.sales || []).length} records</span>
            </div>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Customer</th>
                    {allShopsToggle && <th className="py-2.5 px-4">Shop</th>}
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                    <th className="py-2.5 px-4 text-right">Discount</th>
                    <th className="py-2.5 px-4 text-right">Tax</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4 text-right">Paid</th>
                    <th className="py-2.5 px-4 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.sales || []).map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-blue-600">{s.invoice_number}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{s.customer?.name || "Walk-in"}</td>
                      {allShopsToggle && (
                        <td className="py-2.5 px-4">
                          <span className="badge bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded">
                            {s.shop?.name || `Shop #${s.shop_id}`}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right font-mono">₹{Number(s.subtotal).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-600">₹{Number(s.discount_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹{Number(s.tax_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Number(s.total_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-semibold">₹{Number(s.paid_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-semibold">₹{Number(s.due_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "purchases" ? (
        /* ========================================================================= */
        /* 2. PURCHASES REPORT                                                       */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Purchases</div>
              <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                ₹{Number(reportData.summary?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">{reportData.summary?.count || 0} purchase orders</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Paid</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.summary?.paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Disbursed to suppliers</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Due to Suppliers</div>
              <div className="text-2xl font-mono font-bold text-rose-600 mt-1">
                ₹{Number(reportData.summary?.due || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Payables pending</div>
            </div>
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Discounts Received</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Number(reportData.summary?.discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Supplier concessions</div>
            </div>
          </div>

          {/* Top Suppliers Summary */}
          {reportData.bySupplier && reportData.bySupplier.length > 0 && (
            <div className="card p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">Purchases by Supplier</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {reportData.bySupplier.map((sup: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-800 truncate">{sup.name || `Supplier #${sup.supplierId}`}</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xs font-mono font-bold text-blue-600">₹{Number(sup.total).toFixed(2)}</span>
                      <span className="text-[11px] text-slate-400">{sup.count} POs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchases Table */}
          <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Purchase Bills & Stock Inward</h2>
              <span className="text-xs text-slate-400 font-mono">{(reportData.purchases || []).length} bills</span>
            </div>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">PO / Bill #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Supplier</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                    <th className="py-2.5 px-4 text-right">Discount</th>
                    <th className="py-2.5 px-4 text-right">Tax</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4 text-right">Paid</th>
                    <th className="py-2.5 px-4 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.purchases || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-blue-600">{p.purchase_number || `PO-${p.id}`}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(p.purchase_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{p.supplier?.name || "General Supplier"}</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹{Number(p.subtotal).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-600">₹{Number(p.discount_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹{Number(p.tax_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Number(p.total_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-semibold">₹{Number(p.paid_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-semibold">₹{Number(p.due_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "profit" ? (
        /* ========================================================================= */
        /* 3. GROSS PROFIT & MARGINS REPORT                                          */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</div>
              <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                ₹{Number(reportData.summary?.revenue ?? reportData.totalRevenue ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Net invoiced sales</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost of Goods (COGS)</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Number(reportData.summary?.cogs ?? reportData.totalCost ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Purchase cost of sold items</div>
            </div>
            <div className="card p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Gross Profit</div>
              <div className="text-2xl font-mono font-bold text-emerald-700 mt-1">
                ₹{Number(reportData.summary?.grossProfit ?? reportData.grossProfit ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-emerald-600 mt-1">Net gross earnings</div>
            </div>
            <div className="card p-5 bg-blue-50/70 border border-blue-200 rounded-xl">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Gross Margin %</div>
              <div className="text-2xl font-mono font-bold text-blue-700 mt-1">
                {Number(reportData.summary?.marginPercent ?? reportData.profitMarginPercent ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-blue-600 mt-1">Average profit margin</div>
            </div>
          </div>

          {/* Product-wise Profit Breakdown */}
          {reportData.byProduct && reportData.byProduct.length > 0 && (
            <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Product Profitability & Margins</h2>
                <span className="text-xs text-slate-400 font-mono">{reportData.byProduct.length} products</span>
              </div>
              <div className="table-wrap overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4 text-right">Revenue</th>
                      <th className="py-2.5 px-4 text-right">COGS (Cost)</th>
                      <th className="py-2.5 px-4 text-right">Gross Profit</th>
                      <th className="py-2.5 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.byProduct.map((p: any, idx: number) => {
                      const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name || `Product #${p.productId}`}</td>
                          <td className="py-2.5 px-4 text-right font-mono">₹{Number(p.revenue).toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-amber-600">₹{Number(p.cogs).toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">₹{Number(p.profit).toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "inventory" ? (
        /* ========================================================================= */
        /* 4. INVENTORY VALUATION REPORT                                             */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">In-Stock Units</div>
              <div className="text-2xl font-mono font-bold text-blue-600 mt-1">
                {reportData.summary?.totalUnits ?? reportData.totalUnits ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total physical inventory</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost Valuation</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.summary?.totalCostValue ?? reportData.valuationCost ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Purchase asset value</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Retail Valuation</div>
              <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                ₹{Number(reportData.summary?.totalSellValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Estimated sales value</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Warnings</div>
              <div className="text-2xl font-mono font-bold text-rose-600 mt-1">
                {reportData.summary?.lowStockCount ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">Below minimum threshold</div>
            </div>
          </div>

          <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Inventory Items & Valuation</h2>
              <span className="text-xs text-slate-400 font-mono">{(reportData.lines || reportData.items || []).length} items</span>
            </div>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4">SKU</th>
                    {allShopsToggle && <th className="py-2.5 px-4">Shop</th>}
                    <th className="py-2.5 px-4 text-right">Stock</th>
                    <th className="py-2.5 px-4 text-right">Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Selling Price</th>
                    <th className="py-2.5 px-4 text-right">Valuation (Cost)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.lines || reportData.items || []).map((item: any, idx: number) => {
                    const name = item.product?.name || item.product_name || "Item";
                    const sku = item.product?.sku || item.sku || "—";
                    const stock = item.currentStock ?? item.stock ?? 0;
                    const cost = Number(item.product?.purchase_price ?? item.purchase_price ?? 0);
                    const sell = Number(item.product?.selling_price ?? item.selling_price ?? 0);
                    const valCost = Number(item.costValue ?? stock * cost);
                    const isLow = item.isLowStock;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {name}
                          {isLow && <span className="ml-2 badge bg-rose-50 text-rose-600 text-[10px] px-1.5 py-0.5 rounded font-bold">Low</span>}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{sku}</td>
                        {allShopsToggle && (
                          <td className="py-2.5 px-4">
                            <span className="badge bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded">
                              {item.shop?.name || item.shop_name || "Shop"}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{stock}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">₹{cost.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">₹{sell.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">₹{valCost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "outstanding" ? (
        /* ========================================================================= */
        /* 5. CUSTOMER OUTSTANDING REPORT                                            */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Receivable</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.summary?.totalReceivable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Amount you will receive (You Get)</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Store Credit</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Math.abs(Number(reportData.summary?.totalCredit || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Customer advance balance (You Owe)</div>
            </div>
            <div className="card p-5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accounts with Balance</div>
              <div className="text-2xl font-mono font-bold text-blue-600 mt-1">
                {reportData.summary?.customerCount || (reportData.customers || []).length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Active ledger accounts</div>
            </div>
          </div>

          <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Customer Balances & Dues</h2>
              <Link to="/app/ledger" className="text-xs text-blue-600 hover:underline font-semibold">
                Open Customer Ledger →
              </Link>
            </div>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Customer Name</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4 text-right">Balance</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.customers || []).map((c: any, idx: number) => {
                    const custObj = c.customer || c;
                    const bal = Number(c.balance ?? c.current_balance ?? 0);
                    const isDue = bal > 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{custObj.name || "Customer"}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{custObj.phone || "—"}</td>
                        <td className={`py-2.5 px-4 text-right font-mono font-bold ${isDue ? "text-rose-600" : "text-emerald-600"}`}>
                          ₹{Math.abs(bal).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`badge px-2 py-0.5 rounded text-[11px] font-bold ${
                              isDue ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isDue ? "Due (Receivable)" : "Advance (Credit)"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Link
                            to={`/app/ledger?customerId=${custObj.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                          >
                            View Ledger
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "performance" ? (
        /* ========================================================================= */
        /* 6. SHOP PERFORMANCE REPORT                                                */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="card bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Multi-Shop Performance Benchmarks</h2>
              <span className="text-xs text-slate-400 font-mono">{(reportData.shops || []).length} branches</span>
            </div>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Shop Branch</th>
                    <th className="py-2.5 px-4">Branch Code</th>
                    <th className="py-2.5 px-4 text-right">Orders / Bills</th>
                    <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                    <th className="py-2.5 px-4 text-right">Collected</th>
                    <th className="py-2.5 px-4 text-right">Outstanding Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.shops || []).map((s: any, idx: number) => {
                    const shopName = s.shop?.name || s.name || `Shop #${s.shop_id || idx + 1}`;
                    const shopCode = s.shop?.code || s.code || "—";
                    const revenue = Number(s.revenue || 0);
                    const paid = Number(s.paid || (revenue - Number(s.due || 0)));
                    const due = Number(s.due || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{shopName}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{shopCode}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-700">{s.salesCount || 0}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{revenue.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-semibold">₹{paid.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-semibold">₹{due.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Reports() {
  return (
    <RequireModule module="reports">
      <ReportsInner />
    </RequireModule>
  );
}
