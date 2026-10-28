import { useEffect, useState } from "react";
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

  const [activeTab, setActiveTab] = useState<"sales" | "purchases" | "profit" | "inventory" | "outstanding" | "performance">("sales");
  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Date range filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Business Intelligence & Reports</h1>
          <p className="text-sm text-muted mt-1">
            Financial analytics, gross profit, inventory valuation, and multi-shop performance.
          </p>
        </div>

        {isOwner && (
          <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={allShopsToggle}
              onChange={(e) => setAllShopsToggle(e.target.checked)}
              className="rounded border-border text-accent-600 focus:ring-accent-500"
            />
            Consolidated (All Shops)
          </label>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border gap-2 sm:gap-4">
        {[
          { id: "sales", label: "Sales Analytics" },
          { id: "purchases", label: "Purchases" },
          { id: "profit", label: "Gross Profit & Margins" },
          { id: "inventory", label: "Inventory Valuation" },
          { id: "outstanding", label: "Customer Outstanding" },
          ...(isOwner ? [{ id: "performance", label: "Shop Performance" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 px-1 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-accent-600 text-accent-600"
                : "border-transparent text-muted hover:text-ink-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted uppercase">Scope:</span>
          <span className="badge bg-ink-100 text-ink-800 font-mono text-xs">
            {allShopsToggle ? "All Authorized Shops (Consolidated)" : activeShop?.name || "Selected Shop"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted">From:</label>
          <input
            type="date"
            className="input py-1 text-xs font-mono"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label className="text-muted ml-2">To:</label>
          <input
            type="date"
            className="input py-1 text-xs font-mono"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="text-accent-600 hover:underline ml-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Content based on Active Tab */}
      {loading ? (
        <div className="card p-12 text-center text-muted">Calculating reports from database…</div>
      ) : !reportData ? (
        <div className="card p-12 text-center text-muted">No data available for this period.</div>
      ) : activeTab === "sales" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-xs font-semibold text-muted uppercase">Invoiced Revenue</div>
              <div className="text-2xl font-mono font-bold text-accent-700 mt-1">
                ₹{Number(reportData.summary?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted mt-1">{reportData.summary?.count || 0} sales total</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-muted uppercase">Amount Collected</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.summary?.paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-muted uppercase">Due Balance</div>
              <div className="text-2xl font-mono font-bold text-danger mt-1">
                ₹{Number(reportData.summary?.due || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-muted uppercase">Discounts Given</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Number(reportData.summary?.discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  {allShopsToggle && <th>Shop</th>}
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.sales || []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-medium text-accent-600">{s.invoice_number}</td>
                    <td className="text-xs text-muted">
                      {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="font-medium text-ink-900">{s.customer?.name || "Walk-in"}</td>
                    {allShopsToggle && (
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {s.shop?.name || `Shop #${s.shop_id}`}
                        </span>
                      </td>
                    )}
                    <td className="text-right font-mono">₹{Number(s.subtotal).toFixed(2)}</td>
                    <td className="text-right font-mono text-amber-600">₹{Number(s.discount_amount).toFixed(2)}</td>
                    <td className="text-right font-mono">₹{Number(s.tax_amount).toFixed(2)}</td>
                    <td className="text-right font-mono font-bold">₹{Number(s.total_amount).toFixed(2)}</td>
                    <td className="text-right font-mono text-emerald-600">₹{Number(s.paid_amount).toFixed(2)}</td>
                    <td className="text-right font-mono text-danger font-medium">₹{Number(s.due_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "profit" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="text-xs font-semibold text-muted uppercase">Total Revenue</div>
              <div className="text-2xl font-mono font-bold text-ink-900 mt-1">
                ₹{Number(reportData.totalRevenue || 0).toFixed(2)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold text-muted uppercase">Cost of Goods Sold (COGS)</div>
              <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                ₹{Number(reportData.totalCost || 0).toFixed(2)}
              </div>
            </div>
            <div className="card p-5 bg-emerald-50/50 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-800 uppercase">Gross Profit</div>
              <div className="text-2xl font-mono font-bold text-emerald-700 mt-1">
                ₹{Number(reportData.grossProfit || 0).toFixed(2)}
              </div>
              <div className="text-xs text-emerald-600 mt-1">
                Margin: {reportData.profitMarginPercent ? `${reportData.profitMarginPercent}%` : "—"}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "inventory" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="text-xs font-semibold text-muted uppercase">Total In-Stock Units</div>
              <div className="text-2xl font-mono font-bold text-accent-700 mt-1">
                {reportData.totalUnits || 0}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold text-muted uppercase">Total Stock Valuation (Cost)</div>
              <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
                ₹{Number(reportData.valuationCost || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  {allShopsToggle && <th>Shop</th>}
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total Valuation</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.items || []).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-medium text-ink-900">{item.product_name}</td>
                    <td className="font-mono text-xs">{item.sku}</td>
                    {allShopsToggle && (
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {item.shop_name}
                        </span>
                      </td>
                    )}
                    <td className="text-right font-mono font-bold">{item.stock}</td>
                    <td className="text-right font-mono">₹{Number(item.purchase_price || 0).toFixed(2)}</td>
                    <td className="text-right font-mono font-bold text-emerald-700">
                      ₹{Number((item.stock || 0) * (item.purchase_price || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "performance" ? (
        <div className="space-y-4">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Code</th>
                  <th className="text-right">Total Sales</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.shops || []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="font-medium text-ink-900">{s.name}</td>
                    <td className="font-mono text-xs">{s.code}</td>
                    <td className="text-right font-mono">{s.salesCount || 0}</td>
                    <td className="text-right font-mono font-bold">₹{Number(s.revenue || 0).toFixed(2)}</td>
                    <td className="text-right font-mono text-emerald-600">₹{Number(s.paid || 0).toFixed(2)}</td>
                    <td className="text-right font-mono text-danger font-medium">₹{Number(s.due || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          <pre className="text-xs font-mono overflow-x-auto text-muted">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}
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
