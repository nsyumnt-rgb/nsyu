import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePortalStore } from "../../store/portalStore";
import { listPortalOrdersApi, listPortalBillsApi, getPortalProfileApi } from "../../api/portal";

export default function PortalHome() {
  const customer = usePortalStore((s) => s.customer);
  const updateCustomerProfile = usePortalStore((s) => s.updateCustomerProfile);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [ordersRes, billsRes, profileRes] = await Promise.allSettled([
          listPortalOrdersApi({ limit: 3 }),
          listPortalBillsApi({ limit: 3 }),
          getPortalProfileApi(),
        ]);

        if (ordersRes.status === "fulfilled" && ordersRes.value?.data) {
          setRecentOrders(ordersRes.value.data);
        }
        if (billsRes.status === "fulfilled" && billsRes.value?.data) {
          setRecentBills(billsRes.value.data);
        }
        if (profileRes.status === "fulfilled" && profileRes.value) {
          updateCustomerProfile(profileRes.value);
        }
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [updateCustomerProfile]);

  const balance = Number(customer?.currentBalance ?? 0);

  return (
    <div className="space-y-6">
      {/* Welcome & Shop Banner */}
      <div className="bg-gradient-to-r from-[#047857] to-[#065F46] rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-medium mb-3 backdrop-blur-sm">
            <span>Shop: {customer?.shop?.name}</span>
            {customer?.shop?.code && <span className="opacity-75">({customer.shop.code})</span>}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome back, {customer?.name || "Valued Customer"}!
          </h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            Order products directly from {customer?.shop?.name}'s live catalog, track order statuses in real-time, and check your statement anytime.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/portal/catalog"
              className="px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-sm font-bold shadow transition flex items-center gap-2"
            >
              <CatalogIcon className="w-4 h-4 text-emerald-700" />
              <span>Browse Catalog & Order</span>
            </Link>
            <Link
              to="/portal/cart"
              className="px-4 py-2 bg-emerald-800/80 hover:bg-emerald-800 text-white border border-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              <CartIcon className="w-4 h-4" />
              <span>View Cart</span>
            </Link>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Outstanding Balance */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <LedgerIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <div
              className={`text-2xl md:text-3xl font-black ${
                balance > 0 ? "text-rose-600" : balance < 0 ? "text-emerald-600" : "text-gray-800"
              }`}
            >
              ₹{Math.abs(balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {balance > 0
                ? "Payment due to the shop"
                : balance < 0
                ? "Advance balance with shop"
                : "No pending balance"}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link
              to="/portal/ledger"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center justify-between"
            >
              <span>View Statement & Payments</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Shop Contact Details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Shop Details</span>
            <ShopIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-bold text-gray-800">{customer?.shop?.name}</div>
            {customer?.shop?.phone && (
              <div className="text-xs text-gray-600 flex items-center gap-1.5">
                <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>+91 {customer.shop.phone}</span>
              </div>
            )}
            {customer?.shop?.address && (
              <div className="text-xs text-gray-600 line-clamp-2">{customer.shop.address}</div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Contact shop directly for order queries or cash settlements
          </div>
        </div>

        {/* Quick Help Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Order Support</span>
            <SupportIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-xs text-gray-600 space-y-2">
            <p className="leading-relaxed">
              Orders placed here are received immediately by shop sales staff. Once reviewed and packed, staff converts them to official tax invoices.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link
              to="/portal/orders"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center justify-between"
            >
              <span>Track Active Orders</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Orders & Recent Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Orders Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <OrdersIcon className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-gray-900">Recent Orders</h2>
            </div>
            <Link to="/portal/orders" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              View All &rarr;
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading orders...</div>
            ) : recentOrders.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400">No orders placed yet.</p>
                <Link
                  to="/portal/catalog"
                  className="mt-3 inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((ord) => (
                  <Link
                    key={ord.id}
                    to={`/portal/orders/${ord.id}`}
                    className="block p-3.5 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">#{ord.order_number}</span>
                        <OrderStatusBadge status={ord.status} />
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{Number(ord.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{ord.items?.length || 0} item(s)</span>
                      <span>{new Date(ord.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Bills & Invoices Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BillsIcon className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-gray-900">Recent Invoices</h2>
            </div>
            <Link to="/portal/bills" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              View All &rarr;
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading bills...</div>
            ) : recentBills.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No invoices issued yet.</div>
            ) : (
              <div className="space-y-3">
                {recentBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          {bill.invoice_number || `Bill #${bill.id}`}
                        </span>
                        <BillStatusBadge status={bill.payment_status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(bill.createdAt || bill.date).toLocaleDateString("en-IN")}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">
                        ₹{Number(bill.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <Link
                        to={`/portal/bills/${bill.id}`}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-medium mt-0.5 inline-block"
                      >
                        Details &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text?: string; label: string }> = {
    pending: { bg: "bg-amber-50 border-amber-200 text-amber-700", label: "Pending" },
    confirmed: { bg: "bg-blue-50 border-blue-200 text-blue-700", label: "Confirmed" },
    processing: { bg: "bg-purple-50 border-purple-200 text-purple-700", label: "Processing" },
    shipped: { bg: "bg-indigo-50 border-indigo-200 text-indigo-700", label: "Shipped" },
    delivered: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Delivered" },
    cancelled: { bg: "bg-rose-50 border-rose-200 text-rose-700", label: "Cancelled" },
  };
  const c = map[status] || { bg: "bg-gray-100 border-gray-200 text-gray-700", label: status };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${c.bg}`}>
      {c.label}
    </span>
  );
}

export function BillStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text?: string; label: string }> = {
    paid: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Paid" },
    partially_paid: { bg: "bg-amber-50 border-amber-200 text-amber-700", label: "Partially Paid" },
    unpaid: { bg: "bg-rose-50 border-rose-200 text-rose-700", label: "Unpaid" },
  };
  const c = map[status] || { bg: "bg-gray-100 border-gray-200 text-gray-700", label: status };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${c.bg}`}>
      {c.label}
    </span>
  );
}

function CatalogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function BillsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
