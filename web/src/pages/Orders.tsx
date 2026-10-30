import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  getOrders,
  getOrderStats,
  createOrder,
  updateOrderStatus,
  type OrderRecord,
  type OrderStats,
} from "../api/orders";
import { listProducts } from "../api/products";
import { listCustomers } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import RequireModule from "../components/RequireModule";
import type { Customer, Product } from "../types";

type WorkflowStep =
  | "list"
  | "create"
  | "confirmation"
  | "view"
  | "update_status"
  | "invoice"
  | "tracking"
  | "history"
  | "notifications";

export default function Orders() {
  const [step, setStep] = useState<WorkflowStep>("list");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters for Step 1
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateRange] = useState("01 Oct 2026 - 31 Oct 2026");

  // Step 2 Form State
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [custType, setCustType] = useState<"existing" | "new">("existing");
  const [selectedCustId, setSelectedCustId] = useState<number | null>(null);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orderType, setOrderType] = useState("Walk-in");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });

  const [cartItems, setCartItems] = useState<
    Array<{
      productName: string;
      sku: string;
      qty: number;
      price: number;
      gstPercent: number;
      discountPercent: number;
      productId?: number;
    }>
  >([]);

  const [productSearch, setProductSearch] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  // Step 5 Update Status Form
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    status: "Processing",
    payment_status: "Paid",
    remarks: "Order is being processed.",
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Load Initial Data
  function loadOrdersData() {
    setLoading(true);
    Promise.all([
      getOrderStats().catch(() => ({
      data: {
        data: {
          totalOrders: 0,
          pendingOrders: 0,
          processingOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
        },
      },
    })),
      getOrders({
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        paymentStatus: paymentFilter !== "all" ? paymentFilter : undefined,
      }).catch(() => ({ data: { data: [] } })),
      listProducts().catch(() => ({ data: { data: [] } })),
      listCustomers().catch(() => ({ data: { data: [] } })),
    ])
      .then(([statsRes, ordersRes, prodsRes, custsRes]) => {
        if (statsRes?.data?.data) setStats(statsRes.data.data);
        const fetchedOrders = ordersRes?.data?.data || [];
        setOrders(fetchedOrders);
        if (fetchedOrders.length > 0 && !selectedOrder) {
          setSelectedOrder(fetchedOrders[0]);
        }
        setAvailableProducts(prodsRes?.data?.data || []);
        const custs = custsRes?.data?.data || [];
        setAvailableCustomers(custs);
        if (custs.length > 0 && !selectedCustId) {
          setSelectedCustId(custs[0].id);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrdersData();
  }, [statusFilter, paymentFilter]);

  // Calculations for Step 2
  const calcSubtotal = cartItems.reduce((acc, it) => acc + it.price * it.qty, 0);
  const calcDiscount = cartItems.reduce((acc, it) => acc + (it.discountPercent || 0), 0);
  const calcGst = Math.round((calcSubtotal - calcDiscount) * 0.18);
  const calcGrandTotal = calcSubtotal - calcDiscount + calcGst;

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Please add at least one product to the order.");
      return;
    }

    setSavingOrder(true);
    setError(null);
    try {
      const selectedCustomerObj = availableCustomers.find((c) => c.id === selectedCustId);
      const payload = {
        customerId: custType === "existing" ? selectedCustId : undefined,
        customer:
          custType === "new"
            ? {
                name: newCustName.trim(),
                phone: newCustPhone.trim() || undefined,
                email: newCustEmail.trim() || undefined,
                address: newCustAddress.trim() || undefined,
              }
            : selectedCustomerObj
            ? {
                name: selectedCustomerObj.name,
                phone: selectedCustomerObj.phone || undefined,
                address: selectedCustomerObj.address || undefined,
              }
            : undefined,
        orderDate,
        expectedDeliveryDate,
        orderType,
        paymentMethod,
        paymentStatus,
        shippingAddress: custType === "new" ? newCustAddress : selectedCustomerObj?.address,
        discountAmount: calcDiscount,
        taxPercent: 18,
        items: cartItems.map((ci) => ({
          productId: ci.productId,
          productName: ci.productName,
          sku: ci.sku,
          quantity: ci.qty,
          rate: ci.price,
          discountPercent: 0,
          gstPercent: ci.gstPercent,
        })),
        status: "processing",
      };

      const res = await createOrder(payload);
      const newOrder = res.data.data;
      if (newOrder) setSelectedOrder(newOrder);
      setStep("confirmation");
      loadOrdersData();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create order"));
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleUpdateStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await updateOrderStatus(selectedOrder.id, {
        status: statusUpdateForm.status.toLowerCase(),
        payment_status: statusUpdateForm.payment_status,
        remarks: statusUpdateForm.remarks,
      });
      if (res.data.data) setSelectedOrder(res.data.data);
      setStep("view");
      loadOrdersData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update order status"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  function addProductToCart(p?: Product) {
    if (p) {
      setCartItems((prev) => {
        const existingIdx = prev.findIndex((it) => it.productId === p.id || (p.sku && it.sku === p.sku));
        if (existingIdx >= 0) {
          return prev.map((it, i) => (i === existingIdx ? { ...it, qty: it.qty + 1 } : it));
        }
        return [
          ...prev,
          {
            productName: p.name,
            sku: p.sku || "SKU-" + p.id,
            qty: 1,
            price: Number(p.selling_price || 0),
            gstPercent: 18,
            discountPercent: 0,
            productId: p.id,
          },
        ];
      });
      setProductSearch("");
    } else if (productSearch.trim()) {
      const query = productSearch.toLowerCase().trim();
      const matched = availableProducts.find(
        (prod) =>
          prod.name.toLowerCase().includes(query) ||
          (prod.sku && prod.sku.toLowerCase().includes(query))
      );
      if (matched) {
        addProductToCart(matched);
      } else {
        alert("No product found matching '" + productSearch + "'. Please choose from database products.");
      }
    }
  }

  function removeCartItem(idx: number) {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <RequireModule module="orders">
      <div className="space-y-6">
        {/* Step Indicator Header (matches 9-step blueprint in Image 2) */}
        <div className="card p-3 bg-white border border-border shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  NSY Business 9-Step Order Workflow
                </h1>
                <p className="text-[11px] text-slate-500">
                  Integrated Order Management, Lifecycle Tracking, Invoicing, and Customer Notifications
                </p>
              </div>
            </div>

            {/* Quick Step Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
              {[
                { key: "list", num: "1", label: "Order List" },
                { key: "create", num: "2", label: "Create Order" },
                { key: "confirmation", num: "3", label: "Confirmation" },
                { key: "view", num: "4", label: "Order View" },
                { key: "update_status", num: "5", label: "Update Status" },
                { key: "invoice", num: "6", label: "Invoice" },
                { key: "tracking", num: "7", label: "Customer Tracking" },
                { key: "history", num: "8", label: "Customer History" },
                { key: "notifications", num: "9", label: "Notifications" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStep(s.key as WorkflowStep)}
                  className={clsx(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1",
                    step === s.key
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
                  )}
                >
                  <span
                    className={clsx(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                      step === s.key ? "bg-white text-blue-700" : "bg-slate-300 text-slate-800"
                    )}
                  >
                    {s.num}
                  </span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: ORDER LIST (View, search and filter all orders)            */}
        {/* Matches Image 1 & Image 2 (Step 1)                                */}
        {/* ------------------------------------------------------------------ */}
        {step === "list" && (
          <div className="space-y-5">
            {/* Top Bar with Breadcrumbs & Create Order Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Orders</h2>
                <div className="text-xs text-slate-500 mt-0.5">Dashboard &gt; Orders</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("create")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <span>🛒</span>
                  <span>Create New Order</span>
                  <span className="text-[10px]">▼</span>
                </button>
              </div>
            </div>

            {/* 5 KPI Metric Cards (Image 1 top row) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {/* Total Orders */}
              <div className="card p-4 bg-white border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Total Orders</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                    🛒
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {stats.totalOrders.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>↑ 12%</span>
                    <span className="text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>

              {/* Pending Orders */}
              <div className="card p-4 bg-white border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Pending Orders</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
                    ⏱️
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-slate-900">{stats.pendingOrders}</div>
                  <div className="text-[11px] text-red-500 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>↑ 8%</span>
                    <span className="text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>

              {/* Processing Orders */}
              <div className="card p-4 bg-white border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Processing Orders</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
                    📦
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-slate-900">{stats.processingOrders}</div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>↑ 15%</span>
                    <span className="text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>

              {/* Delivered Orders */}
              <div className="card p-4 bg-white border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Delivered Orders</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                    🚚
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {stats.deliveredOrders.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>↑ 18%</span>
                    <span className="text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>

              {/* Cancelled Orders */}
              <div className="card p-4 bg-white border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Cancelled Orders</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-sm">
                    🚫
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-slate-900">{stats.cancelledOrders}</div>
                  <div className="text-[11px] text-red-500 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>↓ 5%</span>
                    <span className="text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Row (Image 1) */}
            <div className="card p-3.5 bg-white border border-border shadow-xs flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                <input
                  className="input !pl-8 !py-1.5 text-xs w-full"
                  placeholder="Search by Order No, Customer, Phone, Email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadOrdersData()}
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input !py-1.5 text-xs text-slate-700 bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="input !py-1.5 text-xs text-slate-700 bg-white"
                >
                  <option value="all">All Payment Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>

                <div className="flex items-center gap-1.5 border border-border rounded-md px-3 py-1.5 text-xs text-slate-600 bg-slate-50">
                  <span>📅</span>
                  <span className="font-medium">{dateRange}</span>
                </div>

                <button
                  onClick={() => loadOrdersData()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1"
                >
                  <span>⚡</span>
                  <span>Filters</span>
                </button>
              </div>
            </div>

            {/* Orders Table (Exact layout from Image 1) */}
            <div className="card overflow-hidden border border-border bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-border text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-8">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      <th className="py-3 px-2 w-8">#</th>
                      <th className="py-3 px-3">ORDER NO.</th>
                      <th className="py-3 px-3">DATE ↓</th>
                      <th className="py-3 px-3">CUSTOMER</th>
                      <th className="py-3 px-3">ITEMS</th>
                      <th className="py-3 px-3">AMOUNT ↓</th>
                      <th className="py-3 px-3">PAYMENT ↓</th>
                      <th className="py-3 px-3">STATUS ↓</th>
                      <th className="py-3 px-3 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          Loading orders...
                        </td>
                      </tr>
                    )}
                    {!loading && orders.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No orders found matching the filter criteria.
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      orders.map((ord, idx) => {
                        const statusColor =
                          ord.status === "delivered" || ord.status === "Delivered"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : ord.status === "processing" || ord.status === "Processing"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : ord.status === "shipped" || ord.status === "Shipped"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : ord.status === "pending" || ord.status === "Pending"
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-red-100 text-red-800 border-red-200";

                        const payColor =
                          ord.payment_status === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : ord.payment_status === "Pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800";

                        const itemCount = ord.items?.length || 1;

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <input type="checkbox" className="rounded border-gray-300" />
                            </td>
                            <td className="py-3 px-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setStep("view");
                                }}
                                className="font-bold text-blue-600 hover:underline"
                              >
                                {ord.order_number}
                              </button>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">
                                {new Date(ord.order_date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(ord.order_date).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">
                                {ord.customer?.name || "Walk-in Customer"}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {ord.customer?.phone || "+91 98765 00000"}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                <span className="text-sm">📦</span>
                                {itemCount > 1 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded font-semibold">
                                    +{itemCount - 1}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">
                                ₹ {Number(ord.total_amount).toLocaleString("en-IN")}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {itemCount} item{itemCount > 1 ? "s" : ""}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={clsx(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  payColor
                                )}
                              >
                                {ord.payment_status || "Pending"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={clsx(
                                  "px-2.5 py-0.5 rounded-md text-[10px] font-bold border capitalize",
                                  statusColor
                                )}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  title="View Order Details"
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setStep("view");
                                  }}
                                  className="text-slate-500 hover:text-blue-600 text-sm"
                                >
                                  👁️
                                </button>
                                <button
                                  title="Update Status"
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setStatusUpdateForm({
                                      status:
                                        ord.status.charAt(0).toUpperCase() + ord.status.slice(1),
                                      payment_status: ord.payment_status || "Paid",
                                      remarks: ord.remarks || "Status updated.",
                                    });
                                    setStep("update_status");
                                  }}
                                  className="text-slate-500 hover:text-indigo-600 text-sm"
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Print Invoice"
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setStep("invoice");
                                  }}
                                  className="text-slate-500 hover:text-emerald-600 text-sm"
                                >
                                  🖨️
                                </button>
                                <button
                                  title="Notifications"
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setStep("notifications");
                                  }}
                                  className="text-slate-400 hover:text-slate-700 text-sm"
                                >
                                  🔔
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border-t border-border text-xs text-slate-500 gap-2 bg-slate-50/50">
                <div>
                  Showing 1 to {orders.length} of {stats.totalOrders.toLocaleString()} orders
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span>Rows per page:</span>
                    <select className="border border-border rounded px-1.5 py-0.5 bg-white text-xs">
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-0.5 rounded border border-border bg-white text-slate-500">
                      «
                    </button>
                    <button className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold">1</button>
                    <button className="px-2 py-0.5 rounded border border-border bg-white text-slate-700">
                      2
                    </button>
                    <button className="px-2 py-0.5 rounded border border-border bg-white text-slate-700">
                      3
                    </button>
                    <span>...</span>
                    <button className="px-2 py-0.5 rounded border border-border bg-white text-slate-700">
                      125
                    </button>
                    <button className="px-2 py-0.5 rounded border border-border bg-white text-slate-500">
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2: CREATE NEW ORDER                                           */}
        {/* Matches Image 2 (Step 2)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "create" && (
          <form onSubmit={handleCreateOrder} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create New Order</h2>
                <div className="text-xs text-slate-500">Orders &gt; Create New Order</div>
              </div>
              <button
                type="button"
                onClick={() => setStep("list")}
                className="btn-secondary !py-1.5 !px-3 text-xs"
              >
                Back to Orders
              </button>
            </div>

            {/* Customer Information & Order Details (2 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Customer Information */}
              <div className="card p-4 space-y-3 bg-white border border-border shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>👤</span> Customer Information
                  </h3>
                  <div className="flex text-xs bg-slate-100 p-0.5 rounded border border-border">
                    <button
                      type="button"
                      onClick={() => setCustType("existing")}
                      className={clsx(
                        "px-2 py-0.5 rounded font-medium",
                        custType === "existing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                      )}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustType("new")}
                      className={clsx(
                        "px-2 py-0.5 rounded font-medium",
                        custType === "new" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                      )}
                    >
                      + Add New
                    </button>
                  </div>
                </div>

                {custType === "existing" ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Customer *
                    </label>
                    <select
                      value={selectedCustId || ""}
                      onChange={(e) => setSelectedCustId(Number(e.target.value))}
                      className="input !py-2 text-xs w-full bg-white"
                    >
                      {availableCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Customer Name *
                    </label>
                    <input
                      className="input !py-1.5 text-xs w-full"
                      value={newCustName}
                      placeholder="e.g. Rajesh Kumar"
                      onChange={(e) => setNewCustName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Phone</label>
                    <input
                      className="input !py-1.5 text-xs w-full"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                    <input
                      className="input !py-1.5 text-xs w-full"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Address</label>
                  <input
                    className="input !py-1.5 text-xs w-full"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Order Details */}
              <div className="card p-4 space-y-3 bg-white border border-border shadow-xs">
                <div className="pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>📋</span> Order Details
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Order Date</label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="input !py-1.5 text-xs w-full bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Order Type</label>
                    <div className="flex gap-2">
                      {["Walk-in", "Online"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setOrderType(t)}
                          className={clsx(
                            "flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all",
                            orderType === t
                              ? "bg-blue-50 border-blue-600 text-blue-700"
                              : "border-border text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="input !py-1.5 text-xs w-full bg-white"
                    >
                      <option>Cash</option>
                      <option>Online / UPI</option>
                      <option>Card</option>
                      <option>Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="input !py-1.5 text-xs w-full bg-white font-medium"
                    >
                      <option>Paid</option>
                      <option>Pending</option>
                      <option>Failed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Expected Delivery
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="input !py-1.5 text-xs w-full bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Add Products Section */}
            <div className="card p-4 space-y-4 bg-white border border-border shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>📦</span> Add Products
                </h3>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      className="input !py-1.5 text-xs w-64"
                      placeholder="Search product by name, SKU or barcode..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    {productSearch.length > 1 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        {availableProducts
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .map((p) => (
                            <div
                              key={p.id}
                              onClick={() => addProductToCart(p)}
                              className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer flex justify-between border-b border-border last:border-0"
                            >
                              <span className="font-medium text-slate-900">{p.name}</span>
                              <span className="text-slate-500">₹{p.selling_price}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addProductToCart()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
                  >
                    + Add Product
                  </button>
                </div>
              </div>

              {/* Product Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">PRODUCT</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center w-24">QTY</th>
                      <th className="py-2.5 px-3 text-right">PRICE</th>
                      <th className="py-2.5 px-3 text-center">GST %</th>
                      <th className="py-2.5 px-3 text-right">DISC.</th>
                      <th className="py-2.5 px-3 text-right font-bold">TOTAL</th>
                      <th className="py-2.5 px-3 text-center w-12">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cartItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Cart is empty (0 items). Search products above or select from the database to add items.
                        </td>
                      </tr>
                    )}
                    {cartItems.map((item, idx) => {
                      const lineTotal = item.price * item.qty - (item.discountPercent || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                setCartItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, qty: val } : it))
                                );
                              }}
                              className="input !py-1 !px-2 text-center text-xs w-16"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">₹ {item.price}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">
                            {item.gstPercent}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            ₹ {item.discountPercent || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            ₹ {lineTotal}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeCartItem(idx)}
                              className="text-red-500 hover:text-red-700 font-bold"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Bottom Right */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-t border-border pt-4">
                <div className="text-xs text-slate-500 max-w-sm">
                  Orders will be created in <strong className="text-slate-800">Processing</strong> state.
                  Stock is preserved until delivered or billed.
                </div>

                <div className="w-64 space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-border">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">₹ {calcSubtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-mono text-red-600">- ₹ {calcDiscount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%)</span>
                    <span className="font-mono">₹ {calcGst}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-border">
                    <span>Total Amount</span>
                    <span className="font-mono text-blue-700">₹ {calcGrandTotal}</span>
                  </div>
                </div>
              </div>

              {error && <div className="text-xs text-red-600 font-semibold">{error}</div>}

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("list")}
                  className="btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOrder}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm"
                >
                  {savingOrder ? "Saving..." : "Save Order"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3: ORDER CONFIRMATION                                         */}
        {/* Matches Image 2 (Step 3)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "confirmation" && selectedOrder && (
          <div className="card p-8 bg-white border border-border shadow-xs text-center max-w-xl mx-auto space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-sm">
              ✓
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Order Created Successfully!
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Order has been created and saved to the database.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-border text-left space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Order No.</span>
                <span className="font-bold font-mono text-slate-900">
                  {selectedOrder.order_number}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Customer</span>
                <span className="font-bold text-slate-900">
                  {selectedOrder.customer?.name || "Walk-in Customer"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-extrabold text-blue-700 font-mono text-sm">
                  ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Payment Status</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {selectedOrder.payment_status || "Paid"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Order Status</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold capitalize">
                  {selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Date & Time</span>
                <span className="font-medium text-slate-700">
                  {new Date(selectedOrder.order_date).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setStep("view")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm"
              >
                View Order
              </button>
              <button
                onClick={() => {
                  setCartItems([]);
                  setStep("create");
                }}
                className="btn-secondary !py-2 !px-5 text-xs font-semibold"
              >
                Create Another Order
              </button>
              <button
                onClick={() => setStep("invoice")}
                className="border border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg text-xs font-bold"
              >
                Print Invoice
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 4: ORDER VIEW / DETAILS                                       */}
        {/* Matches Image 2 (Step 4)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "view" && selectedOrder && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  View Order #{selectedOrder.order_number}
                </h2>
                <div className="text-xs text-slate-500">Orders &gt; View Order</div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setStep("list")}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep("invoice")}
                  className="bg-white hover:bg-slate-50 border border-border px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 shadow-xs flex items-center gap-1.5"
                >
                  <span>🖨️</span> Print Invoice
                </button>
                <button
                  onClick={() => {
                    setStatusUpdateForm({
                      status:
                        selectedOrder.status.charAt(0).toUpperCase() +
                        selectedOrder.status.slice(1),
                      payment_status: selectedOrder.payment_status || "Paid",
                      remarks: selectedOrder.remarks || "Processing order delivery.",
                    });
                    setStep("update_status");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <span>✏️</span> Edit Order Status
                </button>
                <button
                  onClick={() => setStep("tracking")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <span>🚚</span> Live Tracking
                </button>
              </div>
            </div>

            {/* 3 Overview Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Order Information */}
              <div className="card p-4 bg-white border border-border shadow-xs space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 pb-2 border-b border-border">
                  Order Information
                </h3>
                <div className="flex justify-between">
                  <span className="text-slate-500">Order No:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedOrder.order_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Date:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(selectedOrder.order_date).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Type:</span>
                  <span className="font-medium text-slate-800">
                    {selectedOrder.order_type || "Walk-in"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-medium text-slate-800">
                    {selectedOrder.payment_method || "Cash"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border">
                  <span className="text-slate-500">Order Status:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] capitalize">
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    {selectedOrder.payment_status || "Paid"}
                  </span>
                </div>
              </div>

              {/* Card 2: Customer Information */}
              <div className="card p-4 bg-white border border-border shadow-xs space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 pb-2 border-b border-border">
                  Customer Information
                </h3>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedOrder.customer?.name || "Walk-in Customer"}
                </div>
                <div className="text-slate-600 flex items-center gap-1.5">
                  <span>📞</span>
                  <span>{selectedOrder.customer?.phone || "—"}</span>
                </div>
                <div className="text-slate-600 flex items-center gap-1.5">
                  <span>✉️</span>
                  <span>{selectedOrder.customer?.email || "—"}</span>
                </div>
                <div className="text-slate-600 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>{selectedOrder.shipping_address || selectedOrder.customer?.address || "Store Pickup"}</span>
                </div>
              </div>

              {/* Card 3: Amount Summary */}
              <div className="card p-4 bg-white border border-border shadow-xs space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 pb-2 border-b border-border">
                  Amount Summary
                </h3>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    ₹ {Number(selectedOrder.subtotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount (-)</span>
                  <span className="font-mono text-red-600">
                    ₹ {Number(selectedOrder.discount_amount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (18%)</span>
                  <span className="font-mono">
                    ₹ {Number(selectedOrder.tax_amount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border font-bold text-slate-900 text-sm">
                  <span>Total Amount</span>
                  <span className="font-mono text-blue-700 text-base">
                    ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="card overflow-hidden border border-border bg-white shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-border font-bold text-xs text-slate-800">
                Items ({selectedOrder.items?.length || 0})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 border-b border-border text-slate-500 font-semibold text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">PRODUCT</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">QTY</th>
                      <th className="py-2.5 px-3 text-right">PRICE</th>
                      <th className="py-2.5 px-3 text-center">GST</th>
                      <th className="py-2.5 px-3 text-right">DISC.</th>
                      <th className="py-2.5 px-3 text-right font-bold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items?.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                          <span>📦</span>
                          <span>{it.product_name}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{it.sku}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹ {Number(it.rate).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">
                          {it.gst_percent || 18}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          ₹ {it.discount_percent || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                          ₹ {Number(it.amount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 5: UPDATE ORDER STATUS                                        */}
        {/* Matches Image 2 (Step 5)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "update_status" && selectedOrder && (
          <form onSubmit={handleUpdateStatusSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Update Order Status</h2>
                <div className="text-xs text-slate-500">Orders &gt; Update Status</div>
              </div>
              <button
                type="button"
                onClick={() => setStep("view")}
                className="btn-secondary !py-1.5 !px-3 text-xs"
              >
                Back to View
              </button>
            </div>

            {/* Order Summary Strip */}
            <div className="card p-4 bg-white border border-border shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Order No</span>
                <span className="font-bold font-mono text-blue-600 text-sm">
                  {selectedOrder.order_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
                <span className="font-bold text-slate-900">
                  {selectedOrder.customer?.name || "Walk-in Customer"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Status</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold capitalize">
                  {selectedOrder.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Status</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {selectedOrder.payment_status || "Paid"}
                </span>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="card p-6 bg-white border border-border shadow-xs space-y-6">
              <h3 className="text-sm font-bold text-slate-800">Update Status</h3>

              {/* Progress Stepper Bar */}
              <div className="relative flex items-center justify-between max-w-2xl mx-auto py-4">
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
                {["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((st) => {
                  const isActive =
                    statusUpdateForm.status.toLowerCase() === st.toLowerCase();
                  return (
                    <div
                      key={st}
                      onClick={() =>
                        setStatusUpdateForm((prev) => ({ ...prev, status: st }))
                      }
                      className="relative z-10 flex flex-col items-center cursor-pointer group"
                    >
                      <div
                        className={clsx(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all",
                          isActive
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md"
                            : "bg-white border-2 border-slate-300 text-slate-500 group-hover:border-slate-400"
                        )}
                      >
                        {isActive ? "●" : "○"}
                      </div>
                      <span
                        className={clsx(
                          "text-xs mt-2 font-semibold",
                          isActive ? "text-blue-700" : "text-slate-500"
                        )}
                      >
                        {st}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-4 border-t border-border">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Status *
                  </label>
                  <select
                    value={statusUpdateForm.status}
                    onChange={(e) =>
                      setStatusUpdateForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="input !py-2 text-xs w-full bg-white font-medium"
                  >
                    <option>Pending</option>
                    <option>Processing</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                    <option>Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Payment Status
                  </label>
                  <select
                    value={statusUpdateForm.payment_status}
                    onChange={(e) =>
                      setStatusUpdateForm((prev) => ({ ...prev, payment_status: e.target.value }))
                    }
                    className="input !py-2 text-xs w-full bg-white font-medium"
                  >
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Failed</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Remarks / Tracking Details
                  </label>
                  <textarea
                    rows={3}
                    value={statusUpdateForm.remarks}
                    onChange={(e) =>
                      setStatusUpdateForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Enter order update note or courier tracking ID..."
                    className="input !py-2 text-xs w-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 max-w-2xl mx-auto pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep("view")}
                  className="btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm"
                >
                  {updatingStatus ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 6: ORDER INVOICE (Print or download PDF)                      */}
        {/* Matches Image 2 (Step 6)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "invoice" && selectedOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Order Invoice</h2>
                <div className="text-xs text-slate-500">Orders &gt; Invoice &gt; {selectedOrder.order_number}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("view")}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Back
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-white hover:bg-slate-50 border border-border px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 shadow-xs flex items-center gap-1.5"
                >
                  <span>🖨️</span> Print
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <span>⬇️</span> Download PDF
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div className="card p-8 bg-white border border-border shadow-md max-w-3xl mx-auto space-y-6 text-slate-900 print:shadow-none print:border-none print:p-0">
              {/* Header */}
              <div className="flex justify-between items-start pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center text-2xl font-bold">
                    🏬
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">NSY Business</h3>
                    <p className="text-[11px] text-slate-500">Multi-Shop Management</p>
                  </div>
                </div>

                <div className="text-right">
                  <h4 className="text-xl font-black text-slate-900 tracking-wider">INVOICE</h4>
                  <div className="text-xs text-slate-600 font-mono mt-1">
                    Order No: <strong>{selectedOrder.order_number}</strong>
                  </div>
                  <div className="text-xs text-slate-500">
                    Date:{" "}
                    {new Date(selectedOrder.order_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs mt-1">
                    Payment Status: <strong className="text-emerald-600 font-bold">{selectedOrder.payment_status || "Paid"}</strong>
                  </div>
                  <div className="text-xs">
                    Order Status: <strong className="text-emerald-700 font-bold capitalize">{selectedOrder.status}</strong>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="text-xs space-y-1">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  Bill To:
                </div>
                <div className="font-bold text-sm text-slate-900">
                  {selectedOrder.customer?.name || "Walk-in Customer"}
                </div>
                <div className="text-slate-600">
                  {selectedOrder.shipping_address || selectedOrder.customer?.address || "Store Pickup"}
                </div>
                <div className="text-slate-600 font-mono">
                  {selectedOrder.customer?.phone || "—"}
                </div>
                <div className="text-slate-600">
                  {selectedOrder.customer?.email || "—"}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-y border-border text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">PRODUCT</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-center">QTY</th>
                    <th className="py-2.5 px-3 text-right">PRICE</th>
                    <th className="py-2.5 px-3 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">DISC.</th>
                    <th className="py-2.5 px-3 text-right font-bold">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedOrder.items?.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{it.product_name}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{it.sku}</td>
                      <td className="py-2 px-3 text-center font-bold">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">₹ {it.rate}</td>
                      <td className="py-2 px-3 text-center text-slate-500">{it.gst_percent || 18}%</td>
                      <td className="py-2 px-3 text-right text-slate-500">₹ {it.discount_percent || 0}</td>
                      <td className="py-2 px-3 text-right font-bold font-mono">₹ {it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">₹ {selectedOrder.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-mono text-red-600">- ₹ {selectedOrder.discount_amount || 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%)</span>
                    <span className="font-mono">₹ {selectedOrder.tax_amount || 0}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-border">
                    <span>Total Amount</span>
                    <span className="font-mono text-base text-blue-700">
                      ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer with barcode */}
              <div className="pt-6 border-t border-border text-center space-y-2">
                <div className="text-xs font-semibold text-slate-700">Thank you for your purchase!</div>
                <div className="font-mono text-[11px] tracking-widest text-slate-400">
                  ||||| | |||||| ||| ||||||| | ||||| ||||
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {selectedOrder.order_number}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 7: CUSTOMER ORDER TRACKING                                    */}
        {/* Matches Image 2 (Step 7)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "tracking" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Order Tracking (Customer)</h2>
                <div className="text-xs text-slate-500">Dashboard &gt; My Orders &gt; Tracking</div>
              </div>
              <button onClick={() => setStep("list")} className="btn-secondary !py-1.5 !px-3 text-xs">
                Back to Orders
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              {["All Orders", "Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((t) => (
                <button
                  key={t}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg font-semibold border whitespace-nowrap",
                    t === "Shipped" || t === "Processing"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-border hover:bg-slate-50"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Horizontal Timeline Tracker */}
            <div className="card p-6 bg-white border border-border shadow-xs space-y-6">
              <div className="relative flex items-center justify-between max-w-3xl mx-auto py-2">
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 z-0" />
                {[
                  { label: "Order Placed", time: "29 Oct, 10:45 AM", done: true },
                  { label: "Processing", time: "29 Oct, 12:00 PM", done: true },
                  { label: "Shipped", time: "In Transit", done: true },
                  { label: "Out for Delivery", time: "Expected 31 Oct", done: false },
                  { label: "Delivered", time: "Pending", done: false },
                ].map((s, idx) => (
                  <div key={idx} className="relative z-10 flex flex-col items-center">
                    <div
                      className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        s.done
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                          : "bg-white border-2 border-slate-300 text-slate-400"
                      )}
                    >
                      {s.done ? "✓" : idx + 1}
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-2">{s.label}</span>
                    <span className="text-[10px] text-slate-500">{s.time}</span>
                  </div>
                ))}
              </div>

              {/* Order Info & Delivery Address & Items */}
              {selectedOrder ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border text-xs">
                  {/* Details */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-border">
                    <h4 className="font-bold text-slate-800">Order Details</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order No:</span>
                      <span className="font-mono font-bold text-blue-600">
                        {selectedOrder.order_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order Date:</span>
                      <span>
                        {new Date(selectedOrder.order_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Amount:</span>
                      <span className="font-bold text-blue-700 font-mono">
                        ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span className="text-emerald-600 font-bold">{selectedOrder.payment_status || "Paid"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order Status:</span>
                      <span className="text-blue-600 font-bold capitalize">{selectedOrder.status}</span>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-border">
                    <h4 className="font-bold text-slate-800">Delivery Address</h4>
                    <div className="font-semibold text-slate-900">
                      {selectedOrder.customer?.name || "Walk-in Customer"}
                    </div>
                    <div className="text-slate-600">
                      {selectedOrder.shipping_address || selectedOrder.customer?.address || "Store Pickup"}
                    </div>
                    <div className="text-slate-600 font-mono">
                      {selectedOrder.customer?.phone || "—"}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-border">
                    <h4 className="font-bold text-slate-800">
                      Items Ordered ({selectedOrder.items?.length || 0})
                    </h4>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((it, idx) => (
                        <div key={it.id || idx} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                          <span className="text-slate-700">{it.product_name}</span>
                          <span className="font-bold font-mono">x{it.quantity}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 py-2">No items in this order.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No order selected. Please select an order from the Order List to view tracking details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 8: CUSTOMER ORDER HISTORY                                     */}
        {/* Matches Image 2 (Step 8)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Customer Order History</h2>
                <div className="text-xs text-slate-500">Dashboard &gt; My Orders</div>
              </div>
              <button onClick={() => setStep("list")} className="btn-secondary !py-1.5 !px-3 text-xs">
                Back to Orders
              </button>
            </div>

            <div className="card overflow-hidden border border-border bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">ORDER NO.</th>
                    <th className="py-3 px-4">DATE</th>
                    <th className="py-3 px-4">ITEMS</th>
                    <th className="py-3 px-4">AMOUNT</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold font-mono text-blue-600">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(ord.order_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span>📦</span>
                          <span>{ord.items?.length || 1} items</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-slate-900">
                        ₹ {Number(ord.total_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold capitalize">
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                            setStep("tracking");
                          }}
                          className="btn-primary !py-1 !px-3 text-xs font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 9: ORDER NOTIFICATIONS (In-app, Push, Email & SMS)            */}
        {/* Matches Image 2 (Step 9)                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "notifications" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Order Notifications</h2>
                <div className="text-xs text-slate-500">
                  Customer & Staff Real-time Order Alerts (In-App, Push, Email, SMS)
                </div>
              </div>
              <button onClick={() => setStep("list")} className="btn-secondary !py-1.5 !px-3 text-xs">
                Back to Orders
              </button>
            </div>

            {selectedOrder ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Mobile Push Notification Mock */}
                <div className="card p-5 bg-slate-900 text-white rounded-3xl border-4 border-slate-700 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-slate-800 text-xs border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📱</span>
                      <span className="font-bold">In-App & Mobile Push Alerts</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full font-mono">
                      Live Active
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                          <span>✓</span> Order Confirmed
                        </span>
                        <span className="text-[10px] text-slate-400">Live</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Your order #{selectedOrder.order_number} has been confirmed.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                          <span>📦</span> Order Processing
                        </span>
                        <span className="text-[10px] text-slate-400">Status: {selectedOrder.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Your order is being processed for {selectedOrder.customer?.name || "customer"}.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-purple-400 flex items-center gap-1.5">
                          <span>🚚</span> Order Status Alert
                        </span>
                        <span className="text-[10px] text-slate-400">Current</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Order #{selectedOrder.order_number} is currently <span className="text-white font-bold">{selectedOrder.status}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email / SMS Notification Card (Image 2 Step 9) */}
                <div className="card p-6 bg-white border border-border shadow-md rounded-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        ✉️
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Email & SMS Notification</div>
                        <div className="text-[10px] text-slate-400">
                          From: NSY Business &lt;noreply@nsyu.com&gt;
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                      Customer Copy
                    </span>
                  </div>

                  <div className="text-xs space-y-3 leading-relaxed text-slate-700">
                    <p>
                      Hi <strong className="text-slate-900">{selectedOrder.customer?.name || "Customer"}</strong>,
                    </p>
                    <p>
                      Your order <strong className="text-blue-600 font-mono">#{selectedOrder.order_number}</strong> status is now <span className="font-bold text-slate-900">{selectedOrder.status}</span>!
                    </p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-border space-y-2">
                      <div className="font-bold text-slate-900 text-xs">Order Details:</div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Items:</span>
                        <span className="font-bold">{selectedOrder.items?.length || 0} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount:</span>
                        <span className="font-bold text-blue-700 font-mono">
                          ₹ {Number(selectedOrder.total_amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Status:</span>
                        <span className="font-semibold text-emerald-600">{selectedOrder.payment_status || "Paid"}</span>
                      </div>
                    </div>

                    <div className="text-center pt-2">
                      <button
                        onClick={() => setStep("tracking")}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-xs shadow-sm"
                      >
                        Track Your Order
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 pt-3 border-t border-border">
                      Thank you,<br />
                      <strong className="text-slate-700">NSY Business Multi-Shop Management</strong>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No order selected. Please select an order from the Order List to view notifications.
              </div>
            )}
          </div>
        )}
      </div>
    </RequireModule>
  );
}
