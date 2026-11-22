import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getOrders,
  getOrderStats,
  createOrder,
  updateOrderStatus,
  convertOrderToBill,
  getOrderById,
  getOrderChannel,
  type OrderChannel,
  type OrderRecord,
  type OrderStats,
} from "../api/orders";
import { listProducts } from "../api/products";
import { listCustomers } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import type { Customer, Product } from "../types";
import { Avatar, ChoiceGroup, EmptyState, Icon, IconButton, Modal, PageHeader, Pagination, SearchInput, Segmented, StatCard } from "../components/ui";
import { listNotificationsApi, type AppNotification } from "../api/notifications";

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
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const defaultGstRate = Number(activeShop?.settings?.defaultGstRate ?? 0);
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
  const [sourceFilter, setSourceFilter] = useState<"all" | OrderChannel>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
  const [convertingToBill, setConvertingToBill] = useState(false);
  const [orderToConvert, setOrderToConvert] = useState<OrderRecord | null>(null);
  const [statusModalOrder, setStatusModalOrder] = useState<OrderRecord | null>(null);
  const [convertPaymentMode, setConvertPaymentMode] = useState<"full" | "unpaid" | "custom">("full");
  const [convertPaidAmount, setConvertPaidAmount] = useState<string>("");
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<string>("cash");
  const [convertNotes, setConvertNotes] = useState<string>("");

  // Real data for the tracking / alerts steps (fetched only when shown).
  const [orderDetail, setOrderDetail] = useState<(OrderRecord & { statusHistory?: HistoryRow[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderNotifs, setOrderNotifs] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if ((step !== "tracking" && step !== "view") || !selectedOrder) return;
    let gone = false;
    setDetailLoading(true);
    getOrderById(selectedOrder.id)
      .then((r) => !gone && setOrderDetail((r.data.data as any) ?? null))
      .catch(() => !gone && setOrderDetail(null))
      .finally(() => !gone && setDetailLoading(false));
    return () => {
      gone = true;
    };
  }, [step, selectedOrder?.id]);

  useEffect(() => {
    if (step !== "notifications" || !selectedOrder) return;
    let gone = false;
    setNotifLoading(true);
    listNotificationsApi(false, 200)
      .then((list) => {
        if (gone) return;
        const rows = list?.notifications ?? [];
        setOrderNotifs(rows.filter((n) => String(n.reference_type).toLowerCase() === "order" && Number(n.reference_id) === Number(selectedOrder.id)));
      })
      .catch(() => !gone && setOrderNotifs([]))
      .finally(() => !gone && setNotifLoading(false));
    return () => {
      gone = true;
    };
  }, [step, selectedOrder?.id]);

  function openConvertModal(ord: OrderRecord) {
    const isDelivered = (ord.status || "").toLowerCase() === "delivered";
    if (!isDelivered) {
      alert(
        `Order #${ord.order_number} must be in "Delivered" status to convert to a bill (current status is "${ord.status}").\n\nPlease update order status to Delivered first.`
      );
      return;
    }
    setOrderToConvert(ord);
    setConvertPaymentMode("full");
    setConvertPaidAmount(String(Number(ord.total_amount || 0)));
    setConvertPaymentMethod("cash");
    setConvertNotes(`Converted from Order #${ord.order_number}`);
  }

  async function handleConvertSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderToConvert) return;
    if (convertingToBill) return;

    const total = Number(orderToConvert.total_amount || 0);
    let finalPaid = 0;
    if (convertPaymentMode === "full") {
      finalPaid = total;
    } else if (convertPaymentMode === "custom") {
      finalPaid = Number(convertPaidAmount || 0);
      if (isNaN(finalPaid) || finalPaid < 0) {
        alert("Please enter a valid payment amount.");
        return;
      }
      if (finalPaid > total + 0.01) {
        alert(`Paid amount (₹${finalPaid}) cannot exceed order total (₹${total}).`);
        return;
      }
    } else {
      finalPaid = 0;
    }

    setConvertingToBill(true);
    try {
      const res = await convertOrderToBill(orderToConvert.id, {
        paidAmount: finalPaid,
        paymentMethod: convertPaymentMethod,
        notes: convertNotes,
      });
      const payload = res?.data?.data as any;
      const convertedOrder = payload?.order || payload;
      const generatedBill = payload?.bill;
      if (convertedOrder && convertedOrder.id) {
        setSelectedOrder(convertedOrder);
      }
      setOrderToConvert(null);
      await loadOrdersData();
      alert(
        generatedBill?.invoice_number
          ? `Order #${orderToConvert.order_number} converted to Bill #${generatedBill.invoice_number} successfully!\n\nCustomer ledger updated: Debit ₹${total}${finalPaid > 0 ? `, Payment Credit ₹${finalPaid}` : ""}.`
          : "Order converted to official tax bill successfully! Customer ledger updated."
      );
      setStep("view");
    } catch (err) {
      alert(apiErrorMessage(err, "Could not convert order to bill"));
      loadOrdersData();
    } finally {
      setConvertingToBill(false);
    }
  }

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
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        shopId: shopId || undefined,
      } as any).catch(() => ({ data: { data: [] } })),
      listProducts({ shopId: shopId || undefined } as any).catch(() => ({ data: { data: [] } })),
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
  }, [statusFilter, paymentFilter, dateFrom, dateTo, shopId]);

  // Calculations for Step 2
  const calcSubtotal = cartItems.reduce((acc, it) => acc + it.price * it.qty, 0);
  const calcDiscount = cartItems.reduce((acc, it) => acc + (it.discountPercent || 0), 0);
  const calcGst = Math.round(((calcSubtotal - calcDiscount) * defaultGstRate) / 100);
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
        taxPercent: defaultGstRate,
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
        force: true,
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
            gstPercent: defaultGstRate,
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
        {/* Step bar (only while inside the order workflow) */}
        {step !== "list" && (
          <div className="card px-3 py-2.5 flex items-center gap-3">
            <button type="button" onClick={() => setStep("list")} className="btn-ghost btn-sm shrink-0">
              <Icon name="left" className="w-3.5 h-3.5" /> All orders
            </button>
            <div className="h-5 w-px bg-slate-200 shrink-0" />
            <div className="min-w-0 overflow-x-auto">
              <Segmented
                size="sm"
                value={step}
                onChange={(k) => setStep(k as WorkflowStep)}
                options={[
                  { key: "create", label: "Create" },
                  { key: "confirmation", label: "Confirmation" },
                  { key: "view", label: "Order view" },
                  { key: "update_status", label: "Update status" },
                  { key: "invoice", label: "Invoice" },
                  { key: "tracking", label: "Tracking" },
                  { key: "history", label: "History" },
                  { key: "notifications", label: "Notifications" },
                ]}
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: ORDER LIST                                                 */}
        {/* ------------------------------------------------------------------ */}
        {step === "list" && (() => {
          const isBilledOrder = (o: OrderRecord) =>
            String(o.status || "").toUpperCase() === "BILLED" || String(o.status || "").toLowerCase() === "converted_to_bill" || Boolean(o.converted_sale_id || o.billed_bill_id);
          const portalPending = orders.filter((o) => getOrderChannel(o) === "online" && String(o.status).toLowerCase() === "pending").length;
          const onlineCount = orders.filter((o) => getOrderChannel(o) === "online").length;
          const sourced = sourceFilter === "all" ? orders : orders.filter((ord) => getOrderChannel(ord) === sourceFilter);
          const pages = Math.max(1, Math.ceil(sourced.length / pageSize));
          const page = Math.min(listPage, pages);
          const pageRows = sourced.slice((page - 1) * pageSize, page * pageSize);
          const statusChip = (o: OrderRecord) => {
            if (isBilledOrder(o)) return { label: "Billed", cls: "badge-brand" };
            const s = String(o.status || "").toLowerCase();
            return (
              {
                pending: { label: "Pending", cls: "badge-warn" },
                confirmed: { label: "Confirmed", cls: "badge-brand" },
                processing: { label: "Processing", cls: "badge bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15" },
                shipped: { label: "Shipped", cls: "badge bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/15" },
                delivered: { label: "Delivered", cls: "badge-active" },
                completed: { label: "Completed", cls: "badge-active" },
                cancelled: { label: "Cancelled", cls: "badge-inactive" },
              } as Record<string, { label: string; cls: string }>
            )[s] || { label: o.status, cls: "badge-inactive" };
          };
          const payChip = (p?: string) =>
            p === "Paid" ? "badge-active" : p === "Pending" || !p ? "badge-warn" : "badge-danger";

          return (
            <div className="space-y-6 pb-10">
              <PageHeader
                eyebrow="Selling"
                title="Orders"
                subtitle="Online and counter orders — move each one from new to delivered, then bill it."
                actions={
                  <button type="button" onClick={() => setStep("create")} className="btn-primary">
                    <Icon name="plus" /> New order
                  </button>
                }
              />

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Total" icon="cart" tone="brand" value={stats.totalOrders.toLocaleString("en-IN")} loading={loading} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} hint="All-time orders" />
                <StatCard label="Pending" icon="clock" tone="amber" value={stats.pendingOrders.toLocaleString("en-IN")} valueClass={stats.pendingOrders ? "text-amber-600" : undefined} loading={loading} active={statusFilter === "pending"} onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")} hint="Needs action" />
                <StatCard label="Processing" icon="box" tone="sky" value={stats.processingOrders.toLocaleString("en-IN")} loading={loading} active={statusFilter === "processing"} onClick={() => setStatusFilter(statusFilter === "processing" ? "all" : "processing")} hint="Being packed" />
                <StatCard label="Delivered" icon="truck" tone="emerald" value={stats.deliveredOrders.toLocaleString("en-IN")} loading={loading} active={statusFilter === "delivered"} onClick={() => setStatusFilter(statusFilter === "delivered" ? "all" : "delivered")} hint="Ready to bill" />
                <StatCard label="Cancelled" icon="ban" tone="rose" value={stats.cancelledOrders.toLocaleString("en-IN")} loading={loading} active={statusFilter === "cancelled"} onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")} hint="Voided" />
              </div>

              {portalPending > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="font-semibold">
                      {portalPending} new online order{portalPending > 1 ? "s" : ""} waiting for review
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("pending");
                      setSourceFilter("online");
                    }}
                    className="btn-soft btn-sm self-start sm:self-auto"
                  >
                    Review <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <section className="card overflow-hidden">
                <div className="p-4 sm:px-5 border-b border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mr-1">Order type</span>
                    <Segmented
                      size="sm"
                      value={sourceFilter}
                      onChange={(v) => { setSourceFilter(v); setListPage(1); }}
                      options={[
                        { key: "all", label: "All", count: orders.length },
                        { key: "online", label: "Online", count: onlineCount },
                        { key: "offline", label: "Offline", count: orders.length - onlineCount },
                      ]}
                    />
                  </div>
                  <Segmented
                    size="sm"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { key: "all", label: "All" },
                      { key: "pending", label: "Pending" },
                      { key: "confirmed", label: "Confirmed" },
                      { key: "processing", label: "Processing" },
                      { key: "shipped", label: "Shipped" },
                      { key: "delivered", label: "Delivered" },
                      { key: "BILLED", label: "Billed" },
                      { key: "cancelled", label: "Cancelled" },
                    ]}
                  />
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <form
                      className="flex-1 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setListPage(1);
                        loadOrdersData();
                      }}
                    >
                      <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder="Order no, customer, phone or email…" />
                      <button type="submit" className="btn-secondary">Search</button>
                    </form>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={`input w-auto py-1.5 pr-8 text-[12.5px] ${paymentFilter !== "all" ? "border-brand-400 bg-brand-50/50 text-brand-800 font-semibold" : ""}`}>
                        <option value="all">Any payment</option>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Payment pending</option>
                        <option value="Failed">Failed</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
                        <span className="sr-only sm:not-sr-only">From</span>
                        <input type="date" aria-label="Orders from date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setListPage(1); }} className="input w-auto py-1.5 text-[12.5px]" />
                      </label>
                      <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
                        <span className="sr-only sm:not-sr-only">To</span>
                        <input type="date" aria-label="Orders to date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setListPage(1); }} className="input w-auto py-1.5 text-[12.5px]" />
                      </label>
                      {(dateFrom || dateTo) && (
                        <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="btn-ghost btn-sm">Clear dates</button>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
                    <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}

                {loading ? (
                  <div className="p-5 space-y-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-20 h-3 rounded bg-slate-100" />
                        <div className="w-7 h-7 rounded-full bg-slate-100" />
                        <div className="flex-1 h-3 rounded bg-slate-100" />
                        <div className="w-16 h-3 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : sourced.length === 0 ? (
                  orders.length === 0 && statusFilter === "all" && paymentFilter === "all" && !search && !dateFrom && !dateTo ? (
                    <EmptyState
                      icon="cart"
                      tone="brand"
                      title="No orders yet"
                      text="Orders from your online store and counter appear here."
                      action={<button type="button" onClick={() => setStep("create")} className="btn-primary btn-sm"><Icon name="plus" className="w-3.5 h-3.5" /> New order</button>}
                    />
                  ) : (
                    <EmptyState icon="search" title="No orders match" text="Try another order type, status, date or search." />
                  )
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th className="!text-right">Amount</th>
                            <th className="whitespace-nowrap">Order type</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th className="!text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((ord) => {
                            const billed = isBilledOrder(ord);
                            const st = statusChip(ord);
                            const itemCount = ord.items?.length || 0;
                            const delivered = String(ord.status).toLowerCase() === "delivered";
                            const open = !billed && String(ord.status).toLowerCase() !== "cancelled";
                            return (
                              <tr key={ord.id} className={String(ord.status).toLowerCase() === "cancelled" ? "opacity-60" : ""}>
                                <td className="whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedOrder(ord);
                                        setStep("view");
                                      }}
                                      className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline"
                                    >
                                      {ord.order_number}
                                    </button>
                                  </div>
                                  <div className="text-[11.5px] text-slate-400">
                                    {new Date(ord.order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    {" · "}
                                    {new Date(ord.order_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </td>
                                <td>
                                  <div className="flex items-center gap-2.5 min-w-[160px]">
                                    <Avatar name={ord.customer?.name || "Walk in"} size="sm" />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-navy-900 truncate max-w-[150px] 2xl:max-w-[220px]">{ord.customer?.name || "Walk-in customer"}</div>
                                      {ord.customer?.phone && <div className="text-[11.5px] text-slate-400 tabular">{ord.customer.phone}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right whitespace-nowrap">
                                  <div className="font-bold text-navy-900 tabular">₹{Number(ord.total_amount).toLocaleString("en-IN")}</div>
                                  {itemCount > 0 && <div className="text-[11px] text-slate-400">{itemCount} item{itemCount > 1 ? "s" : ""}</div>}
                                </td>
                                <td><OrderChannelBadge channel={getOrderChannel(ord)} /></td>
                                <td><span className={payChip(ord.payment_status)}>{ord.payment_status || "Pending"}</span></td>
                                <td><span className={st.cls}>{st.label}</span></td>
                                <td className="text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1">
                                    {open && delivered && (
                                      <button type="button" disabled={convertingToBill} onClick={() => openConvertModal(ord)} className="btn-soft btn-sm">
                                        <Icon name="receipt" className="w-3.5 h-3.5" /> Bill it
                                      </button>
                                    )}
                                    {!billed && (
                                      <button type="button" onClick={() => setStatusModalOrder(ord)} className="btn-soft btn-sm">
                                        <Icon name="refresh" className="w-3.5 h-3.5" /> Update status
                                      </button>
                                    )}
                                    <IconButton title="View order" icon="eye" onClick={() => { setSelectedOrder(ord); setStep("view"); }} />
                                    <IconButton title="Invoice / print" icon="file" onClick={() => { setSelectedOrder(ord); setStep("invoice"); }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile App-like Card Feed */}
                    <div className="md:hidden space-y-3 p-3">
                      {pageRows.map((ord) => {
                        const billed = isBilledOrder(ord);
                        const st = statusChip(ord);
                        const itemCount = ord.items?.length || 0;
                        const delivered = String(ord.status).toLowerCase() === "delivered";
                        const open = !billed && String(ord.status).toLowerCase() !== "cancelled";
                        return (
                          <div
                            key={ord.id}
                            className={`mobile-card p-3.5 space-y-3 ${
                              String(ord.status).toLowerCase() === "cancelled" ? "opacity-60" : ""
                            }`}
                          >
                            {/* Card Top: Order Number & Date & Amount */}
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrder(ord);
                                      setStep("view");
                                    }}
                                    className="font-mono text-[13px] font-bold text-brand-700 hover:underline"
                                  >
                                    {ord.order_number}
                                  </button>
                                  <OrderChannelBadge channel={getOrderChannel(ord)} />
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {new Date(ord.order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {" · "}
                                  {new Date(ord.order_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-navy-900 text-[15px] tabular">
                                  ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                                </div>
                                {itemCount > 0 && (
                                  <div className="text-[11px] text-slate-400">
                                    {itemCount} item{itemCount > 1 ? "s" : ""}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Middle: Customer & Badges */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar name={ord.customer?.name || "Walk in"} size="sm" />
                                <div className="min-w-0">
                                  <div className="font-bold text-navy-900 text-[12.5px] truncate">
                                    {ord.customer?.name || "Walk-in customer"}
                                  </div>
                                  {ord.customer?.phone && (
                                    <div className="text-[11px] text-slate-400 tabular truncate">
                                      {ord.customer.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                <span className={payChip(ord.payment_status)}>{ord.payment_status || "Pending"}</span>
                                <span className={st.cls}>{st.label}</span>
                              </div>
                            </div>

                            {/* Card Bottom: Quick Actions */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedOrder(ord); setStep("view"); }}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                                >
                                  <Icon name="eye" className="w-3.5 h-3.5" /> View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedOrder(ord); setStep("invoice"); }}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                                >
                                  <Icon name="file" className="w-3.5 h-3.5" /> Print
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {open && delivered && (
                                  <button
                                    type="button"
                                    disabled={convertingToBill}
                                    onClick={() => openConvertModal(ord)}
                                    className="btn-soft btn-sm text-xs font-bold"
                                  >
                                    <Icon name="receipt" className="w-3.5 h-3.5" /> Bill it
                                  </button>
                                )}
                                {!billed && (
                                  <button type="button" onClick={() => setStatusModalOrder(ord)} className="btn-soft btn-sm text-xs font-bold">
                                    <Icon name="refresh" className="w-3.5 h-3.5" /> Update status
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Pagination
                      page={page}
                      pages={pages}
                      total={sourced.length}
                      pageSize={pageSize}
                      onPage={(p) => setListPage(Math.min(pages, Math.max(1, p)))}
                      noun="orders"
                      left={
                        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setListPage(1); }} className="input w-auto py-1 pr-7 text-[12px]" aria-label="Rows per page">
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                        </select>
                      }
                    />
                  </>
                )}
              </section>
            </div>
          );
        })()}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2: CREATE NEW ORDER                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === "create" && (() => {
          const pickedCust = availableCustomers.find((c) => c.id === selectedCustId);
          const q = productSearch.trim().toLowerCase();
          const matches = q.length > 1 ? availableProducts.filter((p) => p.name.toLowerCase().includes(q) || String(p.sku || "").toLowerCase().includes(q)).slice(0, 8) : [];
          const money = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return (
            <form onSubmit={handleCreateOrder} className="space-y-5 pb-10">
              <PageHeader eyebrow="Order" title="New order" subtitle="Orders start as Processing. Stock is reduced when the order is billed." />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title text-[14px]">Customer</h2>
                    <Segmented
                      size="sm"
                      value={custType}
                      onChange={setCustType}
                      options={[
                        { key: "existing", label: "Existing" },
                        { key: "new", label: "New" },
                      ]}
                    />
                  </div>
                  <div className="p-5 space-y-3">
                    {custType === "existing" ? (
                      <>
                        <div>
                          <label className="label">Customer *</label>
                          <select value={selectedCustId || ""} onChange={(e) => setSelectedCustId(Number(e.target.value))} className="input">
                            {availableCustomers.length === 0 && <option value="">No customers yet — add a new one</option>}
                            {availableCustomers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.phone ? `(${c.phone})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        {pickedCust && (
                          <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[12.5px]">
                            <Avatar name={pickedCust.name} />
                            <div className="min-w-0">
                              <div className="font-semibold text-navy-900">{pickedCust.name}</div>
                              <div className="text-slate-500 truncate">{[pickedCust.phone, pickedCust.address].filter(Boolean).join(" · ") || "No contact details"}</div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="label">Name *</label>
                          <input className="input" value={newCustName} placeholder="e.g. Rajesh Kumar" onChange={(e) => setNewCustName(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Phone</label>
                            <input className="input tabular" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Delivery address</label>
                          <input className="input" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title text-[14px]">Order details</h2>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Order date</label>
                        <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="input" />
                      </div>
                      <div>
                        <label className="label">Expected delivery</label>
                        <input type="date" value={expectedDeliveryDate} min={orderDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="input" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Order type</label>
                      <ChoiceGroup cols={2} value={orderType} onChange={setOrderType} options={[["Walk-in", "Walk-in"], ["Online", "Online"]]} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Payment method</label>
                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
                          <option>Cash</option>
                          <option>Online / UPI</option>
                          <option>Card</option>
                          <option>Credit</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Payment status</label>
                        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="input">
                          <option>Paid</option>
                          <option>Pending</option>
                          <option>Failed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <section className="card overflow-visible">
                <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <h2 className="card-title text-[14px]">Items</h2>
                  <div className="relative md:w-[360px]">
                    <SearchInput
                      value={productSearch}
                      onChange={setProductSearch}
                      placeholder="Search product by name or SKU…"
                    />
                    {matches.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-auto rounded-xl bg-white border border-border shadow-lift py-1">
                        {matches.map((p) => (
                          <li key={p.id}>
                            <button type="button" onClick={() => addProductToCart(p)} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-brand-50">
                              <span className="min-w-0">
                                <span className="block text-[12.5px] font-medium text-navy-900 truncate">{p.name}</span>
                                <span className="block text-[11px] text-slate-400 font-mono">{p.sku} · stock {Number((p as any).stocks?.[0]?.current_stock ?? 0)}</span>
                              </span>
                              <span className="text-[12.5px] font-semibold tabular text-navy-900">₹{Number(p.selling_price || 0).toLocaleString("en-IN")}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.length > 1 && matches.length === 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl bg-white border border-border shadow-lift px-3 py-2 text-[12.5px] text-slate-500">No product matches “{productSearch}”.</div>
                    )}
                  </div>
                </div>

                {cartItems.length === 0 ? (
                  <EmptyState compact icon="cart" title="No items yet" text="Search above and pick products to add them." />
                ) : (
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="!text-center w-28">Qty</th>
                          <th className="!text-right">Rate</th>
                          <th className="!text-right">GST</th>
                          <th className="!text-right">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item, idx) => {
                          const lineTotal = item.price * item.qty - (item.discountPercent || 0);
                          return (
                            <tr key={idx}>
                              <td>
                                <div className="font-semibold text-navy-900">{item.productName}</div>
                                <div className="font-mono text-[11px] text-slate-400">{item.sku}</div>
                              </td>
                              <td className="text-center">
                                <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                                  <button type="button" onClick={() => setCartItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty - 1) } : it)))} className="w-8 h-8 text-slate-500 hover:bg-slate-50" aria-label="Decrease quantity">−</button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.qty}
                                    onChange={(e) => {
                                      const val = Math.max(1, Number(e.target.value));
                                      setCartItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: val } : it)));
                                    }}
                                    className="w-12 h-8 text-center text-[13px] font-semibold tabular border-x border-border outline-none"
                                    aria-label="Quantity"
                                  />
                                  <button type="button" onClick={() => setCartItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: it.qty + 1 } : it)))} className="w-8 h-8 text-slate-500 hover:bg-slate-50" aria-label="Increase quantity">+</button>
                                </div>
                              </td>
                              <td className="text-right tabular">{money(item.price)}</td>
                              <td className="text-right tabular text-slate-500">{item.gstPercent ? `${item.gstPercent}%` : "—"}</td>
                              <td className="text-right font-bold tabular">{money(lineTotal)}</td>
                              <td className="text-right">
                                <IconButton title="Remove item" icon="trash" tone="rose" onClick={() => removeCartItem(idx)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <dl className="w-full md:w-72 md:order-2 space-y-1.5 text-[13px] rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="tabular">{money(calcSubtotal)}</dd></div>
                    {calcDiscount > 0 && <div className="flex justify-between text-slate-600"><dt>Discount</dt><dd className="tabular text-rose-600">− {money(calcDiscount)}</dd></div>}
                    <div className="flex justify-between text-slate-600"><dt>GST{defaultGstRate ? ` (${defaultGstRate}%)` : ""}</dt><dd className="tabular">{money(calcGst)}</dd></div>
                    <div className="flex justify-between font-bold text-[15px] text-navy-900 pt-1.5 border-t border-slate-200"><dt>Total</dt><dd className="tabular">{money(calcGrandTotal)}</dd></div>
                  </dl>
                  <div className="md:order-1 space-y-3">
                    {error && (
                      <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {error}</p>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setStep("list")} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={savingOrder || cartItems.length === 0} className="btn-primary">
                        {savingOrder ? "Saving…" : "Save order"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </form>
          );
        })()}


        {/* ------------------------------------------------------------------ */}
        {/* STEP 3: ORDER CONFIRMATION                                         */}
        {/* ------------------------------------------------------------------ */}
        {step === "confirmation" && selectedOrder && (
          <div className="card max-w-xl mx-auto overflow-hidden">
            <div className="hero-brand !rounded-none !shadow-none px-6 py-8 text-center">
              <span className="relative mx-auto w-16 h-16 rounded-full bg-white/15 ring-1 ring-inset ring-white/25 flex items-center justify-center">
                <Icon name="check" className="w-8 h-8 text-white" strokeWidth={3} />
              </span>
              <h2 className="relative mt-4 text-[22px] font-bold text-white">Order created</h2>
              <p className="relative text-[13px] text-emerald-50/80 mt-1">#{selectedOrder.order_number} is saved and in Processing.</p>
            </div>
            <div className="p-6 space-y-5">
              <dl className="space-y-2 text-[13px]">
                <InfoRow k="Customer" v={<b>{selectedOrder.customer?.name || "Walk-in customer"}</b>} />
                <InfoRow k="Placed" v={fmtDateTime(selectedOrder.order_date)} />
                <InfoRow k="Payment" v={<span className={selectedOrder.payment_status === "Paid" ? "badge-active" : "badge-warn"}>{selectedOrder.payment_status || "Pending"}</span>} />
                <InfoRow k="Status" v={<span className="badge-brand capitalize">{selectedOrder.status}</span>} />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-navy-900">Total</span>
                  <span className="text-[18px] font-bold text-navy-900 tabular">₹{Number(selectedOrder.total_amount).toLocaleString("en-IN")}</span>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 justify-center">
                <button type="button" onClick={() => setStep("view")} className="btn-primary">
                  <Icon name="eye" /> View order
                </button>
                <button type="button" onClick={() => setStep("invoice")} className="btn-secondary">
                  <Icon name="file" className="w-4 h-4 text-slate-500" /> Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCartItems([]);
                    setStep("create");
                  }}
                  className="btn-ghost"
                >
                  <Icon name="plus" /> Another order
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ------------------------------------------------------------------ */}
        {/* STEP 4: ORDER VIEW / DETAILS                                       */}
        {/* ------------------------------------------------------------------ */}
        {step === "view" && selectedOrder && (() => {
          const o = selectedOrder;
          const s = String(o.status || "").toLowerCase();
          const billed = s === "billed" || s === "converted_to_bill" || Boolean(o.converted_sale_id || o.billed_bill_id);
          const linkedSaleId = o.billed_bill_id || o.converted_sale_id;
          const money = (n: unknown) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const openUpdate = (status?: string, remarks?: string) => {
            setStatusUpdateForm({
              status: status || o.status.charAt(0).toUpperCase() + o.status.slice(1),
              payment_status: o.payment_status || "Pending",
              remarks: remarks || o.remarks || "Status updated.",
            });
            setStep("update_status");
          };
          return (
            <div className="space-y-5 pb-10">
              <PageHeader
                eyebrow="Order"
                title={`#${o.order_number}`}
                subtitle={`${o.customer?.name || "Walk-in customer"} · placed ${fmtDateTime(o.order_date)}`}
                actions={
                  <>
                    <button type="button" onClick={() => setStep("invoice")} className="btn-secondary">
                      <Icon name="file" className="w-4 h-4 text-slate-500" /> Invoice
                    </button>
                    <button type="button" onClick={() => setStep("tracking")} className="btn-secondary">
                      <Icon name="truck" className="w-4 h-4 text-slate-500" /> Tracking
                    </button>
                  </>
                }
              />

              {!billed && s !== "cancelled" && (
                <OrderStatusEditor
                  key={`${o.id}-${o.status}-${o.payment_status}`}
                  order={o}
                  onSaved={(updated) => {
                    setSelectedOrder(updated);
                    getOrderById(updated.id)
                      .then((r) => setOrderDetail((r.data.data as any) ?? null))
                      .catch(() => {});
                    loadOrdersData();
                  }}
                />
              )}

              {/* Next step */}
              {billed ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-brand-800">
                    <Icon name="checkCircle" className="w-4 h-4" /> Billed{o.billed_at ? ` on ${fmtDateTime(o.billed_at, false)}` : ""}{o.convertedSale?.invoice_number ? ` as ${o.convertedSale.invoice_number}` : ""}.
                  </span>
                  {linkedSaleId && (
                    <Link to={`/app/sales/${linkedSaleId}`} className="btn-primary btn-sm self-start sm:self-auto">
                      View bill <Icon name="arrowRight" className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ) : s === "delivered" ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
                    <Icon name="truck" className="w-4 h-4" /> Delivered — ready to bill.
                  </span>
                  <button type="button" onClick={() => openConvertModal(o)} disabled={convertingToBill} className="btn-primary btn-sm self-start sm:self-auto">
                    <Icon name="receipt" className="w-3.5 h-3.5" /> {convertingToBill ? "Converting…" : "Convert to bill"}
                  </button>
                </div>
              ) : s !== "cancelled" ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-amber-800">
                    <Icon name="clock" className="w-4 h-4" /> Currently <b className="capitalize">{s}</b>. Mark it delivered to bill it.
                  </span>
                  <button type="button" onClick={() => openUpdate("Delivered", "Order marked Delivered.")} className="btn-secondary btn-sm self-start sm:self-auto">
                    <Icon name="truck" className="w-3.5 h-3.5" /> Mark delivered
                  </button>
                </div>
              ) : null}

              <section className="card p-5 sm:p-6">
                <OrderTimeline order={o} history={orderDetail?.id === o.id ? orderDetail.statusHistory : undefined} loading={detailLoading} />
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InfoCard title="Order">
                  <InfoRow k="Order type" v={<OrderChannelBadge channel={getOrderChannel(o)} />} />
                  <InfoRow k="Fulfilment" v={o.order_type || "—"} />
                  <InfoRow k="Payment method" v={o.payment_method || "—"} />
                  <InfoRow k="Payment" v={<span className={o.payment_status === "Paid" ? "badge-active" : "badge-warn"}>{o.payment_status || "Pending"}</span>} />
                  {o.expected_delivery_date && <InfoRow k="Expected" v={fmtDateTime(o.expected_delivery_date, false)} />}
                  {o.remarks && <div className="pt-2 border-t border-slate-100 text-slate-500">{o.remarks}</div>}
                </InfoCard>
                <InfoCard title="Customer">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={o.customer?.name || "Walk in"} size="sm" />
                    <div className="font-semibold text-navy-900">{o.customer?.name || "Walk-in customer"}</div>
                  </div>
                  {o.customer?.phone && <div className="text-slate-600 tabular">{o.customer.phone}</div>}
                  {o.customer?.email && <div className="text-slate-600 truncate">{o.customer.email}</div>}
                  <div className="text-slate-600">{o.shipping_address || o.customer?.address || "Store pickup"}</div>
                </InfoCard>
                <InfoCard title="Amount">
                  <InfoRow k="Subtotal" v={<span className="tabular">{money(o.subtotal)}</span>} />
                  {Number(o.discount_amount) > 0 && <InfoRow k="Discount" v={<span className="tabular text-rose-600">− {money(o.discount_amount)}</span>} />}
                  <InfoRow k="GST" v={<span className="tabular">{money(o.tax_amount)}</span>} />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-semibold text-navy-900">Total</span>
                    <span className="text-[16px] font-bold text-navy-900 tabular">{money(o.total_amount)}</span>
                  </div>
                </InfoCard>
              </div>

              <section className="card overflow-hidden">
                <div className="card-header">
                  <h2 className="card-title text-[14px]">Items</h2>
                  <span className="text-[12px] text-slate-400">{o.items?.length || 0}</span>
                </div>
                {!o.items?.length ? (
                  <EmptyState compact icon="box" title="No items on this order" />
                ) : (
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="!text-right">Qty</th>
                          <th className="!text-right">Rate</th>
                          <th className="!text-right">Disc.</th>
                          <th className="!text-right">GST</th>
                          <th className="!text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td>
                              <div className="font-semibold text-navy-900">{it.product_name}</div>
                              {it.sku && <div className="font-mono text-[11px] text-slate-400">{it.sku}</div>}
                            </td>
                            <td className="text-right font-semibold tabular">{it.quantity}</td>
                            <td className="text-right tabular">{money(it.rate)}</td>
                            <td className="text-right tabular text-slate-500">{Number(it.discount_percent) ? `${Number(it.discount_percent)}%` : "—"}</td>
                            <td className="text-right tabular text-slate-500">{Number(it.gst_percent) ? `${Number(it.gst_percent)}%` : "—"}</td>
                            <td className="text-right font-bold tabular">{money(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          );
        })()}


        {/* ------------------------------------------------------------------ */}
        {/* STEP 5: UPDATE ORDER STATUS                                        */}
        {/* ------------------------------------------------------------------ */}
        {step === "update_status" && selectedOrder && (
          <form onSubmit={handleUpdateStatusSubmit} className="space-y-5 pb-10 max-w-3xl">
            <PageHeader eyebrow="Order" title={`Update #${selectedOrder.order_number}`} subtitle={`${selectedOrder.customer?.name || "Walk-in customer"} · ₹${Number(selectedOrder.total_amount).toLocaleString("en-IN")}`} />

            <section className="card">
              <div className="card-header">
                <h2 className="card-title text-[14px]">New status</h2>
                <span className="text-[12px] text-slate-500">
                  Now: <span className="badge-inactive capitalize">{selectedOrder.status}</span>
                </span>
              </div>
              <div className="p-5 space-y-5">
                <ChoiceGroup
                  cols={3}
                  value={statusUpdateForm.status}
                  onChange={(k) => setStatusUpdateForm((prev) => ({ ...prev, status: k }))}
                  options={[
                    ["Pending", "Pending"],
                    ["Confirmed", "Accepted"],
                    ["Processing", "Packed"],
                    ["Shipped", "Shipped"],
                    ["Delivered", "Delivered"],
                    ["Cancelled", "Cancelled"],
                  ]}
                />
                {statusUpdateForm.status === "Cancelled" && (
                  <p className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
                    <Icon name="alert" className="w-4 h-4 shrink-0" /> Cancelling stops this order. The customer sees it as cancelled in their portal.
                  </p>
                )}
                <div>
                  <label className="label">Payment status</label>
                  <ChoiceGroup
                    cols={3}
                    value={statusUpdateForm.payment_status}
                    onChange={(k) => setStatusUpdateForm((prev) => ({ ...prev, payment_status: k }))}
                    options={[
                      ["Paid", "Paid"],
                      ["Pending", "Pending"],
                      ["Failed", "Failed"],
                    ]}
                  />
                </div>
                <div>
                  <label className="label">Note / tracking details</label>
                  <textarea
                    rows={3}
                    value={statusUpdateForm.remarks}
                    onChange={(e) => setStatusUpdateForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Update note or courier tracking ID…"
                    className="input"
                  />
                </div>
                {error && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {error}</p>
                )}
              </div>
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 rounded-b-card flex justify-end gap-2">
                <button type="button" onClick={() => setStep("view")} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={updatingStatus} className="btn-primary">{updatingStatus ? "Updating…" : "Save status"}</button>
              </div>
            </section>
          </form>
        )}


        {/* ------------------------------------------------------------------ */}
        {/* STEP 6: ORDER INVOICE (Print or download PDF)                      */}
        {/* ------------------------------------------------------------------ */}
        {step === "invoice" && selectedOrder && (() => {
          const shop = selectedOrder.shop || (activeShop as any) || {};
          const money = (n: unknown) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return (
            <div className="space-y-5 pb-10">
              <div className="no-print">
                <PageHeader
                  eyebrow="Order"
                  title={`Invoice for #${selectedOrder.order_number}`}
                  subtitle="Order summary for the customer. Converting the order to a bill creates the official tax invoice."
                  actions={
                    <>
                      <button type="button" onClick={() => setStep("view")} className="btn-secondary">
                        <Icon name="left" className="w-4 h-4" /> Back
                      </button>
                      <button type="button" onClick={() => window.print()} className="btn-primary">
                        <Icon name="download" /> Print / save PDF
                      </button>
                    </>
                  }
                />
              </div>

              <div className="card p-6 sm:p-8 max-w-3xl mx-auto space-y-6 text-slate-900 print:shadow-none print:border-none print:p-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-6 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center text-[15px] font-bold shrink-0">
                      {String(shop.name || "S").trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[18px] font-bold text-navy-900 truncate">{shop.name || "Your shop"}</h3>
                      {shop.address && <p className="text-[12px] text-slate-500">{shop.address}</p>}
                      <p className="text-[12px] text-slate-500">{[shop.phone, shop.email].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                  <div className="sm:text-right text-[12.5px] space-y-0.5">
                    <div className="text-[18px] font-bold tracking-[0.12em] text-navy-900">ORDER</div>
                    <div className="font-mono">#{selectedOrder.order_number}</div>
                    <div className="text-slate-500">{fmtDateTime(selectedOrder.order_date, false)}</div>
                    <div className="pt-1 flex sm:justify-end gap-1.5">
                      <span className={selectedOrder.payment_status === "Paid" ? "badge-active" : "badge-warn"}>{selectedOrder.payment_status || "Payment pending"}</span>
                      <span className="badge-inactive capitalize">{String(selectedOrder.status).replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[12.5px] space-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 mb-1">Bill to</div>
                  <div className="font-bold text-[14px] text-navy-900">{selectedOrder.customer?.name || "Walk-in customer"}</div>
                  {(selectedOrder.shipping_address || selectedOrder.customer?.address) && <div className="text-slate-600">{selectedOrder.shipping_address || selectedOrder.customer?.address}</div>}
                  {selectedOrder.customer?.phone && <div className="text-slate-600 tabular">{selectedOrder.customer.phone}</div>}
                  {selectedOrder.customer?.email && <div className="text-slate-600">{selectedOrder.customer.email}</div>}
                </div>

                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-8">#</th>
                        <th>Item</th>
                        <th className="!text-right">Qty</th>
                        <th className="!text-right">Rate</th>
                        <th className="!text-right">Disc.</th>
                        <th className="!text-right">GST</th>
                        <th className="!text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="text-slate-400">{idx + 1}</td>
                          <td>
                            <div className="font-semibold text-navy-900">{it.product_name}</div>
                            {it.sku && <div className="font-mono text-[11px] text-slate-400">{it.sku}</div>}
                          </td>
                          <td className="text-right font-semibold tabular">{it.quantity}</td>
                          <td className="text-right tabular">{money(it.rate)}</td>
                          <td className="text-right tabular text-slate-500">{Number(it.discount_percent) ? `${Number(it.discount_percent)}%` : "—"}</td>
                          <td className="text-right tabular text-slate-500">{Number(it.gst_percent) ? `${Number(it.gst_percent)}%` : "—"}</td>
                          <td className="text-right font-bold tabular">{money(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <dl className="w-full sm:w-72 space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="tabular">{money(selectedOrder.subtotal)}</dd></div>
                    {Number(selectedOrder.discount_amount) > 0 && (
                      <div className="flex justify-between text-slate-600"><dt>Discount</dt><dd className="tabular text-rose-600">− {money(selectedOrder.discount_amount)}</dd></div>
                    )}
                    <div className="flex justify-between text-slate-600"><dt>GST</dt><dd className="tabular">{money(selectedOrder.tax_amount)}</dd></div>
                    <div className="flex justify-between font-bold text-[15px] text-navy-900 pt-2 border-t border-border"><dt>Total</dt><dd className="tabular">{money(selectedOrder.total_amount)}</dd></div>
                  </dl>
                </div>

                <div className="pt-5 border-t border-border text-center text-[12px] text-slate-500">Thank you for your order!</div>
              </div>
            </div>
          );
        })()}


        {/* ------------------------------------------------------------------ */}
        {/* STEP 7: CUSTOMER ORDER TRACKING                                    */}
        {/* ------------------------------------------------------------------ */}
        {step === "tracking" && (
          <div className="space-y-5 pb-10">
            <PageHeader
              eyebrow="Order"
              title={selectedOrder ? `Tracking #${selectedOrder.order_number}` : "Order tracking"}
              subtitle="Where this order is right now — the same timeline the customer sees in their portal."
            />
            {!selectedOrder ? (
              <div className="card">
                <EmptyState icon="truck" title="No order selected" text="Pick an order from the list to see its timeline." action={<button type="button" onClick={() => setStep("list")} className="btn-secondary btn-sm">All orders</button>} />
              </div>
            ) : (
              <>
                <section className="card p-5 sm:p-6">
                  <OrderTimeline order={selectedOrder} history={orderDetail?.id === selectedOrder.id ? orderDetail.statusHistory : undefined} loading={detailLoading} />
                </section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoCard title="Order">
                    <InfoRow k="Order no." v={<span className="font-mono font-semibold text-brand-700">{selectedOrder.order_number}</span>} />
                    <InfoRow k="Placed" v={fmtDateTime(selectedOrder.order_date)} />
                    {selectedOrder.expected_delivery_date && <InfoRow k="Expected" v={fmtDateTime(selectedOrder.expected_delivery_date, false)} />}
                    <InfoRow k="Amount" v={<b className="tabular">₹{Number(selectedOrder.total_amount).toLocaleString("en-IN")}</b>} />
                    <InfoRow k="Payment" v={<span className={selectedOrder.payment_status === "Paid" ? "badge-active" : "badge-warn"}>{selectedOrder.payment_status || "Pending"}</span>} />
                  </InfoCard>
                  <InfoCard title="Deliver to">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={selectedOrder.customer?.name || "Walk in"} size="sm" />
                      <div className="font-semibold text-navy-900">{selectedOrder.customer?.name || "Walk-in customer"}</div>
                    </div>
                    <div className="text-slate-600 mt-2">{selectedOrder.shipping_address || selectedOrder.customer?.address || "Store pickup"}</div>
                    {selectedOrder.customer?.phone && <div className="text-slate-500 tabular mt-1">{selectedOrder.customer.phone}</div>}
                  </InfoCard>
                  <InfoCard title={`Items (${selectedOrder.items?.length || 0})`}>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <ul className="divide-y divide-slate-100">
                        {selectedOrder.items.map((it, idx) => (
                          <li key={it.id || idx} className="flex justify-between gap-3 py-1.5">
                            <span className="text-slate-700 truncate">{it.product_name}</span>
                            <span className="font-semibold tabular">×{it.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-slate-400">No items on this order.</div>
                    )}
                  </InfoCard>
                </div>
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 8: THIS CUSTOMER'S ORDERS                                     */}
        {/* ------------------------------------------------------------------ */}
        {step === "history" && (() => {
          const custId = selectedOrder?.customer_id ?? selectedOrder?.customer?.id;
          const mine = custId ? orders.filter((o) => (o.customer_id ?? o.customer?.id) === custId) : [];
          const spent = mine.filter((o) => String(o.status).toLowerCase() !== "cancelled").reduce((a, o) => a + Number(o.total_amount || 0), 0);
          return (
            <div className="space-y-5 pb-10">
              <PageHeader
                eyebrow="Customer"
                title={selectedOrder?.customer?.name ? `${selectedOrder.customer.name}'s orders` : "Customer orders"}
                subtitle={custId ? `${mine.length} order${mine.length === 1 ? "" : "s"} in the current list · ₹${Math.round(spent).toLocaleString("en-IN")} ordered (excluding cancelled)` : "Pick an order first to see that customer's other orders."}
                actions={
                  custId ? (
                    <Link to={`/app/customers?tab=ledger&customerId=${custId}`} className="btn-secondary">
                      <Icon name="file" className="w-4 h-4 text-slate-500" /> Ledger
                    </Link>
                  ) : undefined
                }
              />
              <section className="card overflow-hidden">
                {!custId ? (
                  <EmptyState icon="users" title="No customer selected" text="Open an order from the list, then come back here." action={<button type="button" onClick={() => setStep("list")} className="btn-secondary btn-sm">All orders</button>} />
                ) : mine.length === 0 ? (
                  <EmptyState icon="cart" title="No other orders" text="Only orders in the current list filters are shown." />
                ) : (
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Items</th>
                          <th className="!text-right">Amount</th>
                          <th>Status</th>
                          <th className="!text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mine.map((ord) => (
                          <tr key={ord.id} className={ord.id === selectedOrder?.id ? "!bg-brand-50/60" : ""}>
                            <td className="whitespace-nowrap">
                              <div className="font-mono text-[12.5px] font-semibold text-brand-700">{ord.order_number}</div>
                              <div className="text-[11.5px] text-slate-400">{fmtDateTime(ord.order_date, false)}</div>
                            </td>
                            <td className="text-slate-600">{ord.items?.length ? `${ord.items.length} item${ord.items.length > 1 ? "s" : ""}` : "—"}</td>
                            <td className="text-right font-bold text-navy-900 tabular whitespace-nowrap">₹{Number(ord.total_amount).toLocaleString("en-IN")}</td>
                            <td><span className="badge-inactive capitalize">{String(ord.status).replace(/_/g, " ")}</span></td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setStep("tracking");
                                }}
                                className="btn-soft btn-sm"
                              >
                                <Icon name="truck" className="w-3.5 h-3.5" /> Track
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          );
        })()}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 9: NOTIFICATIONS RECORDED FOR THIS ORDER                       */}
        {/* ------------------------------------------------------------------ */}
        {step === "notifications" && (
          <div className="space-y-5 pb-10">
            <PageHeader
              eyebrow="Order"
              title={selectedOrder ? `Alerts for #${selectedOrder.order_number}` : "Order alerts"}
              subtitle="In-app notifications recorded for this order in your inbox. NSYU does not send email or SMS."
            />
            {!selectedOrder ? (
              <div className="card">
                <EmptyState icon="clock" title="No order selected" text="Pick an order from the list to see its alerts." action={<button type="button" onClick={() => setStep("list")} className="btn-secondary btn-sm">All orders</button>} />
              </div>
            ) : (
              <section className="card overflow-hidden">
                {notifLoading ? (
                  <div className="py-12 text-center text-[13px] text-slate-500">Loading alerts…</div>
                ) : orderNotifs.length === 0 ? (
                  <EmptyState icon="clock" title="No alerts for this order" text="New orders and status changes create alerts; none were recorded in your inbox for this one." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {orderNotifs.map((n) => (
                      <li key={n.id} className="px-5 py-3.5 flex gap-3">
                        <span className={`w-9 h-9 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 ${n.is_read ? "bg-slate-50 text-slate-400 ring-slate-500/10" : "bg-brand-50 text-brand-600 ring-brand-600/10"}`}>
                          <Icon name="cart" className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-[13px] font-semibold ${n.is_read ? "text-slate-700" : "text-navy-900"}`}>{n.title}</span>
                            <span className="text-[11.5px] text-slate-400 whitespace-nowrap">{fmtDateTime(n.created_at)}</span>
                          </div>
                          <p className="text-[12.5px] text-slate-500 mt-0.5">{n.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* CONVERT TO BILL MODAL                                            */}
        {/* ================================================================ */}
        {statusModalOrder && (
          <UpdateStatusModal
            order={statusModalOrder}
            onClose={() => setStatusModalOrder(null)}
            onSaved={(updated) => {
              if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
              setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
              loadOrdersData();
            }}
          />
        )}

        {orderToConvert && (
          <Modal
            size="sm"
            icon="receipt"
            title="Convert order to bill"
            subtitle={`#${orderToConvert.order_number} · ${orderToConvert.customer?.name || "Walk-in customer"}`}
            onClose={() => setOrderToConvert(null)}
            footer={
              <>
                <button type="button" onClick={() => setOrderToConvert(null)} className="btn-secondary">Cancel</button>
                <button type="submit" form="convert-order-form" disabled={convertingToBill} className="btn-primary">
                  {convertingToBill ? "Creating bill…" : "Create bill & post to ledger"}
                </button>
              </>
            }
          >
            <form id="convert-order-form" onSubmit={handleConvertSubmit} className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <span className="text-[12.5px] font-medium text-emerald-800">Order total</span>
                <span className="text-[16px] font-bold text-emerald-800 tabular">₹{Number(orderToConvert.total_amount).toLocaleString("en-IN")}</span>
              </div>
              <div>
                <label className="label">Payment received on delivery</label>
                <ChoiceGroup
                  cols={3}
                  value={convertPaymentMode}
                  onChange={(k) => {
                    setConvertPaymentMode(k);
                    if (k === "full") setConvertPaidAmount(String(Number(orderToConvert.total_amount || 0)));
                    if (k === "unpaid") setConvertPaidAmount("0");
                  }}
                  options={[
                    ["full", "Full"],
                    ["unpaid", "Nothing yet"],
                    ["custom", "Part"],
                  ]}
                />
              </div>
              {convertPaymentMode === "custom" && (
                <div>
                  <label className="label">Amount received (₹)</label>
                  <input type="number" step="any" min="0" max={Number(orderToConvert.total_amount)} value={convertPaidAmount} onChange={(e) => setConvertPaidAmount(e.target.value)} placeholder="Amount collected" className="input text-[15px] font-semibold tabular" required autoFocus />
                </div>
              )}
              {convertPaymentMode !== "unpaid" && (
                <div>
                  <label className="label">Method</label>
                  <ChoiceGroup
                    cols={5}
                    value={convertPaymentMethod}
                    onChange={setConvertPaymentMethod}
                    options={[
                      ["cash", "Cash"],
                      ["upi", "UPI"],
                      ["bank_transfer", "Bank"],
                      ["card", "Card"],
                      ["cheque", "Cheque"],
                    ]}
                  />
                </div>
              )}
              <p className="flex gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[12px] text-slate-600 leading-relaxed">
                <Icon name="alert" className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                One time only: creates the tax bill, reduces stock, and posts the bill (and any payment) to the customer's ledger.
              </p>
            </form>
          </Modal>
        )}
      </div>
    </RequireModule>
  );
}

/* ───────────────────────── tracking helpers ───────────────────────── */

type HistoryRow = { id?: number; from_status: string; to_status: string; note?: string | null; created_at?: string };

const TRACK_STAGES: { key: string; label: string }[] = [
  { key: "pending", label: "Placed" },
  { key: "confirmed", label: "Accepted" },
  { key: "processing", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function fmtDateTime(d?: string | null, withTime = true) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return withTime
    ? `${dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
    : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Timeline built only from real data: the order's current status decides how
 * far it got; times come from the status history when the API returns it, and
 * "Placed" uses the order date. Nothing is invented.
 */
function OrderTimeline({ order, history, loading }: { order: OrderRecord; history?: HistoryRow[]; loading: boolean }) {
  const s = String(order.status || "").toLowerCase();
  const billed = s === "billed" || s === "converted_to_bill" || s === "completed" || Boolean(order.converted_sale_id || order.billed_bill_id);
  const cancelled = s === "cancelled";
  const reached = billed ? TRACK_STAGES.length - 1 : Math.max(0, TRACK_STAGES.findIndex((st) => st.key === s));
  const timeOf = (key: string) => {
    if (key === "pending") return order.order_date;
    const row = [...(history || [])].reverse().find((h) => String(h.to_status).toLowerCase() === key);
    return row?.created_at ?? (row as any)?.createdAt;
  };
  const pct = cancelled ? 0 : (reached / (TRACK_STAGES.length - 1)) * 100;

  return (
    <div>
      {cancelled && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">
          <Icon name="ban" className="w-4 h-4" /> This order was cancelled{timeOf("cancelled") ? ` on ${fmtDateTime(timeOf("cancelled"))}` : ""}.
        </div>
      )}
      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-4 h-1 rounded-full bg-slate-100" />
        <div className="absolute left-[10%] top-4 h-1 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct * 0.8}%` }} />
        <ol className="relative grid grid-cols-5">
          {TRACK_STAGES.map((st, idx) => {
            const done = !cancelled && idx <= reached;
            const current = !cancelled && idx === reached && !billed;
            const t = done ? timeOf(st.key) : undefined;
            return (
              <li key={st.key} className="flex flex-col items-center text-center px-1">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold ring-4 ${
                    done ? "bg-emerald-600 text-white ring-emerald-100" : "bg-white text-slate-400 border-2 border-slate-200 ring-transparent"
                  } ${current ? "animate-pulse" : ""}`}
                >
                  {done ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : idx + 1}
                </span>
                <span className={`mt-2 text-[12px] font-semibold ${done ? "text-navy-900" : "text-slate-400"}`}>{st.label}</span>
                <span className="text-[10.5px] text-slate-400 min-h-[14px]">{loading && done && st.key !== "pending" ? "…" : t ? fmtDateTime(t) : done ? "" : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {billed && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-[13px] text-brand-800">
          <Icon name="receipt" className="w-4 h-4" /> Billed{order.convertedSale?.invoice_number ? ` as ${order.convertedSale.invoice_number}` : ""}{order.billed_at ? ` on ${fmtDateTime(order.billed_at)}` : ""}.
        </div>
      )}
      {history && history.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-400 mb-2.5">Status changes</div>
          <ul className="space-y-2">
            {[...history].reverse().map((h, i) => (
              <li key={h.id ?? i} className="flex items-start gap-3 text-[12.5px]">
                <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                <span className="flex-1 text-slate-700">
                  <span className="capitalize">{String(h.from_status).replace(/_/g, " ")}</span> → <b className="capitalize text-navy-900">{String(h.to_status).replace(/_/g, " ")}</b>
                  {h.note ? <span className="text-slate-500"> · {h.note}</span> : null}
                </span>
                <span className="text-slate-400 whitespace-nowrap">{fmtDateTime(h.created_at ?? (h as any).createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 text-[13px]">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="text-navy-900 text-right">{v}</span>
    </div>
  );
}

/** Online = placed by the customer (portal/marketplace); Offline = entered at the shop counter. */
function OrderChannelBadge({ channel }: { channel: OrderChannel }) {
  return channel === "online" ? (
    <span className="badge bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20" title="Placed by the customer online">
      <Icon name="globe" className="w-3 h-3" /> Online
    </span>
  ) : (
    <span className="badge bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20" title="Entered at the shop counter">
      <Icon name="store" className="w-3 h-3" /> Offline
    </span>
  );
}

const STATUS_OPTIONS: [string, string][] = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["processing", "Processing"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
];
const PAYMENT_OPTIONS = ["Pending", "Paid", "Failed"];
/** Mirrors the server's allowed transitions so the dropdown only offers valid moves. */
const NEXT_STATUSES: Record<string, string[]> = {
  cancelled: ["pending", "confirmed"],
};
const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];
const statusLabel = (k: string) => STATUS_OPTIONS.find(([v]) => v === k)?.[1] ?? k.replace(/_/g, " ");

/** Shared state + save for the inline editor and the row modal. */
function useOrderStatusForm(order: OrderRecord, onSaved: (o: OrderRecord) => void) {
  const current = String(order.status || "").toLowerCase();
  const currentPay = order.payment_status || "Pending";
  const [status, setStatus] = useState(current);
  const [payment, setPayment] = useState(currentPay);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allowed = NEXT_STATUSES[current];
  const rank = (k: string) => {
    const i = STATUS_OPTIONS.findIndex(([v]) => v === k);
    return i < 0 ? -1 : i;
  };
  const statusOptions: [string, string][] = [
    [current, statusLabel(current)] as [string, string],
    ...STATUS_OPTIONS.filter(([k]) => k !== current && (!allowed || allowed.includes(k))),
  ].sort((a, b) => rank(a[0]) - rank(b[0]));
  const paymentOptions = PAYMENT_OPTIONS.includes(currentPay) ? PAYMENT_OPTIONS : [currentPay, ...PAYMENT_OPTIONS];
  const dirty = status !== current || payment !== currentPay || note.trim() !== "";
  const cancelling = status === "cancelled" && current !== "cancelled";

  async function save(): Promise<boolean> {
    if (cancelling && !window.confirm(`Cancel order #${order.order_number}? The customer will see it as cancelled.`)) return false;
    setSaving(true);
    setErr(null);
    try {
      const res = await updateOrderStatus(order.id, {
        status: status !== current ? status : undefined,
        payment_status: payment !== currentPay ? payment : undefined,
        remarks: note.trim() || undefined,
      });
      if (res.data.data) onSaved(res.data.data);
      return true;
    } catch (e) {
      setErr(apiErrorMessage(e, "Failed to update order status"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { current, status, setStatus, payment, setPayment, note, setNote, saving, err, dirty, cancelling, statusOptions, paymentOptions, save };
}

function CancelWarning() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
      <Icon name="alert" className="w-4 h-4 shrink-0" /> Cancelling stops this order. The customer sees it as cancelled in their portal.
    </p>
  );
}

/** Inline status + payment dropdowns with Save, shown on the order details page. */
function OrderStatusEditor({ order, onSaved }: { order: OrderRecord; onSaved: (o: OrderRecord) => void }) {
  const f = useOrderStatusForm(order, onSaved);
  const [done, setDone] = useState(false);
  return (
    <section className="card p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end">
        <div>
          <label className="label" htmlFor="order-status">Order status</label>
          <select id="order-status" value={f.status} onChange={(e) => f.setStatus(e.target.value)} className="input capitalize">
            {f.statusOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="order-payment">Payment status</label>
          <select id="order-payment" value={f.payment} onChange={(e) => f.setPayment(e.target.value)} className="input">
            {f.paymentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="order-note">Note (optional)</label>
          <input id="order-note" value={f.note} onChange={(e) => f.setNote(e.target.value)} placeholder="e.g. courier tracking ID" className="input" />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (await f.save()) {
              setDone(true);
              setTimeout(() => setDone(false), 2500);
            }
          }}
          disabled={!f.dirty || f.saving}
          className="btn-primary"
        >
          <Icon name={done ? "check" : "edit"} className="w-4 h-4" /> {f.saving ? "Saving…" : done ? "Saved" : "Save"}
        </button>
      </div>
      {f.cancelling && <div className="mt-3"><CancelWarning /></div>}
      {f.err && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {f.err}</p>}
    </section>
  );
}

/** Modal opened from the "Update status" button on each order row. */
function UpdateStatusModal({ order, onClose, onSaved }: { order: OrderRecord; onClose: () => void; onSaved: (o: OrderRecord) => void }) {
  const f = useOrderStatusForm(order, onSaved);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    let gone = false;
    getOrderById(order.id)
      .then((r) => !gone && setHistory(((r.data.data as any)?.statusHistory as HistoryRow[]) ?? []))
      .catch(() => !gone && setHistory([]));
    return () => {
      gone = true;
    };
  }, [order.id]);

  const step = FLOW.indexOf(f.status);
  const rows = [...(history ?? [])].sort((a, b) => Date.parse(b.created_at || (b as any).createdAt || "") - Date.parse(a.created_at || (a as any).createdAt || ""));

  return (
    <Modal
      icon="edit"
      title={`Update status · #${order.order_number}`}
      subtitle={`${order.customer?.name || "Walk-in customer"} · ₹${Number(order.total_amount).toLocaleString("en-IN")}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          <button
            type="button"
            onClick={async () => {
              if (await f.save()) onClose();
            }}
            disabled={!f.dirty || f.saving}
            className="btn-primary"
          >
            {f.saving ? "Saving…" : f.cancelling ? "Cancel order" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Progress: Pending → Confirmed → Processing → Shipped → Delivered */}
        <ol className="flex items-start gap-1" aria-label="Order progress">
          {FLOW.map((k, i) => {
            const on = f.status !== "cancelled" && step >= i;
            return (
              <li key={k} className="flex-1 min-w-0">
                <div className={`h-1.5 rounded-full ${on ? "bg-brand-600" : "bg-slate-200"}`} />
                <div className={`mt-1.5 text-[10.5px] sm:text-[11.5px] font-semibold truncate ${f.status === k ? "text-brand-700" : on ? "text-slate-600" : "text-slate-400"}`}>{statusLabel(k)}</div>
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="modal-order-status">Order status</label>
            <select id="modal-order-status" value={f.status} onChange={(e) => f.setStatus(e.target.value)} className="input">
              {f.statusOptions.map(([k, label]) => <option key={k} value={k}>{k === f.current ? `${label} (current)` : label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="modal-order-payment">Payment status</label>
            <select id="modal-order-payment" value={f.payment} onChange={(e) => f.setPayment(e.target.value)} className="input">
              {f.paymentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="modal-order-note">Note (optional)</label>
          <input id="modal-order-note" value={f.note} onChange={(e) => f.setNote(e.target.value)} placeholder="e.g. courier tracking ID" className="input" />
        </div>
        {f.cancelling && <CancelWarning />}
        {f.err && <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {f.err}</p>}

        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Status history</h3>
          {history === null ? (
            <p className="text-[12.5px] text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[12.5px] text-slate-400">No changes yet. Placed {fmtDateTime(order.order_date)}.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
              {rows.map((h, i) => (
                <li key={h.id ?? i} className="flex items-start justify-between gap-3 px-3 py-2 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900">
                      {h.from_status ? `${statusLabel(String(h.from_status).toLowerCase())} → ` : ""}
                      {statusLabel(String(h.to_status).toLowerCase())}
                    </div>
                    {h.note && <div className="text-slate-500 truncate">{h.note}</div>}
                  </div>
                  <div className="shrink-0 text-right text-slate-400 tabular">{h.created_at || (h as any).createdAt ? fmtDateTime(h.created_at || (h as any).createdAt) : "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
