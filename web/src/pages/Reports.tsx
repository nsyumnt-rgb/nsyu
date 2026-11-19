import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  getSalesReport,
  getPurchaseReport,
  getProfitReport,
  getInventoryReport,
  getCustomerOutstandingReport,
  getShopPerformanceReport,
} from "../api/reports";
import { sendCustomerReminder } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import { Avatar, EmptyState, Icon, Meter, PageHeader, Segmented, StatCard, Switch, TONE, type IconName, type Tone } from "../components/ui";

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
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [reminderStatus, setReminderStatus] = useState<{ [id: number]: { ok: boolean; msg: string } }>({});

  const handleSendReminder = async (customerId: number) => {
    setRemindingId(customerId);
    try {
      const res = await sendCustomerReminder(customerId);
      setReminderStatus((prev) => ({ ...prev, [customerId]: { ok: true, msg: res.data?.message || "Reminder sent" } }));
      setTimeout(() => {
        setReminderStatus((prev) => {
          const next = { ...prev };
          delete next[customerId];
          return next;
        });
      }, 5000);
    } catch (err: any) {
      setReminderStatus((prev) => ({ ...prev, [customerId]: { ok: false, msg: apiErrorMessage(err, "Failed to send reminder") } }));
    } finally {
      setRemindingId(null);
    }
  };

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

  const tabs: { id: TabId; label: string; icon: IconName; tone: Tone }[] = [
    { id: "sales", label: "Sales", icon: "trend", tone: "brand" },
    { id: "purchases", label: "Purchases", icon: "truck", tone: "violet" },
    { id: "profit", label: "Gross profit", icon: "rupee", tone: "emerald" },
    { id: "inventory", label: "Stock valuation", icon: "layers", tone: "sky" },
    { id: "outstanding", label: "Customer dues", icon: "users", tone: "amber" },
    ...(isOwner ? [{ id: "performance" as TabId, label: "Shop performance", icon: "box" as IconName, tone: "slate" as Tone }] : []),
  ];

  const presets: [string, string, string][] = (() => {
    const d = new Date();
    const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const today = ymd(d);
    return [
      ["All time", "", ""],
      ["This month", ymd(new Date(d.getFullYear(), d.getMonth(), 1)), today],
      ["Last 30 days", ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29)), today],
      ["This year", ymd(new Date(d.getFullYear(), 0, 1)), today],
    ];
  })();
  const activePreset = presets.find(([, f, t]) => f === from && t === to)?.[0] ?? "Custom";

  const S = reportData?.summary ?? {};
  const rows = {
    sales: (reportData?.sales || []) as any[],
    purchases: (reportData?.purchases || []) as any[],
    profit: (reportData?.byProduct || []) as any[],
    inventory: (reportData?.lines || reportData?.items || []) as any[],
    outstanding: (reportData?.customers || []) as any[],
    performance: (reportData?.shops || []) as any[],
  };

  function exportCsv() {
    const d = (v: string) => (v ? new Date(v).toISOString().slice(0, 10) : "");
    let head: string[] = [];
    let body: (string | number)[][] = [];
    switch (activeTab) {
      case "sales":
        head = ["Invoice", "Date", "Customer", "Shop", "Subtotal", "Discount", "Tax", "Total", "Paid", "Due"];
        body = rows.sales.map((s) => [s.invoice_number, d(s.invoice_date), s.customer?.name || "Walk-in", s.shop?.name || "", s.subtotal, s.discount_amount, s.tax_amount, s.total_amount, s.paid_amount, s.due_amount]);
        break;
      case "purchases":
        head = ["Bill", "Date", "Supplier", "Subtotal", "Discount", "Tax", "Total", "Paid", "Due"];
        body = rows.purchases.map((p) => [p.purchase_number || `PO-${p.id}`, d(p.purchase_date), p.supplier?.name || "", p.subtotal, p.discount_amount, p.tax_amount, p.total_amount, p.paid_amount, p.due_amount]);
        break;
      case "profit":
        head = ["Product", "Revenue", "COGS", "Gross profit", "Margin %"];
        body = rows.profit.map((p) => [p.name || `Product #${p.productId}`, p.revenue, p.cogs, p.profit, p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0.0"]);
        break;
      case "inventory":
        head = ["Product", "SKU", "Shop", "Stock", "Unit cost", "Selling price", "Valuation (cost)", "Low stock"];
        body = rows.inventory.map((it) => {
          const stock = it.currentStock ?? it.stock ?? 0;
          const cost = Number(it.product?.purchase_price ?? it.purchase_price ?? 0);
          return [it.product?.name || it.product_name || "Item", it.product?.sku || it.sku || "", it.shop?.name || it.shop_name || "", stock, cost, Number(it.product?.selling_price ?? it.selling_price ?? 0), Number(it.costValue ?? stock * cost), it.isLowStock ? "yes" : ""];
        });
        break;
      case "outstanding":
        head = ["Customer", "Phone", "Balance", "Type", "Unpaid bills", "Overdue days", "Last payment date", "Last payment amount"];
        body = rows.outstanding.map((c) => {
          const o = c.customer || c;
          const bal = Number(c.balance ?? c.current_balance ?? c.outstandingAmount ?? 0);
          return [
            o.name || "Customer",
            o.phone || "",
            Math.abs(bal),
            bal > 0 ? "Due" : "Advance",
            Number(c.unpaidBillsCount || 0),
            Number(c.outstandingDays || 0),
            c.lastPaymentDate ? d(c.lastPaymentDate) : "",
            Number(c.lastPaymentAmount || 0),
          ];
        });
        break;
      case "performance":
        head = ["Shop", "Code", "Bills", "Revenue", "Collected", "Due"];
        body = rows.performance.map((s) => {
          const revenue = Number(s.revenue || 0);
          const due = Number(s.due || 0);
          return [s.shop?.name || s.name || "", s.shop?.code || s.code || "", s.salesCount || 0, revenue, Number(s.paid || revenue - due), due];
        });
        break;
    }
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-report${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentRows = rows[activeTab];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        subtitle="Sales, purchases, profit, stock value and dues — for any date range."
        actions={
          <>
            {isOwner && <Switch checked={allShopsToggle} onChange={setAllShopsToggle} label="All shops" />}
            <button type="button" onClick={exportCsv} disabled={loading || !reportData || currentRows.length === 0} className="btn-secondary">
              <Icon name="download" className="w-4 h-4 text-slate-500" /> Export CSV
            </button>
          </>
        }
      />

      {/* Report picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {tabs.map((t) => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${on ? "bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-card" : "bg-white/60 border-border hover:bg-white hover:border-brand-200"}`}
            >
              <span className={`w-8 h-8 rounded-lg ring-1 ring-inset flex items-center justify-center shrink-0 ${TONE[t.tone].tile}`}>
                <Icon name={t.icon} className="w-4 h-4" />
              </span>
              <span className={`text-[12.5px] font-semibold leading-tight ${on ? "text-navy-900" : "text-slate-600"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Range */}
      <div className="card px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={activePreset}
            onChange={(k) => {
              const p = presets.find(([l]) => l === k);
              if (p) {
                setFrom(p[1]);
                setTo(p[2]);
              }
            }}
            options={[...presets.map(([l]) => ({ key: l, label: l })), ...(activePreset === "Custom" ? [{ key: "Custom", label: "Custom" }] : [])]}
          />
          <span className="badge-inactive">{allShopsToggle ? "All shops" : activeShop?.name || "This shop"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
          <label className="flex items-center gap-1.5">
            From <input type="date" className="input w-auto py-1.5 text-[12.5px]" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5">
            To <input type="date" className="input w-auto py-1.5 text-[12.5px]" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[104px] rounded-card bg-white border border-border" />)}
          </div>
          <div className="h-72 rounded-card bg-white border border-border" />
        </div>
      ) : !reportData ? (
        <div className="card"><EmptyState icon="file" title="No data for this period" text="Try a wider date range." /></div>
      ) : activeTab === "sales" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Invoiced" icon="receipt" tone="brand" value={inr0(S.total)} hint={`${S.count || 0} invoices`} />
            <StatCard label="Collected" icon="wallet" tone="emerald" value={inr0(S.paid)} valueClass="text-emerald-600" footer={<CollectBar paid={S.paid} total={S.total} />} />
            <StatCard label="Due" icon="clock" tone="rose" value={inr0(S.due)} valueClass={Number(S.due) ? "text-rose-600" : undefined} hint="Pending collection" />
            <StatCard label="Discounts given" icon="sparkle" tone="amber" value={inr0(S.discount)} hint="Customer concessions" />
          </div>
          <ReportTable title="Invoices" count={rows.sales.length} noun="invoices">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                {allShopsToggle && <th>Shop</th>}
                <th className="!text-right">Subtotal</th>
                <th className="!text-right">Discount</th>
                <th className="!text-right">Tax</th>
                <th className="!text-right">Total</th>
                <th className="!text-right">Paid</th>
                <th className="!text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.sales.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">
                    <Link to={`/app/sales/${s.id}`} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline">{s.invoice_number}</Link>
                    <div className="text-[11.5px] text-slate-400">{fmtDate(s.invoice_date)}</div>
                  </td>
                  <td className="font-medium text-navy-900 max-w-[200px] truncate">{s.customer?.name || "Walk-in"}</td>
                  {allShopsToggle && <td><span className="badge-inactive">{s.shop?.name || `Shop #${s.shop_id}`}</span></td>}
                  <Money v={s.subtotal} />
                  <Money v={s.discount_amount} cls="text-amber-600" dashZero />
                  <Money v={s.tax_amount} dashZero />
                  <Money v={s.total_amount} cls="font-bold text-navy-900" />
                  <Money v={s.paid_amount} cls="text-emerald-600 font-semibold" />
                  <Money v={s.due_amount} cls="text-rose-600 font-semibold" dashZero />
                </tr>
              ))}
            </tbody>
          </ReportTable>
        </div>
      ) : activeTab === "purchases" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Total purchases" icon="truck" tone="violet" value={inr0(S.total)} hint={`${S.count || 0} bills`} />
            <StatCard label="Paid" icon="wallet" tone="emerald" value={inr0(S.paid)} valueClass="text-emerald-600" footer={<CollectBar paid={S.paid} total={S.total} />} />
            <StatCard label="Due to suppliers" icon="clock" tone="rose" value={inr0(S.due)} valueClass={Number(S.due) ? "text-rose-600" : undefined} hint="Payables pending" />
            <StatCard label="Discounts received" icon="sparkle" tone="amber" value={inr0(S.discount)} hint="Supplier concessions" />
          </div>

          {reportData.bySupplier && reportData.bySupplier.length > 0 && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title text-[14px]">By supplier</h2>
                <span className="text-[12px] text-slate-400">{reportData.bySupplier.length} suppliers</span>
              </div>
              <BarList
                items={reportData.bySupplier.map((sup: any) => ({ label: sup.name || `Supplier #${sup.supplierId}`, value: Number(sup.total) || 0, note: `${sup.count} bill${sup.count === 1 ? "" : "s"}` }))}
                tone="violet"
              />
            </section>
          )}

          <ReportTable title="Purchase bills" count={rows.purchases.length} noun="bills">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Supplier</th>
                <th className="!text-right">Subtotal</th>
                <th className="!text-right">Discount</th>
                <th className="!text-right">Tax</th>
                <th className="!text-right">Total</th>
                <th className="!text-right">Paid</th>
                <th className="!text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.purchases.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    <Link to={`/app/purchase/${p.id}`} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline">{p.purchase_number || `PO-${p.id}`}</Link>
                    <div className="text-[11.5px] text-slate-400">{fmtDate(p.purchase_date)}</div>
                  </td>
                  <td className="font-medium text-navy-900 max-w-[200px] truncate">{p.supplier?.name || "General supplier"}</td>
                  <Money v={p.subtotal} />
                  <Money v={p.discount_amount} cls="text-amber-600" dashZero />
                  <Money v={p.tax_amount} dashZero />
                  <Money v={p.total_amount} cls="font-bold text-navy-900" />
                  <Money v={p.paid_amount} cls="text-emerald-600 font-semibold" />
                  <Money v={p.due_amount} cls="text-rose-600 font-semibold" dashZero />
                </tr>
              ))}
            </tbody>
          </ReportTable>
        </div>
      ) : activeTab === "profit" ? (
        (() => {
          const revenue = Number(S.revenue ?? reportData.totalRevenue ?? 0);
          const cogs = Number(S.cogs ?? reportData.totalCost ?? 0);
          const gp = Number(S.grossProfit ?? reportData.grossProfit ?? 0);
          const margin = Number(S.marginPercent ?? reportData.profitMarginPercent ?? 0);
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Revenue" icon="trend" tone="brand" value={inr0(revenue)} hint="Net invoiced sales" />
                <StatCard label="Cost of goods" icon="truck" tone="amber" value={inr0(cogs)} hint="Purchase cost of items sold" />
                <StatCard label="Gross profit" icon="rupee" tone="emerald" value={inr0(gp)} valueClass={gp >= 0 ? "text-emerald-600" : "text-rose-600"} hint="Revenue − cost" />
                <StatCard
                  label="Gross margin"
                  icon="sparkle"
                  tone="sky"
                  value={`${margin.toFixed(1)}%`}
                  footer={<Meter value={Math.max(0, margin)} max={100} tone="sky" className="mt-0.5" />}
                />
              </div>
              {rows.profit.length > 0 ? (
                <ReportTable title="Profit by product" count={rows.profit.length} noun="products">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="!text-right">Revenue</th>
                      <th className="!text-right">Cost</th>
                      <th className="!text-right">Gross profit</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.profit.map((p, idx) => {
                      const m = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                      return (
                        <tr key={idx}>
                          <td className="font-semibold text-navy-900 max-w-[260px] truncate">{p.name || `Product #${p.productId}`}</td>
                          <Money v={p.revenue} />
                          <Money v={p.cogs} cls="text-amber-600" />
                          <Money v={p.profit} cls={`font-bold ${Number(p.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
                          <td>
                            <div className="w-[120px]">
                              <div className={`text-[12.5px] font-bold tabular ${m >= 0 ? "text-navy-900" : "text-rose-600"}`}>{m.toFixed(1)}%</div>
                              <Meter value={Math.max(0, m)} max={100} tone={m >= 25 ? "emerald" : m >= 10 ? "amber" : "rose"} className="mt-1" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ReportTable>
              ) : (
                <div className="card"><EmptyState icon="rupee" title="No product sales in this range" /></div>
              )}
            </div>
          );
        })()
      ) : activeTab === "inventory" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Units in stock" icon="box" tone="sky" value={Number(S.totalUnits ?? reportData.totalUnits ?? 0).toLocaleString("en-IN")} hint="Total physical inventory" />
            <StatCard label="Value at cost" icon="rupee" tone="violet" value={inr0(S.totalCostValue ?? reportData.valuationCost)} hint="What you paid" />
            <StatCard label="Value at selling price" icon="trend" tone="emerald" value={inr0(S.totalSellValue)} hint={Number(S.totalSellValue) && Number(S.totalCostValue) ? `${inr0(Number(S.totalSellValue) - Number(S.totalCostValue))} potential margin` : "Estimated sales value"} />
            <StatCard label="Low stock" icon="alert" tone="rose" value={String(S.lowStockCount ?? 0)} valueClass={Number(S.lowStockCount) ? "text-rose-600" : undefined} to="/app/inventory?tab=low" hint="Below minimum level" />
          </div>
          <ReportTable title="Stock valuation" count={rows.inventory.length} noun="items">
            <thead>
              <tr>
                <th>Product</th>
                {allShopsToggle && <th>Shop</th>}
                <th className="!text-right">Stock</th>
                <th className="!text-right">Unit cost</th>
                <th className="!text-right">Selling price</th>
                <th className="!text-right">Value (cost)</th>
              </tr>
            </thead>
            <tbody>
              {rows.inventory.map((item, idx) => {
                const stock = item.currentStock ?? item.stock ?? 0;
                const cost = Number(item.product?.purchase_price ?? item.purchase_price ?? 0);
                const sell = Number(item.product?.selling_price ?? item.selling_price ?? 0);
                const valCost = Number(item.costValue ?? stock * cost);
                return (
                  <tr key={idx}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy-900 truncate max-w-[240px]">{item.product?.name || item.product_name || "Item"}</span>
                        {item.isLowStock && <span className="badge-danger">Low</span>}
                      </div>
                      <div className="font-mono text-[11.5px] text-slate-400">{item.product?.sku || item.sku || "—"}</div>
                    </td>
                    {allShopsToggle && <td><span className="badge-inactive">{item.shop?.name || item.shop_name || "Shop"}</span></td>}
                    <td className={`text-right font-bold tabular ${item.isLowStock ? "text-rose-600" : "text-navy-900"}`}>{stock}</td>
                    <Money v={cost} cls="text-slate-600" />
                    <Money v={sell} cls="text-slate-600" />
                    <Money v={valCost} cls="font-bold text-navy-900" />
                  </tr>
                );
              })}
            </tbody>
          </ReportTable>
        </div>
      ) : activeTab === "outstanding" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="To receive" icon="wallet" tone="rose" value={inr0(S.totalReceivable)} valueClass={Number(S.totalReceivable) ? "text-rose-600" : undefined} hint="Customers owe you" />
            <StatCard label="Advances held" icon="rupee" tone="emerald" value={inr0(Math.abs(Number(S.totalCredit || 0)))} hint="You owe customers" />
            <StatCard label="Accounts with balance" icon="users" tone="brand" value={String(S.customerCount || rows.outstanding.length)} to="/app/ledger" hint="Open customer ledger" />
          </div>
          {rows.outstanding.length === 0 ? (
            <div className="card"><EmptyState icon="checkCircle" tone="emerald" title="All settled" text="No customer has a balance." /></div>
          ) : (
            <ReportTable title="Customer balances & defaulters" count={rows.outstanding.length} noun="customers">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Balance</th>
                  <th>Pending bills & aging</th>
                  <th>Last payment</th>
                  <th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxBal = Math.max(1, ...rows.outstanding.map((c) => Math.abs(Number(c.balance ?? c.current_balance ?? 0))));
                  return rows.outstanding.map((c, idx) => {
                    const o = c.customer || c;
                    const bal = Number(c.balance ?? c.current_balance ?? c.outstandingAmount ?? 0);
                    const due = bal > 0;
                    const unpaidCount = Number(c.unpaidBillsCount || 0);
                    const days = Number(c.outstandingDays || 0);
                    const status = o.id ? reminderStatus[o.id] : undefined;
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={o.name || "Customer"} size="sm" />
                            <div className="min-w-0">
                              <div className="font-semibold text-navy-900 truncate max-w-[200px]">{o.name || "Customer"}</div>
                              <div className="text-[11.5px] text-slate-400 tabular">{o.phone || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="w-[160px]">
                            <div className="flex items-baseline justify-between">
                              <span className={`font-bold tabular ${due ? "text-rose-600" : "text-emerald-600"}`}>{inr2(Math.abs(bal))}</span>
                              <span className="text-[10.5px] font-semibold uppercase text-slate-400">{due ? "Due" : "Advance"}</span>
                            </div>
                            <Meter value={Math.abs(bal)} max={maxBal} tone={due ? "rose" : "emerald"} className="mt-1" />
                          </div>
                        </td>
                        <td>
                          {due ? (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-800">
                                {unpaidCount > 0 ? `${unpaidCount} unpaid bill${unpaidCount > 1 ? "s" : ""}` : "Unpaid balance"}
                              </div>
                              {days > 0 ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${days > 30 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                                  {days}d overdue
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Current</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-700 font-medium">Customer advance credit</span>
                          )}
                        </td>
                        <td>
                          {c.lastPaymentDate ? (
                            <div>
                              <div className="text-xs font-bold text-navy-900 tabular">{inr2(c.lastPaymentAmount)}</div>
                              <div className="text-[11px] text-slate-400">{fmtDate(c.lastPaymentDate)}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/app/ledger?customerId=${o.id}`} className="btn-soft btn-sm">
                              <Icon name="file" className="w-3.5 h-3.5" /> Ledger
                            </Link>
                            {due && o.id && (
                              <button
                                type="button"
                                disabled={remindingId === o.id}
                                onClick={() => handleSendReminder(o.id)}
                                className="btn-sm rounded-xl font-semibold inline-flex items-center gap-1.5 transition text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50"
                                title="Send payment reminder notification & email"
                              >
                                {remindingId === o.id ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    Sending…
                                  </>
                                ) : (
                                  <>
                                    <Icon name="bell" className="w-3.5 h-3.5 text-emerald-600" />
                                    Remind
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          {status && (
                            <div className={`text-[11px] font-medium mt-1.5 ${status.ok ? "text-emerald-700" : "text-rose-600"}`}>
                              {status.msg}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </ReportTable>
          )}
        </div>
      ) : activeTab === "performance" ? (
        rows.performance.length === 0 ? (
          <div className="card"><EmptyState icon="box" title="No shop data in this range" /></div>
        ) : (
          <div className="space-y-5">
            <section className="card">
              <div className="card-header">
                <h2 className="card-title text-[14px]">Revenue by shop</h2>
                <span className="text-[12px] text-slate-400">{rows.performance.length} shops</span>
              </div>
              <BarList
                tone="brand"
                items={rows.performance.map((s, idx) => ({
                  label: s.shop?.name || s.name || `Shop #${s.shop_id || idx + 1}`,
                  value: Number(s.revenue || 0),
                  note: `${s.salesCount || 0} bills · ${inr0(Number(s.due || 0))} due`,
                }))}
              />
            </section>
            <ReportTable title="Shop comparison" count={rows.performance.length} noun="shops">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th className="!text-right">Bills</th>
                  <th className="!text-right">Revenue</th>
                  <th className="!text-right">Collected</th>
                  <th className="!text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.performance.map((s, idx) => {
                  const revenue = Number(s.revenue || 0);
                  const due = Number(s.due || 0);
                  const paid = Number(s.paid || revenue - due);
                  return (
                    <tr key={idx}>
                      <td>
                        <div className="font-semibold text-navy-900">{s.shop?.name || s.name || `Shop #${s.shop_id || idx + 1}`}</div>
                        <div className="font-mono text-[11.5px] text-slate-400">{s.shop?.code || s.code || "—"}</div>
                      </td>
                      <td className="text-right tabular text-slate-700">{s.salesCount || 0}</td>
                      <Money v={revenue} cls="font-bold text-navy-900" />
                      <Money v={paid} cls="text-emerald-600 font-semibold" />
                      <Money v={due} cls="text-rose-600 font-semibold" dashZero />
                    </tr>
                  );
                })}
              </tbody>
            </ReportTable>
          </div>
        )
      ) : null}
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

type TabId = "sales" | "purchases" | "profit" | "inventory" | "outstanding" | "performance";

const inr0 = (n: unknown) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const inr2 = (n: unknown) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Money({ v, cls = "text-slate-700", dashZero }: { v: unknown; cls?: string; dashZero?: boolean }) {
  const n = Number(v) || 0;
  return <td className={`text-right whitespace-nowrap tabular ${cls}`}>{dashZero && n === 0 ? <span className="text-slate-300 font-normal">—</span> : inr2(n)}</td>;
}

function CollectBar({ paid, total }: { paid: unknown; total: unknown }) {
  const p = Number(paid) || 0;
  const t = Number(total) || 0;
  return (
    <div className="flex items-center gap-2">
      <Meter value={p} max={t} tone="emerald" className="flex-1" />
      <span className="tabular text-slate-500">{t > 0 ? Math.round((p / t) * 100) : 0}%</span>
    </div>
  );
}

function ReportTable({ title, count, noun, children }: { title: string; count: number; noun: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <h2 className="card-title text-[14px]">{title}</h2>
        <span className="text-[12px] text-slate-400 tabular">{count.toLocaleString("en-IN")} {noun}</span>
      </div>
      {count === 0 ? (
        <EmptyState compact icon="file" title={`No ${noun} in this range`} text="Try a wider date range." />
      ) : (
        <div className="overflow-x-auto">
          <table>{children}</table>
        </div>
      )}
    </section>
  );
}

function BarList({ items, tone }: { items: { label: string; value: number; note?: string }[]; tone: Tone }) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 8);
  const max = Math.max(1, ...sorted.map((i) => i.value));
  return (
    <ul className="p-4 sm:p-5 space-y-3">
      {sorted.map((i, idx) => (
        <li key={idx}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold text-navy-900 truncate">{i.label}</span>
            <span className="font-bold text-navy-900 tabular whitespace-nowrap">{inr0(i.value)}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Meter value={i.value} max={max} tone={tone} className="flex-1 !h-2" />
            {i.note && <span className="text-[11.5px] text-slate-400 whitespace-nowrap">{i.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}


export default function Reports() {
  return (
    <RequireModule module="reports">
      <ReportsInner />
    </RequireModule>
  );
}
