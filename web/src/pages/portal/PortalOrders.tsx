import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPortalOrdersApi } from "../../api/portal";
import { OrderStatusBadge } from "./PortalHome";

export default function PortalOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        const res = await listPortalOrdersApi({
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          limit: 10,
        });
        setOrders(res?.data || []);
        setTotalPages(res?.pagination?.pages || 1);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [statusFilter, page]);

  const filterTabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "processing", label: "Processing" },
    { id: "shipped", label: "Shipped" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">My Orders</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track your past and live shop order status in real time.</p>
        </div>

        <Link
          to="/portal/catalog"
          className="px-4 py-2 bg-[#047857] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 self-start md:self-auto"
        >
          <span>+ New Order</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === tab.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <OrdersIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No orders found</h3>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter !== "all"
              ? `No ${statusFilter} orders at the moment.`
              : "You haven't placed any orders yet."}
          </p>
          <Link
            to="/portal/catalog"
            className="mt-4 inline-block px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition"
          >
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-emerald-200 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="font-extrabold text-base text-gray-900">
                    #{ord.order_number}
                  </div>
                  <OrderStatusBadge status={ord.status} />
                  {ord.converted_sale_id && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Billed
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  Placed on {new Date(ord.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {/* Items Summary */}
              <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-gray-600">
                  <span className="font-bold text-gray-900">{ord.items?.length || 0}</span> item(s):{" "}
                  <span className="text-gray-500">
                    {ord.items?.map((i: any) => `${i.product_name} (x${i.quantity})`).join(", ")}
                  </span>
                </div>

                <div className="text-right flex items-baseline justify-between sm:justify-end gap-2">
                  <span className="text-gray-500 font-medium">Total:</span>
                  <span className="text-base font-black text-gray-900">
                    ₹{Number(ord.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  {ord.delivery_type === "delivery" ? "🚚 Doorstep Delivery" : "🏬 Store Pickup"}
                </div>

                <div className="flex items-center gap-3">
                  {ord.converted_sale_id && (
                    <Link
                      to={`/portal/bills/${ord.converted_sale_id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      View Invoice &rarr;
                    </Link>
                  )}
                  <Link
                    to={`/portal/orders/${ord.id}`}
                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-xs font-semibold text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

