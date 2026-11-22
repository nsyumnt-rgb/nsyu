import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { usePosStore } from "../store/posStore";
import { useAuthStore } from "../store/authStore";
import { resolveAssetUrl, apiErrorMessage } from "../api/client";
import { listCustomers, createCustomer } from "../api/customers";
import { createSale, downloadInvoicePdf } from "../api/sales";
import { createOrder } from "../api/orders";
import { Icon } from "../components/ui";
import ProductItemIcon from "../components/ProductItemIcon";
import type { Customer, Sale } from "../types";
import {
  SuccessModal,
  FailureModal,
  ValidationModal,
  SavingProgressModal,
  ToastNotification,
  type ToastProps,
} from "../components/AnimatedFeedback";

function formatINR(val: number, decimals = 2): string {
  return "₹" + Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}

const initials = (name: string) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const CARD = "bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Small inline icons not in the shared icon set. */
function BankIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z" />
    </svg>
  );
}
function UpiIcon({ className = "" }: { className?: string }) {
  return <span className={`font-black italic tracking-tighter text-[11px] leading-none ${className}`} aria-hidden>UPI</span>;
}

/**
 * Cart & Checkout for POS billing, shown full-screen over POS Billing.
 * `onClose` returns to the product grid ("Add items" / "Close").
 */
