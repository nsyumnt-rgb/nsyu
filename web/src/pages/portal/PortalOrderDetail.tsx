import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPortalOrderApi, cancelPortalOrderApi } from "../../api/portal";
import { OrderStatusBadge } from "./PortalHome";

export default function PortalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPortalOrderApi(Number(id));
      setOrder(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this pending order?")) return;
    setCancelling(true);
    try {
      await cancelPortalOrderApi(Number(id));
      await fetchOrder();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 mt-2 font-medium">Loading order #{id}...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-gray-900">Order Not Found</h2>
        <p className="text-xs text-gray-500 mt-1">{error || "The requested order could not be located."}</p>
        <button
          type="button"
          onClick={() => navigate("/portal/orders")}
          className="mt-4 px-4 py-2 bg-[#047857] text-white rounded-xl text-xs font-bold"
        >
          &larr; Back to Orders
        </button>
      </div>
    );
  }

  const steps = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const currentStepIdx = steps.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/portal/orders"
          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
        >
          <span>&larr; Back to All Orders</span>
        </Link>
      </div>

      {/* Main Order Card Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-gray-900">
                Order #{order.order_number}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {/* Cancel button if pending */}
          {order.status === "pending" && (
            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancel}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-200 self-start sm:self-auto"
            >
              {cancelling ? "Cancelling..." : "Cancel Order"}
            </button>
          )}
        </div>

        {/* Bill conversion alert if billed */}
        {order.converted_sale_id && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-bold">Official Invoice Issued: </span>
              This order has been verified and converted to an official tax invoice.
            </div>
            <Link
              to={`/portal/bills/${order.converted_sale_id}`}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap"
            >
              View Invoice &rarr;
            </Link>
          </div>
        )}

        {/* Status Tracker / Timeline */}
        {!isCancelled ? (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Fulfillment Status
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {steps.map((st, idx) => {
                const isPassed = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;
                return (
                  <div key={st} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 transition ${
                        isCurrent
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                          : isPassed
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <span
                      className={`text-[11px] font-semibold capitalize ${
                        isCurrent
                          ? "text-emerald-700 font-bold"
                          : isPassed
                          ? "text-gray-700"
                          : "text-gray-400"
                      }`}
                    >
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            This order was cancelled.
          </div>
        )}

        {/* Order Status History Log */}
        {order.status_history && order.status_history.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Status Activity Log
            </h3>
            <div className="space-y-1.5">
              {order.status_history.map((h: any) => (
                <div key={h.id} className="text-xs text-gray-600 flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200">
                      {h.status}
                    </span>
                    {h.comment && <span className="text-gray-500">({h.comment})</span>}
                  </div>
                  <span className="text-gray-400 text-[11px]">
                    {new Date(h.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-bold text-sm text-gray-900">
          Ordered Items ({order.items?.length || 0})
        </div>

        <div className="divide-y divide-gray-100">
          {order.items?.map((item: any, idx: number) => (
            <div key={item.id} className="p-4 sm:px-5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 font-mono w-5">{idx + 1}.</span>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{item.product_name}</h4>
                  <div className="text-gray-400 font-mono text-[11px] mt-0.5">
                    Unit Price: ₹{Number(item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-gray-700">Qty: {item.quantity}</div>
                <div className="text-sm font-black text-gray-900 mt-0.5">
                  ₹{Number(item.line_total || item.quantity * item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Calculation Summary Footer */}
        <div className="bg-gray-50 p-5 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Subtotal</span>
            <span className="font-bold">
              ₹{Number(order.subtotal || order.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Discount</span>
              <span className="font-bold text-emerald-600">
                -₹{Number(order.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {Number(order.tax_amount) > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Tax (GST)</span>
              <span className="font-bold">
                +₹{Number(order.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm font-black text-gray-900">
            <span>Grand Total</span>
            <span className="text-base text-emerald-800">
              ₹{Number(order.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery & Notes Details */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-2 text-xs">
        <h3 className="font-bold text-gray-800 uppercase tracking-wider">Fulfillment & Notes</h3>
        <div className="text-gray-600">
          <span className="font-semibold text-gray-800">Type: </span>
          {order.delivery_type === "delivery" ? "Doorstep Delivery" : "Store Pickup"}
        </div>
        {order.shipping_address && (
          <div className="text-gray-600">
            <span className="font-semibold text-gray-800">Shipping Address: </span>
            {order.shipping_address}
          </div>
        )}
        {order.notes && (
          <div className="text-gray-600">
            <span className="font-semibold text-gray-800">Customer Note: </span>
            {order.notes}
          </div>
        )}
      </div>
    </div>
  );
}

