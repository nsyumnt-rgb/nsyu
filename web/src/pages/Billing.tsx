import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listProducts } from "../api/products";
import { listCustomers, createCustomer } from "../api/customers";
import { listSales, createSale, downloadInvoicePdf } from "../api/sales";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import type { Customer, Product, Sale } from "../types";
import {
  SuccessModal,
  FailureModal,
  ValidationModal,
  SavingProgressModal,
  ToastNotification,
  type ToastProps,
} from "../components/AnimatedFeedback";

function BillingInner() {
  const navigate = useNavigate();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; unitPrice: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Process & Feedback State matching Reference Design
  const [processing, setProcessing] = useState(false);
  const [savedModalSale, setSavedModalSale] = useState<Sale | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{
    type: ToastProps["type"];
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Recent bills filter & search
  const [billListTab, setBillListTab] = useState<"all" | "paid" | "pending" | "cancelled">("all");
  const [billSearch, setBillSearch] = useState("");

  // Quick Customer Add
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: "", phone: "" });

  function loadData() {
    setLoading(true);
    Promise.all([
      listProducts(),
      listCustomers(),
      listSales({ limit: 15, shopId: shopId || undefined }),
    ])
      .then(([p, c, s]) => {
        setProducts(p.data.data ?? []);
        const custs = c.data.data ?? [];
        setCustomers(custs);
        setRecentSales(s.data.data ?? []);
        if (custs.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(custs[0].id);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [shopId]);

  function getStock(p: Product): number {
    if (!p.stocks || p.stocks.length === 0) return 0;
    const s = p.stocks.find((st) => st.shop_id === shopId);
    return s ? s.current_stock : 0;
  }

  function addToCart(p: Product) {
    const stock = getStock(p);
    if (stock <= 0) {
      setToast({
        type: "error",
        title: "Product Out of Stock",
        subtitle: `No units available for "${p.name}".`,
      });
      return;
    }
    const existingIndex = cart.findIndex((item) => item.product.id === p.id);
    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity >= stock) {
        setToast({
          type: "warning",
          title: "Stock Limit Reached",
          subtitle: `Only ${stock} unit(s) in inventory.`,
        });
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product: p, quantity: 1, unitPrice: Number(p.selling_price) }]);
    }
    setToast({
      type: "success",
      title: `Added "${p.name}" to Bill`,
      subtitle: `Rate: ₹${Number(p.selling_price).toFixed(2)}`,
      actionLabel: "View Bill",
      onAction: () => {
        document.getElementById("billing-cart-panel")?.scrollIntoView({ behavior: "smooth" });
      },
    });
  }

  function updateQuantity(idx: number, delta: number) {
    const item = cart[idx];
    const stock = getStock(item.product);
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else if (newQty > stock) {
      setToast({
        type: "warning",
        title: "Stock Limit Exceeded",
        subtitle: `Maximum stock for "${item.product.name}" is ${stock}.`,
      });
    } else {
      const updated = [...cart];
      updated[idx].quantity = newQty;
      setCart(updated);
    }
  }

  const rawSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const grandTotal = Math.max(0, rawSubtotal - discountAmount);

  async function handleQuickAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await createCustomer({ name: quickCust.name, phone: quickCust.phone });
      const newC = res.data.data!;
      setCustomers([...customers, newC]);
      setSelectedCustomerId(newC.id);
      setShowQuickCustomer(false);
      setQuickCust({ name: "", phone: "" });
      setToast({
        type: "info",
        title: "Customer Added",
        subtitle: `${newC.name} is now selected for this bill.`,
      });
    } catch (err) {
      setToast({
        type: "error",
        title: "Could not add customer",
        subtitle: apiErrorMessage(err, "Please check name and phone."),
      });
    }
  }

  async function handleCheckout() {
    // 1. Validation matching Reference Design
    const errors: string[] = [];
    if (!selectedCustomerId) {
      errors.push("Customer is required. Please select or add a customer.");
    }
    if (cart.length === 0) {
      errors.push("At least one product is required in the cart.");
    }
    const invalidQty = cart.some((i) => i.quantity <= 0);
    if (invalidQty) {
      errors.push("Quantity must be greater than 0 for all items.");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setToast({
        type: "warning",
        title: "Validation Error",
        subtitle: errors[0],
      });
      return;
    }

    // 2. Start saving in progress
    setProcessing(true);
    setFailureReason(null);

    try {
      const res = await createSale({
        customerId: Number(selectedCustomerId),
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        billDiscount: Number(discountAmount) || 0,
        overallDiscount: Number(discountAmount) || 0,
        paidAmount: paidAmount === "" ? grandTotal : Number(paidAmount),
        paymentMethod,
      });

      const sale = res.data.data!;
      // 3. Authoritative server response confirmed: show animated success modal & toast
      setSavedModalSale(sale);
      setRecentSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
      setCart([]);
      setPaidAmount("");
      setDiscountAmount(0);

      setToast({
        type: "success",
        title: "Bill saved successfully!",
        subtitle: `Invoice #${sale.invoice_number}`,
      });

      loadData(); // refresh product stocks & bill list
    } catch (err) {
      // 4. Server error: show failure modal with Retry button & error toast
      const reason = apiErrorMessage(err, "Network or database persistence error.");
      setFailureReason(reason);
      setToast({
        type: "error",
        title: "Failed to save bill.",
        subtitle: "Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function downloadPdf(id: number, num: string) {
    try {
      const res = await downloadInvoicePdf(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${num}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast({
        type: "error",
        title: "Download Failed",
        subtitle: apiErrorMessage(err, "Could not generate invoice PDF."),
      });
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter recent bills by tab & search query matching Screen 4
  const filteredRecentBills = recentSales.filter((s) => {
    // Tab filter
    if (billListTab === "paid" && s.status !== "paid") return false;
    if (billListTab === "pending" && s.status !== "partially_paid" && s.status !== "unpaid") return false;
    if (billListTab === "cancelled" && s.status !== "cancelled") return false;

    // Search query filter
    if (billSearch.trim()) {
      const q = billSearch.toLowerCase();
      const matchInv = s.invoice_number.toLowerCase().includes(q);
      const matchCust = (s.customer?.name || "").toLowerCase().includes(q);
      if (!matchInv && !matchCust) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2 text-slate-900 tracking-tight">
            POS Billing Terminal
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono text-xs">
              {activeShop?.name || "Active Store"}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Authoritative point-of-sale register with real-time Supabase persistence.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app/sales"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>All Sales & Invoices</span>
          </Link>
        </div>
      </div>

      {/* Grid: Left Products, Right Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Catalog & Search */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search product name or SKU code…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto p-1">
            {loading ? (
              <div className="col-span-3 text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading catalogue…</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-slate-400 text-xs">No products found in catalogue.</div>
            ) : (
              filteredProducts.map((p) => {
                const stock = getStock(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={stock <= 0}
                    className={`text-left p-3 rounded-2xl border transition-all ${
                      stock > 0
                        ? "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer group"
                        : "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-blue-600">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{p.sku}</div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-xs">₹{p.selling_price}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          stock > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {stock > 0 ? `Stock: ${stock}` : "Out of stock"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Cart & Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div id="billing-cart-panel" className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4 scroll-mt-20">
            {/* Customer Select Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Customer</label>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomer((v) => !v)}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  {showQuickCustomer ? "Cancel" : "+ Quick Add"}
                </button>
              </div>

              {showQuickCustomer ? (
                <form onSubmit={handleQuickAddCustomer} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <input
                    required
                    placeholder="Customer Name *"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                  />
                  <input
                    placeholder="Phone (optional)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                  />
                  <button type="submit" className="w-full py-1.5 bg-blue-600 text-white font-semibold rounded-lg text-xs cursor-pointer">
                    Save Customer
                  </button>
                </form>
              ) : (
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none shadow-xs"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Cart Items List */}
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-slate-50/50">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Cart is empty. Click a product on the left to add.</div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-white">
                    <div className="truncate max-w-[170px]">
                      <div className="font-semibold text-slate-800 truncate">{item.product.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">₹{item.unitPrice} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-slate-800 w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-mono font-bold text-slate-900">₹{(item.quantity * item.unitPrice).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">₹{rawSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Bill Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-24 px-2 py-1 text-right font-mono text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-100 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-700 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode & Tendered */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none shadow-xs"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Paid Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={String(grandTotal)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-mono font-semibold text-slate-800 text-xs focus:border-blue-500 focus:outline-none shadow-xs"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>

            {/* Primary Action Button (Default, Loading, Disabled matching Reference) */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={processing || cart.length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Save Bill</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SAVED BILLS LIST (UPDATED IN REAL-TIME MATCHING SCREEN 4)       */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Bills
            </h2>
            <p className="text-xs text-slate-500">Live invoices saved in Supabase database for {activeShop?.name || "this shop"}.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input matching Screen 4 */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search bill, customer…"
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs matching Screen 4: [All, Paid, Pending, Cancelled] */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
          {(["all", "paid", "pending", "cancelled"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBillListTab(tab)}
              className={`pb-2.5 capitalize transition-colors relative cursor-pointer ${
                billListTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Bills Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRecentBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    No bills found in this filter. Newly saved bills will show here immediately.
                  </td>
                </tr>
              ) : (
                filteredRecentBills.map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{s.invoice_number}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">{s.customer?.name || "Customer"}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{s.total_amount}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.status === "partially_paid"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {s.status === "paid" ? "Paid" : s.status === "partially_paid" ? "Pending" : s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to={`/app/sales/${s.id}`}
                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg border border-blue-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Bill</span>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ANIMATED MODALS: SUCCESS, SAVING, FAILURE, VALIDATION          */}
      {/* ============================================================== */}
      {savedModalSale && (
        <SuccessModal
          sale={savedModalSale}
          onClose={() => setSavedModalSale(null)}
          onViewBill={() => {
            const id = savedModalSale.id;
            setSavedModalSale(null);
            navigate(`/app/sales/${id}`);
          }}
          onDownloadPdf={() => downloadPdf(savedModalSale.id, savedModalSale.invoice_number)}
        />
      )}

      {failureReason && (
        <FailureModal
          reason={failureReason}
          onRetry={handleCheckout}
          onClose={() => setFailureReason(null)}
        />
      )}

      {validationErrors && (
        <ValidationModal
          errors={validationErrors}
          onClose={() => setValidationErrors(null)}
        />
      )}

      {processing && <SavingProgressModal />}

      {/* Toast Notification (Auto Hide) */}
      {toast && (
        <ToastNotification
          type={toast.type}
          title={toast.title}
          subtitle={toast.subtitle}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function Billing() {
  return (
    <RequireModule module="billing">
      <BillingInner />
    </RequireModule>
  );
}
