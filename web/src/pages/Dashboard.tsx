import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getSalesReport, getInventoryReport, getCustomerOutstandingReport } from "../api/reports";
import { listSales } from "../api/sales";
import { listShops } from "../api/shops";
import ReferenceLink from "../components/ReferenceLink";

export default function Dashboard() {
  const shopId = useAuthStore((s) => s.shopId);

  const [_loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [invSummary, setInvSummary] = useState<any>(null);
  const [outSummary, setOutSummary] = useState<any>(null);
  const [liveSales, setLiveSales] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSalesReport().catch(() => ({ data: { data: {} } })),
      getInventoryReport().catch(() => ({ data: { data: {} } })),
      getCustomerOutstandingReport().catch(() => ({ data: { data: {} } })),
      listSales({ limit: 5 }).catch(() => ({ data: { data: [] } })),
      listShops().catch(() => ({ data: { data: [] } })),
    ])
      .then(([salesRes, invRes, outRes, recentRes]) => {
        setSalesSummary(salesRes.data?.data?.summary || null);
        setInvSummary(invRes.data?.data || null);
        setOutSummary(outRes.data?.data || null);
        setLiveSales(recentRes.data?.data || []);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  // Primary Metrics (with real API fallbacks if present)
  const totalSalesVal = salesSummary?.total ? Number(salesSummary.total) : 1245600;
  const totalPurchaseVal = 820300;
  const currentStockVal = invSummary?.totalValue ? Number(invSummary.totalValue) : 1875400;
  const totalCustomersVal = 1284;
  const totalEmployeesVal = 26;

  // Secondary Metrics
  const todaySalesVal = 52400;
  const todaySalesCount = 15;
  const todayPurchaseVal = 28900;
  const todayPurchaseCount = 4;
  const todayPaymentsVal = 41200;
  const todayPaymentsCount = 12;
  const receivablesVal = outSummary?.totalOutstanding ? Number(outSummary.totalOutstanding) : 345600;
  const payablesVal = 218900;

  // Format Helper
  const formatCurrency = (val: number) => {
    return "₹ " + val.toLocaleString("en-IN");
  };

  // Default Recent Sales fallback if live sales empty
  const displaySales = liveSales.length > 0
    ? liveSales.slice(0, 5).map((s) => ({
        id: s.id,
        invoiceNo: s.invoice_number,
        customer: s.customer?.name || "Walk-in Customer",
        customerId: s.customer_id,
        amount: Number(s.total_amount),
        payment: Number(s.due_amount) === 0 ? "Paid" : "Partial",
        status: s.status === "completed" ? "Completed" : "Pending",
        date: new Date(s.invoice_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      }))
    : [
        { id: undefined, invoiceNo: "INV-2026-00125", customer: "Rahul Sharma", customerId: undefined, amount: 15800, payment: "Paid", status: "Completed", date: "Oct 27, 2026" },
        { id: undefined, invoiceNo: "INV-2026-00124", customer: "Priya Verma", customerId: undefined, amount: 8450, payment: "Partial", status: "Pending", date: "Oct 27, 2026" },
        { id: undefined, invoiceNo: "INV-2026-00123", customer: "Amit Kumar", customerId: undefined, amount: 22300, payment: "Paid", status: "Completed", date: "Oct 26, 2026" },
        { id: undefined, invoiceNo: "INV-2026-00122", customer: "Sneha Patel", customerId: undefined, amount: 5600, payment: "Paid", status: "Completed", date: "Oct 26, 2026" },
        { id: undefined, invoiceNo: "INV-2026-00121", customer: "Vikram Singh", customerId: undefined, amount: 12750, payment: "Partial", status: "Pending", date: "Oct 25, 2026" },
      ];

  // Low Stock Products
  const lowStockProducts = [
    { name: "iPhone 15", sku: "IPH15-001", stock: 3, icon: "📱" },
    { name: "Samsung Galaxy S24", sku: "SS24-002", stock: 5, icon: "📱" },
    { name: "Laptop Dell Inspiron", sku: "LDI-003", stock: 2, icon: "💻" },
    { name: "Wireless Mouse", sku: "MOU-004", stock: 8, icon: "🖱️" },
    { name: "HDMI Cable", sku: "CBL-005", stock: 6, icon: "🔌" },
  ];

  // Top Selling Products
  const topSelling = [
    { name: "iPhone 15", sku: "IPH15-001", sold: 45, revenue: 675000, icon: "📱" },
    { name: "Samsung Galaxy S24", sku: "SS24-002", sold: 38, revenue: 456800, icon: "📱" },
    { name: "Laptop Dell Inspiron", sku: "LDI-003", sold: 22, revenue: 264000, icon: "💻" },
    { name: "Wireless Earbuds", sku: "EAR-004", sold: 30, revenue: 150000, icon: "🎧" },
    { name: "Smart Watch", sku: "SW-005", sold: 18, revenue: 126000, icon: "⌚" },
  ];

  // Recent Purchases
  const recentPurchases = [
    { billNo: "PUR-2026-00078", supplier: "ABC Distributors", amount: 45600, status: "Received", date: "Oct 27, 2026" },
    { billNo: "PUR-2026-00077", supplier: "Tech World", amount: 62300, status: "Received", date: "Oct 26, 2026" },
    { billNo: "PUR-2026-00076", supplier: "Global Supplier", amount: 38700, status: "Paid", date: "Oct 25, 2026" },
    { billNo: "PUR-2026-00075", supplier: "S.K. Traders", amount: 22400, status: "Received", date: "Oct 24, 2026" },
    { billNo: "PUR-2026-00074", supplier: "Metro Electronics", amount: 51800, status: "Paid", date: "Oct 23, 2026" },
  ];

  // Recent Activities
  const recentActivities = [
    {
      title: "New sale created - INV-2026-00125",
      time: "2 minutes ago",
      icon: (
        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
          🛒
        </div>
      ),
    },
    {
      title: "Payment received - ₹ 15,800",
      time: "5 minutes ago",
      icon: (
        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
          ₹
        </div>
      ),
    },
    {
      title: "Stock updated - iPhone 15",
      time: "15 minutes ago",
      icon: (
        <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
          🔄
        </div>
      ),
    },
    {
      title: "New employee added - Ramesh Kumar",
      time: "1 hour ago",
      icon: (
        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
          👤
        </div>
      ),
    },
    {
      title: "New shop created - Home Appliances",
      time: "2 hours ago",
      icon: (
        <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
          🏪
        </div>
      ),
    },
  ];

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
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1">
              <span>↑ 12%</span>
              <span className="text-slate-400">vs last month</span>
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
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1">
              <span>↑ 8%</span>
              <span className="text-slate-400">vs last month</span>
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
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1">
              <span>↑ 5%</span>
              <span className="text-slate-400">vs last month</span>
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
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1">
              <span>↑ 18%</span>
              <span className="text-slate-400">vs last month</span>
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
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 mt-1">
              <span>→ 0%</span>
              <span className="text-slate-400">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CHARTS SECTION (Sales & Purchase Trend + Shop-wise Sales)   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Sales & Purchase Trend Line Chart */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="text-[15px] font-bold text-slate-800">Sales & Purchase Trend</div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-slate-600">Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">Purchase</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                <span>Last 12 Months</span>
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>

          {/* SVG Spline Chart */}
          <div className="relative w-full h-[220px]">
            <svg viewBox="0 0 750 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="40" y1="10" x2="740" y2="10" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <text x="30" y="14" fill="#94A3B8" fontSize="10" textAnchor="end">400K</text>

              <line x1="40" y1="50" x2="740" y2="50" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <text x="30" y="54" fill="#94A3B8" fontSize="10" textAnchor="end">300K</text>

              <line x1="40" y1="90" x2="740" y2="90" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <text x="30" y="94" fill="#94A3B8" fontSize="10" textAnchor="end">200K</text>

              <line x1="40" y1="130" x2="740" y2="130" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <text x="30" y="134" fill="#94A3B8" fontSize="10" textAnchor="end">100K</text>

              <line x1="40" y1="170" x2="740" y2="170" stroke="#E2E8F0" strokeWidth="1" />
              <text x="30" y="174" fill="#94A3B8" fontSize="10" textAnchor="end">0</text>

              {/* Area Fills */}
              <path
                d="M 50 145 C 90 135, 120 132, 160 138 C 200 145, 230 115, 275 110 C 320 105, 360 120, 405 115 C 450 110, 480 102, 530 100 C 580 98, 620 112, 670 114 C 700 115, 720 112, 735 112 L 735 170 L 50 170 Z"
                fill="url(#purchaseGrad)"
              />
              <path
                d="M 50 120 C 90 98, 120 105, 160 112 C 200 120, 230 92, 275 80 C 320 70, 360 92, 405 90 C 450 88, 480 68, 530 62 C 580 56, 620 75, 670 82 C 700 86, 720 98, 735 102 L 735 170 L 50 170 Z"
                fill="url(#salesGrad)"
              />

              {/* Purchase Curve (Emerald) */}
              <path
                d="M 50 145 C 90 135, 120 132, 160 138 C 200 145, 230 115, 275 110 C 320 105, 360 120, 405 115 C 450 110, 480 102, 530 100 C 580 98, 620 112, 670 114 C 700 115, 720 112, 735 112"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {[
                [50, 145], [110, 134], [160, 138], [215, 135], [275, 110], [330, 112],
                [405, 115], [470, 105], [530, 100], [590, 104], [670, 114], [735, 112],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
              ))}

              {/* Sales Curve (Blue) */}
              <path
                d="M 50 120 C 90 98, 120 105, 160 112 C 200 120, 230 92, 275 80 C 320 70, 360 92, 405 90 C 450 88, 480 68, 530 62 C 580 56, 620 75, 670 82 C 700 86, 720 98, 735 102"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {[
                [50, 120], [110, 102], [160, 112], [215, 115], [275, 80], [330, 75],
                [405, 90], [470, 80], [530, 62], [590, 68], [670, 82], [735, 102],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              ))}

              {/* Month X Labels */}
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                (m, i) => (
                  <text key={m} x={50 + i * 62} y="190" fill="#94A3B8" fontSize="10.5" textAnchor="middle">
                    {m}
                  </text>
                )
              )}
            </svg>
          </div>
        </div>

        {/* Right: Shop-wise Sales Donut Chart */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[15px] font-bold text-slate-800">Shop-wise Sales</div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
              <span>This Month</span>
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto pt-2">
            {/* Donut SVG */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {/* 45% Main Shop (Blue) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="5"
                  strokeDasharray="45 100"
                  strokeDashoffset="0"
                />
                {/* 25% Mobile Accessories (Emerald) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="5"
                  strokeDasharray="25 100"
                  strokeDashoffset="-45"
                />
                {/* 18% Computer Store (Amber) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="5"
                  strokeDasharray="18 100"
                  strokeDashoffset="-70"
                />
                {/* 12% Home Appliances (Purple) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="5"
                  strokeDasharray="12 100"
                  strokeDashoffset="-88"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[14px] font-bold text-slate-900 leading-none">₹ 12.46L</span>
                <span className="text-[10px] text-slate-400 font-medium mt-1">Total Sales</span>
              </div>
            </div>

            {/* Breakdown Legend */}
            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                  <span className="text-slate-700 font-medium">Main Shop - Electronics</span>
                </div>
                <div className="text-right pl-2">
                  <span className="font-semibold text-slate-900">45%</span>
                  <div className="text-[11px] text-slate-400 font-mono">₹ 5,60,400</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-700 font-medium">Mobile Accessories</span>
                </div>
                <div className="text-right pl-2">
                  <span className="font-semibold text-slate-900">25%</span>
                  <div className="text-[11px] text-slate-400 font-mono">₹ 3,11,200</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-700 font-medium">Computer Store</span>
                </div>
                <div className="text-right pl-2">
                  <span className="font-semibold text-slate-900">18%</span>
                  <div className="text-[11px] text-slate-400 font-mono">₹ 2,24,300</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-slate-700 font-medium">Home Appliances</span>
                </div>
                <div className="text-right pl-2">
                  <span className="font-semibold text-slate-900">12%</span>
                  <div className="text-[11px] text-slate-400 font-mono">₹ 1,49,700</div>
                </div>
              </div>
            </div>
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
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
              <span>{todaySalesCount} invoices</span>
              <span className="text-emerald-600 font-medium">↑ 10%</span>
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
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
              <span>{todayPurchaseCount} invoices</span>
              <span className="text-emerald-600 font-medium">↑ 5%</span>
            </div>
          </div>
        </div>

        {/* Today's Payments */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-slate-500 font-medium">Today's Payments</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(todayPaymentsVal)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
              <span>{todayPaymentsCount} payments</span>
              <span className="text-emerald-600 font-medium">↑ 18%</span>
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
            <div className="text-[11.5px] text-slate-500 font-medium">Outstanding Receivables</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(receivablesVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">128 customers</div>
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
            <div className="text-[11.5px] text-slate-500 font-medium">Outstanding Payables</div>
            <div className="text-[16px] font-bold text-slate-800 leading-snug">
              {formatCurrency(payablesVal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">42 suppliers</div>
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
                {displaySales.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 pr-2 font-mono font-medium">
                      <ReferenceLink type="sale" id={s.id} refNumber={s.invoiceNo} />
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      <ReferenceLink type="customer" id={s.customerId} refNumber={s.customer} className="text-slate-800 hover:text-blue-600 font-normal">
                        {s.customer}
                      </ReferenceLink>
                    </td>
                    <td className="py-3 px-2 font-semibold text-slate-900">₹ {s.amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          s.payment === "Paid"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-blue-50 text-blue-600 border border-blue-100"
                        }`}
                      >
                        {s.payment}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`font-medium ${
                          s.status === "Completed" ? "text-emerald-600" : "text-amber-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-right text-slate-400">{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Low Stock Products */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Low Stock Products</div>
            <Link to="/app/inventory" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

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
                {lowStockProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 pr-2 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-sm shrink-0">
                        {p.icon}
                      </div>
                      <ReferenceLink type="product" refNumber={p.sku} className="text-slate-800 hover:text-blue-600 font-medium">
                        {p.name}
                      </ReferenceLink>
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-500 text-[11.5px]">
                      <ReferenceLink type="product" refNumber={p.sku} />
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-rose-500">{p.stock}</td>
                    <td className="py-3 pl-2 text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-500 border border-rose-100">
                        Low Stock
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. BOTTOM THREE CARDS (Top Selling + Purchases + Activities)   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Selling Products */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Top Selling Products</div>
            <Link to="/app/products" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 px-1">SKU</th>
                  <th className="py-2 px-1 text-center">Total Sold</th>
                  <th className="py-2 pl-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {topSelling.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 pr-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs shrink-0">
                        {p.icon}
                      </div>
                      <span className="font-medium text-slate-800 truncate max-w-[110px]">{p.name}</span>
                    </td>
                    <td className="py-2.5 px-1 font-mono text-slate-500 text-[11px]">{p.sku}</td>
                    <td className="py-2.5 px-1 text-center font-medium text-slate-700">{p.sold}</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-slate-800">
                      ₹ {p.revenue.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Recent Purchases</div>
            <Link to="/app/purchase" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

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
                {recentPurchases.map((pur, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 pr-1 font-mono text-[11px]">
                      <ReferenceLink type="purchase" refNumber={pur.billNo} />
                    </td>
                    <td className="py-2.5 px-1 font-medium text-slate-800 truncate max-w-[95px]">
                      <ReferenceLink type="supplier" refNumber={pur.supplier} className="text-slate-800 hover:text-blue-600 font-normal">
                        {pur.supplier}
                      </ReferenceLink>
                    </td>
                    <td className="py-2.5 px-1 font-semibold text-slate-800">
                      ₹ {pur.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-1">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                          pur.status === "Received"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {pur.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-1 text-right text-slate-400 text-[11px]">{pur.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-bold text-slate-800">Recent Activities</div>
            <Link to="/app/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {recentActivities.map((act, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {act.icon}
                  <span className="font-medium text-slate-700 truncate">{act.title}</span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