export default function Cart({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const backToProducts = onClose ?? (() => navigate("/app/billing"));
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  function getStock(p: any): number {
    if (!p) return 0;
    if (typeof p.current_stock === "number") return p.current_stock;
    const stocks = p.stocks || [];
    if (stocks.length > 0) {
      const targetId = shopId || activeShop?.id;
      if (targetId) {
        const match = stocks.find((st: any) => Number(st.shop_id) === Number(targetId));
        if (match && match.current_stock !== undefined && match.current_stock !== null) {
          return Number(match.current_stock);
        }
      }
      return Number(stocks[0]?.current_stock || 0);
    }
    return 0;
  }

  // POS Store
  const items = usePosStore((s) => s.items);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const updateUnitPrice = usePosStore((s) => s.updateUnitPrice);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const setItems = usePosStore((s) => s.setItems);

  // Customer selection & quick add
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: "", phone: "", shopName: "", email: "" });
  const [quickCustError, setQuickCustError] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  // Rate mode: selling price (counter) vs live price (online)
  const [priceSource, setPriceSource] = useState<"selling" | "live">(() => {
    try {
      return (localStorage.getItem("nsyu_billing_price_source") as "selling" | "live") || "selling";
    } catch {
      return "selling";
    }
  });

  // Payment & checkout state
  const [paymentMethod, setPaymentMethod] = useState("cash");
  /** Amount the customer handed over. "" = exactly the bill total. */
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [editingDiscount, setEditingDiscount] = useState(false);

  // Feedback & modals
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

  // Load customers
  useEffect(() => {
    listCustomers()
      .then((res) => {
        const custs = res.data.data ?? [];
        setCustomers(custs);
        if (custs.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(custs[0].id);
        }
      })
      .catch(() => {});
  }, [shopId, activeShop?.id]);

  // Close the customer search list / quick-add popover on outside click
  useEffect(() => {
    if (!customerSearchOpen && !showQuickCustomer) return;
    const onDown = (e: MouseEvent) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerSearchOpen(false);
        setShowQuickCustomer(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [customerSearchOpen, showQuickCustomer]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => c.name?.toLowerCase().includes(q) || String(c.phone || "").includes(q) || String(c.shop_name || "").toLowerCase().includes(q))
      : customers;
    return list.slice(0, 8);
  }, [customers, customerQuery]);

  // Shop Owner enabled payment methods + Unpaid (Credit / Udhaar) option
  const enabledPaymentOptions = useMemo(() => {
    const s = (activeShop?.settings || {}) as Record<string, any>;
    const opts: Array<{ value: string; label: string; icon: ReactNode }> = [];

    const allowCash = s.enableCash !== false;
    const allowUpi = s.enableUpi !== false;
    const allowCard = s.enableCard !== false;
    const allowBank = s.enableNetBanking !== false && s.enableBank !== false;

    if (allowCash) opts.push({ value: "cash", label: "Cash", icon: <Icon name="wallet" className="w-4 h-4" /> });
    if (allowUpi) opts.push({ value: "upi", label: "UPI", icon: <UpiIcon /> });
    if (allowCard) opts.push({ value: "card", label: "Card", icon: <Icon name="card" className="w-4 h-4" /> });
    if (allowBank) opts.push({ value: "bank_transfer", label: "Bank", icon: <BankIcon /> });
    // Unpaid bill — the full amount goes to the customer's khata (credit)
    opts.push({ value: "unpaid", label: "Credit", icon: <Icon name="book" className="w-4 h-4" /> });

    return opts;
  }, [activeShop?.settings]);

  useEffect(() => {
    if (enabledPaymentOptions.length > 0 && !enabledPaymentOptions.some((o) => o.value === paymentMethod)) {
      setPaymentMethod(enabledPaymentOptions[0].value);
    }
  }, [enabledPaymentOptions, paymentMethod]);

  function handlePriceSourceChange(newMode: "selling" | "live") {
    if (newMode === priceSource) return;
    setPriceSource(newMode);
    try {
      localStorage.setItem("nsyu_billing_price_source", newMode);
    } catch {}

    if (items.length > 0) {
      const updated = items.map((item) => {
        const targetRate =
          newMode === "live" && item.product.live_price && Number(item.product.live_price) > 0
            ? Number(item.product.live_price)
            : Number(item.product.selling_price || 0);
        return { ...item, unitPrice: targetRate };
      });
      setItems(updated);
      setToast({
        type: "info",
        title: `Billing rate: ${newMode === "live" ? "Live price" : "Counter price"}`,
        subtitle: `Cart rates updated to ${newMode === "live" ? "online live prices" : "counter selling prices"}.`,
      });
    }
  }

  // Tax & Totals calculation
  const pricesIncludeTax = Boolean(activeShop?.settings?.pricesIncludeTax);
  const defaultGstRate =
    activeShop?.settings?.defaultGstRate !== undefined && activeShop?.settings?.defaultGstRate !== null
      ? Number(activeShop.settings.defaultGstRate)
      : 0;

  const totalQty = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const rawSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0),
    [items]
  );

  const discount = Math.min(rawSubtotal, Number(discountAmount) || 0);

  let totalTax = 0;
  let taxableSubtotal = 0;
  let grandTotal = 0;

  if (pricesIncludeTax) {
    grandTotal = Math.max(0, rawSubtotal - discount);
    totalTax = items.reduce((sum, item) => {
      const lineTotal = item.quantity * Number(item.unitPrice || 0);
      const rate = defaultGstRate > 0 ? (Number(item.product.tax_percent) || defaultGstRate) : 0;
      if (rate <= 0) return sum;
      const base = lineTotal / (1 + rate / 100);
      return sum + (lineTotal - base);
    }, 0);
    taxableSubtotal = grandTotal - totalTax;
  } else {
    taxableSubtotal = Math.max(0, rawSubtotal - discount);
    totalTax = items.reduce((sum, item) => {
      const lineSubtotal = item.quantity * Number(item.unitPrice || 0);
      const proportion = rawSubtotal > 0 ? lineSubtotal / rawSubtotal : 0;
      const lineTaxable = lineSubtotal - discount * proportion;
      const rate = defaultGstRate > 0 ? (Number(item.product.tax_percent) || defaultGstRate) : 0;
      return sum + (lineTaxable * rate) / 100;
    }, 0);
    grandTotal = taxableSubtotal + totalTax;
  }
  grandTotal = Math.round(grandTotal * 100) / 100;

  // Payment figures
  const isCredit = paymentMethod === "unpaid";
  const received = isCredit ? 0 : amountReceived === "" ? grandTotal : Number(amountReceived);
  const paidNow = Math.min(Math.max(0, received), grandTotal);
  const changeDue = paymentMethod === "cash" ? Math.max(0, received - grandTotal) : 0;
  const balanceDue = Math.max(0, grandTotal - paidNow);

  async function handleQuickAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    const name = quickCust.name.trim();
    const phone = quickCust.phone.replace(/\D/g, "");
    const email = quickCust.email.trim();
    const shopName = quickCust.shopName.trim();
    if (!name) return setQuickCustError("Enter the customer's name.");
    if (phone.length !== 10) return setQuickCustError("Enter a 10-digit mobile number.");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setQuickCustError("Enter a valid email or leave it empty.");
    setQuickCustError(null);
    setSavingCustomer(true);
    try {
      const res = await createCustomer({ name, phone, shopName: shopName || undefined, email: email || undefined });
      const newC = res.data.data!;
      setCustomers((prev) => [...prev, newC]);
      setSelectedCustomerId(newC.id);
      setShowQuickCustomer(false);
      setCustomerSearchOpen(false);
      setCustomerQuery("");
      setQuickCust({ name: "", phone: "", shopName: "", email: "" });
      setToast({ type: "info", title: "Customer added", subtitle: `${newC.name} is selected for this bill.` });
    } catch (err) {
      setQuickCustError(apiErrorMessage(err, "Could not add customer. Check the name and mobile number."));
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCheckout() {
    const errors: string[] = [];
    if (!selectedCustomerId) {
      errors.push("Customer is required. Please select or add a customer.");
    }
    if (items.length === 0) {
      errors.push("At least one product is required in the cart.");
    }
    if (items.some((i) => i.quantity <= 0)) {
      errors.push("Quantity must be greater than 0 for all items.");
    }
    if (!isCredit && received < 0) {
      errors.push("Amount received cannot be negative.");
    }
    if (!isCredit && paymentMethod !== "cash" && received > grandTotal + 0.01) {
      errors.push(`Amount received (${formatINR(received)}) cannot be more than the total (${formatINR(grandTotal)}) for ${paymentMethod.toUpperCase()}.`);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setProcessing(true);
    try {
      const rateLabel = priceSource === "live" ? "Live Price" : "Selling Price";
      const res = await createSale({
        customerId: Number(selectedCustomerId),
        items: items.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        overallDiscount: discount,
        paymentMethod: paymentMethod,
        paidAmount: paidNow,
        notes:
          `POS Bill from Cart (${rateLabel})` +
          (changeDue > 0 ? ` · Cash received ${formatINR(received)}, change ${formatINR(changeDue)}` : ""),
      });

      const newSale = res.data.data!;
      clearCart();
      setAmountReceived("");
      setDiscountAmount(0);
      setSavedModalSale(newSale);
    } catch (err: any) {
      setFailureReason(apiErrorMessage(err, "Could not save bill. Please try again."));
    } finally {
      setProcessing(false);
    }
  }

  async function handleCreateCustomerOrder() {
    if (!selectedCustomerId) {
      setValidationErrors(["Customer is required to place a sales order."]);
      return;
    }
    if (items.length === 0) {
      setValidationErrors(["Cart is empty. Please add products to place an order."]);
      return;
    }

    setProcessing(true);
    try {
      const res = await createOrder({
        customerId: Number(selectedCustomerId),
        orderType: "customer",
        paymentMethod: isCredit ? "unpaid" : paymentMethod,
        paymentStatus: isCredit ? "unpaid" : paidNow >= grandTotal - 0.01 ? "paid" : paidNow > 0 ? "partial" : "unpaid",
        discountAmount: discount,
        items: items.map((c) => ({
          productId: c.product.id,
          productName: c.product.name,
          sku: c.product.sku,
          quantity: c.quantity,
          rate: c.unitPrice,
          amount: c.quantity * c.unitPrice,
        })),
      });

      const ord = res.data.data!;
      clearCart();
      setAmountReceived("");
      setDiscountAmount(0);

      setToast({
        type: "success",
        title: "Customer order placed",
        subtitle: `Order #${ord.order_number} created for ${ord.customer?.name || "customer"}.`,
        actionLabel: "View orders",
        onAction: () => navigate("/app/orders"),
      });
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
      setToast({ type: "error", title: "Download failed", subtitle: apiErrorMessage(err, "Could not generate invoice PDF.") });
    }
  }

  const photoOf = (p: any) => {
    const cover = (p.images?.find((img: any) => img.is_primary) || p.images?.[0])?.url;
    const url = cover || p.cover_image || (p.photos && p.photos[0]?.url) || null;
    return url ? resolveAssetUrl(url) ?? undefined : undefined;
  };

  const qtyStepper = (productId: number, quantity: number) => (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => updateQuantity(productId, quantity - 1)}
        className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => updateQuantity(productId, Math.max(1, parseInt(e.target.value) || 1))}
        className="w-9 h-7 text-center text-[13px] font-semibold text-navy-900 border-x border-slate-200 focus:outline-none tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => updateQuantity(productId, quantity + 1)}
        className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );

  const priceInput = (productId: number, unitPrice: number, className = "") => (
    <label className={`inline-flex items-center justify-end rounded-lg border border-transparent hover:border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15 px-1.5 transition ${className}`} title="Click to edit the rate">
      <span className="text-slate-500 text-[13.5px]">₹</span>
      <input
        type="number"
        step="any"
        min="0"
        value={unitPrice}
        onChange={(e) => updateUnitPrice(productId, Number(e.target.value) || 0)}
        style={{ width: `${Math.min(9, Math.max(2, String(unitPrice).length)) + 1}ch` }}
        className="h-8 bg-transparent text-left text-[13.5px] text-slate-700 tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Rate"
      />
    </label>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-8 h-16">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Icon name="cart" className="w-6 h-6 text-navy-900 shrink-0" />
            <h1 className="text-[17px] sm:text-[20px] font-bold text-navy-900 tracking-tight whitespace-nowrap">Cart &amp; Checkout</h1>
            {activeShop?.name && (
              <>
                <span className="hidden sm:block w-px h-6 bg-slate-200" />
                <span className="hidden sm:flex items-center gap-2 text-[15px] text-slate-500 min-w-0">
                  <Icon name="store" className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeShop.name}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-medium text-slate-700">
              <Icon name="cart" className="w-3.5 h-3.5" /> {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <button type="button" onClick={backToProducts} className="px-2 py-1.5 text-[14px] font-medium text-slate-700 hover:text-navy-900 rounded-lg hover:bg-slate-100 transition">
              Close
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-clip">
        {items.length === 0 ? (
          <div className="max-w-lg mx-auto px-4 py-16">
            <div className={`${CARD} p-10 text-center`}>
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <Icon name="cart" className="w-8 h-8" />
              </div>
              <h2 className="text-[17px] font-bold text-navy-900">Your cart is empty</h2>
              <p className="text-[13px] text-slate-500 mt-1.5">Scan a barcode or pick products in POS Billing to start a bill.</p>
              <button type="button" onClick={backToProducts} className="btn-primary mt-6 mx-auto">
                <Icon name="plus" className="w-4 h-4" /> Add items
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[1440px] mx-auto px-3 sm:px-8 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] gap-4 sm:gap-6 items-start">
            {/* Items */}
            <section className={`${CARD} p-4 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-label="Billing rate">
                  {(
                    [
                      ["selling", "Counter Price"],
                      ["live", "Live Price"],
                    ] as const
                  ).map(([mode, label]) => {
                    const on = priceSource === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => handlePriceSourceChange(mode)}
                        className={`px-4 h-9 rounded-[10px] text-[13.5px] font-medium transition ${
                          on ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/70 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={backToProducts}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13.5px] font-medium text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition"
                >
                  <Icon name="plus" className="w-4 h-4" /> Add items
                </button>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block mt-5">
                <div className="grid grid-cols-[minmax(0,1fr)_96px_112px_96px_40px] items-center gap-3 pb-2.5 border-b border-slate-200 text-[13px] text-slate-500">
                  <span>Product</span>
                  <span className="text-right pr-1.5">Price</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const p = item.product || {};
                    const stock = getStock(p);
                    const out = stock <= 0;
                    const lineTotal = Number(item.unitPrice || 0) * item.quantity;
                    return (
                      <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_96px_112px_96px_40px] items-center gap-3 py-3.5">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <ProductItemIcon name={p.name} category={p.category?.name || p.brand} sku={p.sku} imageUrl={photoOf(p)} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[14.5px] font-medium text-navy-900 truncate" title={p.name}>{p.name}</span>
                              {out && (
                                <span className="inline-flex items-center gap-1 shrink-0 text-[12px] font-medium text-rose-600">
                                  <Icon name="alert" className="w-3.5 h-3.5" /> Out of stock
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[12.5px] text-slate-500 truncate">
                              {p.sku || "No SKU"} · <span className={out ? "text-rose-600" : undefined}>{stock} in stock</span>
                              {priceSource === "live" && p.live_price && Number(p.live_price) === Number(item.unitPrice) ? " · Live rate" : ""}
                            </div>
                          </div>
                        </div>
                        {priceInput(p.id, item.unitPrice)}
                        <div className="flex justify-center">{qtyStepper(p.id, item.quantity)}</div>
                        <span className="text-right text-[14.5px] font-semibold text-navy-900 tabular">{formatINR(lineTotal, 0)}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(p.id)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                          aria-label={`Remove ${p.name}`}
                          title="Remove"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Phone list */}
              <ul className="md:hidden mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {items.map((item) => {
                  const p = item.product || {};
                  const stock = getStock(p);
                  const out = stock <= 0;
                  const lineTotal = Number(item.unitPrice || 0) * item.quantity;
                  return (
                    <li key={p.id} className="py-3 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <ProductItemIcon name={p.name} category={p.category?.name || p.brand} sku={p.sku} imageUrl={photoOf(p)} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium text-navy-900 line-clamp-2 [overflow-wrap:anywhere]">{p.name}</div>
                          <div className="mt-0.5 text-[12px] text-slate-500 truncate">
                            {p.sku || "No SKU"} · <span className={out ? "text-rose-600 font-medium" : undefined}>{out ? "Out of stock" : `${stock} in stock`}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(p.id)}
                          className="w-8 h-8 -mr-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-[60px]">
                        {priceInput(p.id, item.unitPrice, "-ml-1.5")}
                        {qtyStepper(p.id, item.quantity)}
                        <span className="text-[14px] font-semibold text-navy-900 tabular min-w-[64px] text-right">{formatINR(lineTotal, 0)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove all items from this cart?")) clearCart();
                  }}
                  className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-rose-600 transition"
                >
                  <Icon name="trash" className="w-4 h-4" /> Clear cart
                </button>
              </div>
            </section>

            {/* Checkout column */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              {/* Customer */}
              <section ref={customerBoxRef} className={`${CARD} p-4 sm:p-5 relative`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-navy-900">
                    Customer <span className="text-rose-500">*</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickCustomer((v) => !v);
                      setCustomerSearchOpen(false);
                      setQuickCustError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-emerald-700 hover:text-emerald-800"
                    aria-expanded={showQuickCustomer}
                  >
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-current flex items-center justify-center">
                      <Icon name="plus" className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    Add Customer
                  </button>
                </div>

                <div className="relative mt-3">
                  <input
                    type="search"
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerSearchOpen(true);
                    }}
                    onFocus={() => {
                      setCustomerSearchOpen(true);
                      setShowQuickCustomer(false);
                    }}
                    placeholder="Search by name or mobile number"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-[13.5px] text-navy-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                    aria-label="Search customers"
                  />
                  <Icon name="search" className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {customerSearchOpen && (
                    <ul className="absolute z-20 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
                      {customerMatches.length === 0 ? (
                        <li className="px-3 py-3 text-[13px] text-slate-500">
                          No customer found.{" "}
                          <button
                            type="button"
                            className="font-medium text-emerald-700 hover:underline"
                            onClick={() => {
                              const q = customerQuery.trim();
                              setQuickCust({ name: /^\d+$/.test(q) ? "" : q, phone: /^\d+$/.test(q) ? q : "", shopName: "", email: "" });
                              setCustomerSearchOpen(false);
                              setShowQuickCustomer(true);
                            }}
                          >
                            Add a new customer
                          </button>
                        </li>
                      ) : (
                        customerMatches.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={c.id === selectedCustomerId}
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerQuery("");
                                setCustomerSearchOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50 ${c.id === selectedCustomerId ? "bg-emerald-50/60" : ""}`}
                            >
                              <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span>
                              <span className="min-w-0">
                                <span className="block text-[13.5px] font-medium text-navy-900 truncate">{c.name}</span>
                                {(c.phone || c.shop_name) && <span className="block text-[12px] text-slate-500 truncate"><span className="tabular">{c.phone}</span>{c.shop_name ? ` · ${c.shop_name}` : ""}</span>}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>

                {selectedCustomer ? (
                  <div className="mt-3 flex items-center gap-3.5 rounded-xl px-1 py-1.5">
                    <span className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 text-[14px] font-semibold flex items-center justify-center shrink-0">
                      {initials(selectedCustomer.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium text-navy-900 truncate">{selectedCustomer.name}</div>
                      {(selectedCustomer.phone || selectedCustomer.shop_name) && (
                        <div className="text-[13px] text-slate-500 truncate">
                          <span className="tabular">{selectedCustomer.phone}</span>
                          {selectedCustomer.shop_name ? ` · ${selectedCustomer.shop_name}` : ""}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearchOpen(true);
                        setShowQuickCustomer(false);
                        (customerBoxRef.current?.querySelector('input[type="search"]') as HTMLInputElement | null)?.focus();
                      }}
                      className="text-[13.5px] font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] text-slate-500">Search for a customer or add a new one.</p>
                )}

                {/* Add New Customer popover */}
                {showQuickCustomer && (
                  <form
                    onSubmit={handleQuickAddCustomer}
                    className="absolute z-30 right-3 left-3 sm:left-auto sm:right-4 top-12 sm:w-[340px] rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-up"
                    aria-label="Add new customer"
                  >
                    <div className="px-5 py-3.5 border-b border-slate-100 text-[15px] font-semibold text-navy-900">Add New Customer</div>
                    <div className="px-5 py-4 space-y-3.5">
                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1" htmlFor="qc-name">
                          Customer name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="qc-name"
                          autoFocus
                          value={quickCust.name}
                          onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                          placeholder="Enter customer name"
                          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1" htmlFor="qc-phone">
                          Mobile number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="qc-phone"
                          inputMode="numeric"
                          maxLength={10}
                          value={quickCust.phone}
                          onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                          placeholder="Enter mobile number"
                          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] tabular outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1" htmlFor="qc-shop">
                          Shop name (optional)
                        </label>
                        <input
                          id="qc-shop"
                          maxLength={150}
                          value={quickCust.shopName}
                          onChange={(e) => setQuickCust({ ...quickCust, shopName: e.target.value })}
                          placeholder="Customer's shop or business name"
                          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1" htmlFor="qc-email">
                          Email (optional)
                        </label>
                        <input
                          id="qc-email"
                          type="email"
                          value={quickCust.email}
                          onChange={(e) => setQuickCust({ ...quickCust, email: e.target.value })}
                          placeholder="Enter email address"
                          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      {quickCustError && (
                        <p className="flex items-center gap-1.5 text-[12px] text-rose-600">
                          <Icon name="alert" className="w-3.5 h-3.5 shrink-0" /> {quickCustError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setShowQuickCustomer(false)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                          Cancel
                        </button>
                        <button type="submit" disabled={savingCustomer} className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium disabled:opacity-60">
                          {savingCustomer ? "Saving…" : "Save & Select"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </section>

              {/* Order summary */}
              <section className={`${CARD} p-4 sm:p-5`}>
                <h2 className="text-[15px] font-semibold text-navy-900">Order Summary</h2>
                <dl className="mt-3 space-y-2.5 text-[13.5px]">
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Subtotal</dt>
                    <dd className="text-slate-700 tabular">{formatINR(rawSubtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Discount</dt>
                    <dd className="flex items-center gap-1.5">
                      {editingDiscount ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus
                          value={discountAmount || ""}
                          onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                          onBlur={() => setEditingDiscount(false)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingDiscount(false)}
                          placeholder="0.00"
                          className="w-24 h-8 rounded-lg border border-emerald-500 ring-4 ring-emerald-500/10 px-2 text-right text-[13.5px] tabular outline-none"
                          aria-label="Discount amount"
                        />
                      ) : (
                        <button type="button" onClick={() => setEditingDiscount(true)} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 tabular" title="Edit discount">
                          {discount > 0 ? `− ${formatINR(discount)}` : formatINR(0)}
                          <Icon name="edit" className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">
                      GST{" "}
                      <span className="text-slate-400 text-[12px]">
                        {pricesIncludeTax ? "(included)" : defaultGstRate ? `(${defaultGstRate}%)` : ""}
                      </span>
                    </dt>
                    <dd className="text-slate-700 tabular">{formatINR(totalTax)}</dd>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-200">
                    <dt className="text-[16px] font-semibold text-navy-900">Total</dt>
                    <dd className="text-[17px] font-semibold text-emerald-700 tabular">{formatINR(grandTotal)}</dd>
                  </div>
                </dl>
              </section>

              {/* Payment */}
              <section className={`${CARD} p-4 sm:p-5`}>
                <h2 className="text-[15px] font-semibold text-navy-900">Payment</h2>
                <div className="mt-3 space-y-2" role="radiogroup" aria-label="Payment method">
                  {enabledPaymentOptions.map((o) => {
                    const on = paymentMethod === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setPaymentMethod(o.value);
                          if (o.value === "unpaid") setAmountReceived("");
                        }}
                        className={`w-full flex items-center gap-3 h-11 px-3.5 rounded-xl border text-left transition ${
                          on ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/40" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-5 flex justify-center ${on ? "text-emerald-700" : "text-slate-500"}`}>{o.icon}</span>
                        <span className={`flex-1 text-[14px] ${on ? "font-medium text-emerald-800" : "text-slate-700"}`}>{o.label}</span>
                        <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${on ? "border-emerald-600" : "border-slate-300"}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isCredit ? (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
                    Nothing is collected now. <b className="tabular">{formatINR(grandTotal)}</b> goes to {selectedCustomer?.name || "the customer"}'s khata.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="amount-received" className="block text-[12.5px] text-slate-600 mb-1">Amount received</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-700">₹</span>
                          <input
                            id="amount-received"
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountReceived}
                            placeholder={grandTotal.toFixed(2)}
                            onChange={(e) => setAmountReceived(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-7 pr-9 text-[14px] text-navy-900 tabular outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-navy-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          {received >= grandTotal - 0.005 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center" title="Fully paid">
                              <Icon name="check" className="w-3 h-3" strokeWidth={3.5} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="change-due" className="block text-[12.5px] text-slate-600 mb-1">Change due</label>
                        <input
                          id="change-due"
                          readOnly
                          tabIndex={-1}
                          value={formatINR(changeDue)}
                          className={`w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] tabular outline-none ${changeDue > 0 ? "text-navy-900 font-semibold" : "text-slate-400"}`}
                        />
                      </div>
                    </div>
                    {balanceDue > 0.005 && (
                      <p className="mt-2.5 text-[12.5px] text-amber-700">
                        Balance <b className="tabular">{formatINR(balanceDue)}</b> will be added to the customer's khata.
                      </p>
                    )}
                  </>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {items.length > 0 && (
        <footer className="shrink-0 bg-white border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-8 py-3 flex items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-2.5 text-[15px] text-slate-700">
              <Icon name="cart" className="w-5 h-5" />
              <span>
                {items.length} {items.length === 1 ? "item" : "items"} · {totalQty} {totalQty === 1 ? "unit" : "units"}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCreateCustomerOrder}
                disabled={processing}
                className="h-12 px-4 rounded-xl border border-slate-200 bg-white text-[13.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                title="Save this cart as a customer order in Orders instead of billing it now"
              >
                Place order
              </button>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={processing}
                className="flex-1 sm:flex-none whitespace-nowrap h-12 sm:h-14 px-4 sm:px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-[15px] sm:text-[17px] font-semibold inline-flex items-center justify-center gap-2.5 shadow-sm transition disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving bill…
                  </>
                ) : (
                  <>
                    <Icon name="cart" className="w-5 h-5" /> Create Bill · <span className="tabular">{formatINR(grandTotal)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Feedback dialogs */}
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
