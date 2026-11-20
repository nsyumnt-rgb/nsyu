import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listProducts } from "../api/products";
import { listCustomers, createCustomer } from "../api/customers";
import { listSales, createSale, downloadInvoicePdf } from "../api/sales";
import { createOrder } from "../api/orders";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { usePosStore } from "../store/posStore";
import { ChoiceGroup, EmptyState, Icon, IconButton, SearchInput, Segmented } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ProductItemIcon from "../components/ProductItemIcon";
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

  // Cart state - initialized from POS Store so items added from Catalog or Products show up
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const setPosStoreItems = usePosStore((st) => st.setItems);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; unitPrice: number }>>(() => {
    return usePosStore.getState().items || [];
  });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [scanMode, setScanMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The bill drawer is opened from the product cards, the phone bottom bar or the top-bar cart button.
  const cartOpen = usePosStore((st) => st.open);
  const setCartOpen = usePosStore((st) => st.setOpen);

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

  // Sync the Billing cart with usePosStore so cart drawer and topbar stay updated
  useEffect(() => {
    setPosStoreItems(cart);
  }, [cart, setPosStoreItems]);

  useEffect(
    () => () => {
      setCartOpen(false);
    },
    [setCartOpen]
  );

  function getStock(p: Product): number {
    if (!p.stocks || p.stocks.length === 0) return 0;
    const s = p.stocks.find((st) => st.shop_id === shopId);
    return s ? s.current_stock : 0;
  }

  function addToCart(p: Product) {
    const existingIndex = cart.findIndex((item) => item.product.id === p.id);
    if (existingIndex >= 0) {
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
        setCartOpen(true);
      },
    });
  }

  function updateQuantityDirect(idx: number, qty: number) {
    const validQty = Math.max(1, Math.floor(qty));
    const updated = [...cart];
    updated[idx].quantity = validQty;
    setCart(updated);
  }

  function updateUnitPrice(idx: number, price: number) {
    const updated = [...cart];
    updated[idx].unitPrice = Math.max(0, price);
    setCart(updated);
  }

  const pricesIncludeTax = Boolean(activeShop?.settings?.pricesIncludeTax);
  const defaultGstRate =
    activeShop?.settings?.defaultGstRate !== undefined && activeShop?.settings?.defaultGstRate !== null
      ? Number(activeShop.settings.defaultGstRate)
      : 0;

  const rawSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(rawSubtotal, Number(discountAmount) || 0);

  let totalTax = 0;
  let taxableSubtotal = 0;
  let grandTotal = 0;

  if (pricesIncludeTax) {
    grandTotal = Math.max(0, rawSubtotal - discount);
    totalTax = cart.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const rate = defaultGstRate > 0 ? (Number(item.product.tax_percent) || defaultGstRate) : 0;
      if (rate <= 0) return sum;
      const base = lineTotal / (1 + rate / 100);
      return sum + (lineTotal - base);
    }, 0);
    taxableSubtotal = grandTotal - totalTax;
  } else {
    taxableSubtotal = Math.max(0, rawSubtotal - discount);
    totalTax = cart.reduce((sum, item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const proportion = rawSubtotal > 0 ? lineSubtotal / rawSubtotal : 0;
      const lineTaxable = lineSubtotal - (discount * proportion);
      const rate = defaultGstRate > 0 ? (Number(item.product.tax_percent) || defaultGstRate) : 0;
      return sum + (lineTaxable * rate / 100);
    }, 0);
    grandTotal = taxableSubtotal + totalTax;
  }

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
    // Close the bill drawer first so the saving / success / failure / validation dialogs are visible.
    // The cart is kept, so the bill can be reopened and retried.
    setCartOpen(false);

    // 1. Validation
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

    const effectivePaid = paidAmount === "" ? grandTotal : Number(paidAmount);
    if (effectivePaid < 0) {
      errors.push("Paid amount cannot be negative.");
    }
    if (effectivePaid > grandTotal + 0.01) {
      errors.push(`Paid amount (₹${effectivePaid.toFixed(2)}) cannot exceed Grand Total (₹${grandTotal.toFixed(2)}).`);
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
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
        paidAmount: effectivePaid,
        paymentMethod,
        idempotencyKey,
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

  async function handleCreateCustomerOrder() {
    setCartOpen(false);
    const errors: string[] = [];
    if (!selectedCustomerId) {
      errors.push("Customer is required to place an order. Please select or add a customer.");
    }
    if (cart.length === 0) {
      errors.push("At least one product is required in the cart.");
    }
    if (errors.length > 0) {
      setToast({ type: "warning", title: "Cannot Place Order", subtitle: errors[0] });
      return;
    }

    setProcessing(true);
    try {
      const effectivePaid = paidAmount === "" ? grandTotal : Number(paidAmount);
      const isPaid = effectivePaid >= grandTotal - 0.01;
      const res = await createOrder({
        customerId: Number(selectedCustomerId),
        orderType: "Walk-in",
        paymentMethod,
        paymentStatus: isPaid ? "Paid" : "Pending",
        discountAmount: Number(discountAmount) || 0,
        items: cart.map((c) => ({
          productId: c.product.id,
          productName: c.product.name,
          sku: c.product.sku,
          quantity: c.quantity,
          rate: c.unitPrice,
          amount: c.quantity * c.unitPrice,
        })),
      });

      const ord = res.data.data!;
      setCart([]);
      setPaidAmount("");
      setDiscountAmount(0);

      setToast({
        type: "success",
        title: "Customer Order Placed!",
        subtitle: `Order #${ord.order_number} created for ${ord.customer?.name || "customer"}.`,
        actionLabel: "View Orders",
        onAction: () => navigate("/app/orders"),
      });
      loadData();
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Failed to place order",
        subtitle: apiErrorMessage(err, "Please check customer and stock details."),
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

  const categories = Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  const q = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (category !== "all" && p.category?.name !== category) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || String(p.barcode || "").toLowerCase().includes(q);
  });
  const qtyInCart = (id: number) => cart.find((c) => c.product.id === id)?.quantity || 0;
  const itemCount = cart.reduce((a, c) => a + c.quantity, 0);

  /** Barcode scanners type the code and press Enter: add the exact match straight to the bill. */
  function handleSearchEnter() {
    const code = searchQuery.trim().toLowerCase();
    if (!code) return;
    const exact = products.find((p) => String(p.barcode || "").toLowerCase() === code || p.sku.toLowerCase() === code);
    const pick = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (pick) {
      addToCart(pick);
      setSearchQuery("");
    } else {
      setToast({ type: "warning", title: "No exact match", subtitle: `Nothing has barcode or SKU “${searchQuery.trim()}”.` });
    }
  }

  // Filter recent bills by tab & search query
  const filteredRecentBills = recentSales.filter((s) => {
    if (billListTab === "paid" && s.status !== "paid") return false;
    if (billListTab === "pending" && s.status !== "partially_paid" && s.status !== "unpaid") return false;
    if (billListTab === "cancelled" && s.status !== "cancelled") return false;
    if (billSearch.trim()) {
      const bq = billSearch.toLowerCase();
      if (!s.invoice_number.toLowerCase().includes(bq) && !(s.customer?.name || "").toLowerCase().includes(bq)) return false;
    }
    return true;
  });

  const renderBillPanel = (isDrawer = false) => (
    <div className={`flex flex-col ${isDrawer ? "h-full w-full" : "w-full"}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-navy-900">Current Bill</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-0.5">{activeShop?.name || "Shop POS station"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-[11.5px] text-slate-400 hover:text-rose-600 px-2 py-1 rounded hover:bg-rose-50 font-medium transition"
              title="Clear all cart items"
            >
              Clear
            </button>
          )}
          {isDrawer && (
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close bill"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className={`p-4 sm:p-5 space-y-4 overflow-y-auto ${isDrawer ? "flex-1" : "max-h-[calc(100vh-230px)]"}`}>
        {/* Customer Selection */}
        <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-bold text-navy-900 flex items-center gap-1.5">
              <Icon name="user" className="w-3.5 h-3.5 text-brand-700" /> Customer <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowQuickCustomer((v) => !v)}
              className="text-[11.5px] text-brand-700 hover:underline font-bold"
            >
              {showQuickCustomer ? "Cancel" : "+ Quick add"}
            </button>
          </div>
          {showQuickCustomer ? (
            <form onSubmit={handleQuickAddCustomer} className="bg-white p-3 rounded-lg border border-border space-y-2 mt-1 shadow-2xs">
              <input
                required
                placeholder="Customer full name *"
                className="input h-9 text-xs"
                value={quickCust.name}
                onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
              />
              <input
                placeholder="Phone number (optional)"
                className="input h-9 text-xs"
                value={quickCust.phone}
                onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
              />
              <button type="submit" className="btn-primary btn-sm w-full text-xs font-bold">
                Save & Select Customer
              </button>
            </form>
          ) : (
            <select
              className="input h-10 text-[13px] font-medium bg-white"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            >
              {customers.length === 0 && <option value="">No customers yet — quick add one above</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cart Items List */}
        <div>
          <div className="flex items-center justify-between text-[12px] font-bold text-navy-900 mb-2">
            <span>Items in Cart ({cart.length})</span>
            {cart.length > 0 && (
              <span className="text-slate-400 font-mono text-[11px]">Subtotal: ₹{rawSubtotal.toFixed(2)}</span>
            )}
          </div>
          <div className="rounded-xl border border-border divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
            {cart.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Icon name="cart" className="w-5 h-5" />
                </div>
                <div className="text-[13px] font-semibold text-slate-700">The bill is empty</div>
                <div className="text-[11.5px] text-slate-400 mt-0.5">Click any product to add it to this bill.</div>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={item.product.id} className="p-3 space-y-2 hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-2.5">
                    <ProductItemIcon
                      name={item.product.name}
                      category={item.product.category?.name || item.product.brand}
                      sku={item.product.sku}
                      imageUrl={item.product.images?.[0]?.url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-navy-900 truncate" title={item.product.name}>
                        {item.product.name.trim()}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.product.sku}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition"
                      title="Remove item"
                      aria-label={`Remove ${item.product.name}`}
                    >
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label className="flex items-center gap-1 text-[12px] text-slate-500 font-medium">
                      <span>₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateUnitPrice(idx, Number(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-[12px] font-bold rounded-md border border-border tabular focus:border-brand-500 outline-none"
                        title="Editable rate"
                      />
                    </label>
                    <div className="inline-flex items-center rounded-lg border border-border overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity <= 1
                            ? setCart(cart.filter((_, i) => i !== idx))
                            : updateQuantityDirect(idx, item.quantity - 1)
                        }
                        className="w-7 h-7 text-slate-600 hover:bg-white font-bold"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateQuantityDirect(idx, isNaN(val) || val < 1 ? 1 : val);
                        }}
                        className="w-10 h-7 text-center text-[12px] font-bold tabular border-x border-border bg-white outline-none"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantityDirect(idx, item.quantity + 1)}
                        className="w-7 h-7 text-slate-600 hover:bg-white font-bold"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[13.5px] font-bold text-navy-900 tabular min-w-[70px] text-right">
                      ₹{(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calculations & Totals */}
        <div className="space-y-2 text-[12.5px] p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="tabular font-semibold text-slate-700">₹{rawSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Discount (₹)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-24 px-2 py-1 text-right tabular text-[12.5px] font-semibold rounded-md border border-border bg-white focus:border-brand-500 outline-none"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex justify-between text-slate-500">
            <span>GST {pricesIncludeTax ? "(included)" : defaultGstRate ? `(${defaultGstRate}% added)` : "(none)"}</span>
            <span className="tabular font-semibold text-slate-700">₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-[16px] text-navy-900 pt-2 border-t border-slate-200">
            <span>Grand Total</span>
            <span className="tabular text-brand-700">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Options */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[12px] font-bold text-navy-900 block mb-1.5">Payment Method</label>
            <ChoiceGroup
              cols={4}
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={[
                ["cash", "Cash"],
                ["upi", "UPI"],
                ["card", "Card"],
                ["bank_transfer", "Bank"],
              ]}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-bold text-navy-900">Paid Amount (₹)</label>
              <div className="flex gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaidAmount(Number(grandTotal.toFixed(2)))}
                  className="text-brand-700 hover:underline"
                >
                  Full
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setPaidAmount(0)}
                  className="text-rose-600 hover:underline"
                >
                  Unpaid
                </button>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max={Number(grandTotal.toFixed(2))}
              step="0.01"
              placeholder={grandTotal.toFixed(2)}
              className="input tabular font-bold text-[13.5px] bg-white"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value !== "" ? Number(e.target.value) : "")}
            />
            {cart.length > 0 && (() => {
              const previewPaid = paidAmount === "" ? grandTotal : Number(paidAmount);
              const previewDue = Math.max(0, grandTotal - previewPaid);
              const st = previewPaid >= grandTotal - 0.01 ? "Paid" : previewPaid > 0.01 ? "Partial" : "Unpaid";
              return (
                <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                  <span className={st === "Paid" ? "badge-active" : st === "Partial" ? "badge-warn" : "badge-danger"}>
                    {st}
                  </span>
                  <span className="text-slate-500 font-medium">
                    Due <b className="tabular text-navy-900">₹{previewDue.toFixed(2)}</b>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Dual Actions Footer */}
      <div className="p-4 sm:p-5 border-t border-border bg-slate-50/70 space-y-2">
        <button
          type="button"
          onClick={handleCheckout}
          disabled={processing || cart.length === 0}
          className="btn-primary btn-lg w-full h-12 text-[14.5px] font-bold flex items-center justify-center gap-2 shadow-sm"
        >
          {processing ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Icon name="check" className="w-5 h-5" strokeWidth={2.6} /> Complete & Save Bill · ₹{grandTotal.toFixed(2)}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCreateCustomerOrder}
          disabled={processing || cart.length === 0}
          className="w-full h-10 rounded-xl border border-brand-700 bg-white hover:bg-brand-50 text-brand-800 text-[13px] font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          title="Place this bill as a customer sales order in Orders management"
        >
          <Icon name="cart" className="w-4 h-4" /> Place Customer Order
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* 2-Column Responsive POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Toolbar, Product Catalog & Recent Bills */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
          {/* Toolbar: search · barcode · category · add product */}
          <div className="card p-3 sm:p-4 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Icon name="search" className="w-[18px] h-[18px]" />
              </span>
              <input
                ref={searchRef}
                type="text"
                placeholder={scanMode ? "Scan a barcode now…" : "Search product name, SKU or barcode..."}
                className={`input h-12 pl-11 text-[14px] ${scanMode ? "border-brand-500 ring-4 ring-brand-500/10" : ""}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchEnter();
                  }
                }}
                onBlur={() => setScanMode(false)}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setScanMode(true);
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
                className={`w-12 h-12 shrink-0 rounded-lg border flex items-center justify-center transition ${scanMode ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border bg-white text-navy-900 hover:bg-slate-50"}`}
                title="Scan barcode (use a USB / Bluetooth scanner)"
                aria-label="Scan barcode"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <path d="M7 8v8M10 8v8M13 8v8M16 8v8" />
                </svg>
              </button>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input h-12 flex-1 lg:w-64 lg:flex-none font-semibold text-navy-900" aria-label="Category">
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Link to="/app/products?add=1" className="btn-primary h-12 px-5 text-[14px] shrink-0">
                <Icon name="plus" className="w-5 h-5" /> <span className="hidden sm:inline">Add Product</span>
              </Link>
            </div>
          </div>

          {/* Product grid */}
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="h-[150px] rounded-2xl bg-white border border-border animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="box"
                title={products.length === 0 ? "No products yet" : "No products match"}
                text={products.length === 0 ? "Add products to start billing." : "Try another name, SKU, barcode or category."}
                action={
                  products.length === 0 ? (
                    <Link to="/app/products?add=1" className="btn-primary btn-sm"><Icon name="plus" className="w-3.5 h-3.5" /> Add Product</Link>
                  ) : (
                    <button type="button" onClick={() => { setSearchQuery(""); setCategory("all"); }} className="btn-secondary btn-sm">Clear search</button>
                  )
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
              {filteredProducts.map((p) => {
                const stock = getStock(p);
                const inCart = qtyInCart(p.id);
                const img = resolveAssetUrl((p.images?.find((i) => i.is_primary) || p.images?.[0])?.url);
                return (
                  <div key={p.id} className={`group bg-white rounded-2xl border p-3.5 flex gap-3 transition hover:shadow-lift hover:-translate-y-0.5 ${inCart ? "border-brand-300 ring-2 ring-brand-500/10" : "border-border hover:border-brand-200"}`}>
                    <button type="button" onClick={() => addToCart(p)} className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center" aria-label={`Add ${p.name}`}>
                      {img ? (
                        <img src={img} alt="" loading="lazy" className="w-full h-full object-contain" />
                      ) : (
                        <ProductItemIcon name={p.name} category={p.category?.name || p.brand} sku={p.sku} size="lg" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <button type="button" onClick={() => addToCart(p)} className="text-left">
                        <div className="text-[13.5px] font-bold text-navy-900 leading-snug line-clamp-2" title={p.name}>{p.name}</div>
                      </button>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">SKU: {p.sku}</div>
                      <div className="text-[15px] font-bold text-navy-900 font-mono tabular mt-1">₹{Number(p.selling_price || 0).toFixed(2)}</div>
                      <div className="mt-auto pt-2 flex items-center justify-between gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tabular whitespace-nowrap ${stock > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
                          Stock: {stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="relative shrink-0 h-8 px-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white flex items-center gap-0.5 shadow-sm active:scale-95 transition"
                          title="Add to bill"
                          aria-label={`Add ${p.name} to bill`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1" />
                            <circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                          </svg>
                          <span className="text-[13px] font-bold leading-none">+</span>
                          {inCart > 0 && (
                            <span className="absolute -top-2 -right-2 min-w-[18px] h-4.5 px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">{inCart}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent bills */}
          <section className="card overflow-hidden">
            <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="card-title text-[14.5px]">Recent bills</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">Latest bills from {activeShop?.name || "this shop"}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  value={billListTab}
                  onChange={setBillListTab}
                  options={[
                    { key: "all", label: "All" },
                    { key: "paid", label: "Paid" },
                    { key: "pending", label: "Pending" },
                    { key: "cancelled", label: "Cancelled" },
                  ]}
                />
                <SearchInput className="w-full sm:w-[200px]" value={billSearch} onChange={setBillSearch} placeholder="Bill or customer…" />
                <button type="button" onClick={loadData} className="btn-secondary btn-sm">
                  <Icon name="refresh" className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>
            {filteredRecentBills.length === 0 ? (
              <EmptyState compact icon="receipt" title="No bills here" text="New bills show up here right after you save them." />
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th className="!text-right">Amount</th>
                      <th>Status</th>
                      <th className="!text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentBills.map((s) => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap">
                          <div className="font-mono text-[12.5px] font-semibold text-brand-700">{s.invoice_number}</div>
                          <div className="text-[11.5px] text-slate-400">
                            {new Date(s.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="font-medium text-navy-900">{s.customer?.name || "Customer"}</td>
                        <td className="text-right font-bold text-navy-900 tabular whitespace-nowrap">₹{Number(s.total_amount).toFixed(2)}</td>
                        <td>
                          <span className={s.status === "paid" ? "badge-active" : s.status === "partially_paid" ? "badge-warn" : s.status === "cancelled" ? "badge-inactive" : "badge-danger"}>
                            {s.status === "paid" ? "Paid" : s.status === "partially_paid" ? "Partial" : s.status === "cancelled" ? "Cancelled" : "Unpaid"}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <IconButton title="View bill" icon="eye" to={`/app/sales/${s.id}`} />
                            <IconButton title="Download PDF" icon="download" onClick={() => downloadPdf(s.id, s.invoice_number)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Docked Desktop Live Bill Panel */}
        <aside className="hidden lg:flex lg:col-span-5 xl:col-span-4 sticky top-20 flex-col bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
          {renderBillPanel(false)}
        </aside>
      </div>

      {/* Phones: bottom bar to open the bill */}
      {itemCount > 0 && (
        <div className="lg:hidden fixed inset-x-3 bottom-3 z-30">
          <button type="button" onClick={() => setCartOpen(true)} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-navy-900 text-white px-4 py-3 shadow-lift">
            <span className="text-[13.5px] font-semibold">{itemCount} item{itemCount === 1 ? "" : "s"} · <span className="tabular">₹{grandTotal.toFixed(2)}</span></span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">View bill <Icon name="arrowRight" className="w-4 h-4" /></span>
          </button>
        </div>
      )}

      {/* Bill drawer for mobile */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-[2px] animate-fade-in lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <aside id="billing-cart-panel" className="h-full w-full sm:w-[440px] bg-white shadow-2xl flex flex-col" role="dialog" aria-label="Current bill">
            {renderBillPanel(true)}
          </aside>
        </div>
      )}

      {/* Feedback */}
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
      {failureReason && <FailureModal reason={failureReason} onRetry={handleCheckout} onClose={() => setFailureReason(null)} />}
      {validationErrors && <ValidationModal errors={validationErrors} onClose={() => setValidationErrors(null)} />}
      {processing && <SavingProgressModal />}
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
