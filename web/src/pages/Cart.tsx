import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePosStore } from "../store/posStore";
import { useAuthStore } from "../store/authStore";
import { resolveAssetUrl, apiErrorMessage } from "../api/client";
import { getCategoryAlias } from "../utils/categoryAlias";
import { listCustomers, createCustomer } from "../api/customers";
import { createSale, downloadInvoicePdf } from "../api/sales";
import { createOrder } from "../api/orders";
import { ChoiceGroup, Icon } from "../components/ui";
import type { Customer, Sale } from "../types";
import {
  SuccessModal,
  FailureModal,
  ValidationModal,
  SavingProgressModal,
  ToastNotification,
  type ToastProps,
} from "../components/AnimatedFeedback";

function formatINR(val: number): string {
  return "₹" + Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Cart() {
  const navigate = useNavigate();
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
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: "", phone: "" });

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
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);

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

  // Shop Owner enabled payment methods + Unpaid (Credit / Udhaar) option
  const enabledPaymentOptions = useMemo(() => {
    const s = (activeShop?.settings || {}) as Record<string, any>;
    const opts: Array<[string, string]> = [];

    const allowCash = s.enableCash !== false;
    const allowUpi = s.enableUpi !== false;
    const allowCard = s.enableCard !== false;
    const allowBank = s.enableNetBanking !== false && s.enableBank !== false;

    if (allowCash) opts.push(["cash", "Cash"]);
    if (allowUpi) opts.push(["upi", "UPI"]);
    if (allowCard) opts.push(["card", "Card"]);
    if (allowBank) opts.push(["bank_transfer", "Bank"]);

    // Requirement: "ek Unpaid option bhi add kar do jissye jo credit k kam aayega"
    opts.push(["unpaid", "Unpaid (Credit)"]);

    return opts;
  }, [activeShop?.settings]);

  useEffect(() => {
    if (
      enabledPaymentOptions.length > 0 &&
      !enabledPaymentOptions.some(([val]: [string, string]) => val === paymentMethod)
    ) {
      setPaymentMethod(enabledPaymentOptions[0][0]);
    }
  }, [enabledPaymentOptions, paymentMethod]);

  function handlePriceSourceChange(newMode: "selling" | "live") {
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
        title: `Billing Rate: ${newMode === "live" ? "Live Price (Online)" : "Selling Price (Counter)"}`,
        subtitle: `Updated cart item rates to ${newMode === "live" ? "online live prices" : "store counter selling prices"}.`,
      });
    }
  }

  // Tax & Totals calculation
  const pricesIncludeTax = Boolean(activeShop?.settings?.pricesIncludeTax);
  const defaultGstRate =
    activeShop?.settings?.defaultGstRate !== undefined && activeShop?.settings?.defaultGstRate !== null
      ? Number(activeShop.settings.defaultGstRate)
      : 0;

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const rawSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
        0
      ),
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
      setCustomers((prev) => [...prev, newC]);
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
    const errors: string[] = [];
    if (!selectedCustomerId) {
      errors.push("Customer is required. Please select or add a customer.");
    }
    if (items.length === 0) {
      errors.push("At least one product is required in the cart.");
    }
    const invalidQty = items.some((i) => i.quantity <= 0);
    if (invalidQty) {
      errors.push("Quantity must be greater than 0 for all items.");
    }

    const isUnpaid = paymentMethod === "unpaid";
    if (isUnpaid && !selectedCustomerId) {
      errors.push("Customer is required for Unpaid (Credit / Udhaar) bill to record credit debt.");
    }
    const effectivePaid = isUnpaid ? 0 : paidAmount === "" ? grandTotal : Number(paidAmount);
    if (effectivePaid < 0) {
      errors.push("Paid amount cannot be negative.");
    }
    if (effectivePaid > grandTotal + 0.01) {
      errors.push(
        `Paid amount (₹${effectivePaid.toFixed(2)}) cannot exceed Grand Total (₹${grandTotal.toFixed(2)}).`
      );
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setProcessing(true);
    try {
      const res = await createSale({
        customerId: Number(selectedCustomerId),
        items: items.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        overallDiscount: discount,
        paymentMethod: paymentMethod,
        paidAmount: effectivePaid,
        notes: `POS Bill from Cart (${priceSource === "live" ? "Live Price" : "Selling Price"})`,
      });

      const newSale = res.data.data!;
      clearCart();
      setPaidAmount("");
      setDiscountAmount(0);
      setSavedModalSale(newSale);
    } catch (err: any) {
      const msg = apiErrorMessage(err, "Could not save bill. Please try again.");
      setFailureReason(msg);
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
        paymentMethod: paymentMethod === "unpaid" ? "unpaid" : paymentMethod,
        paymentStatus:
          paymentMethod === "unpaid"
            ? "unpaid"
            : paidAmount === "" || Number(paidAmount) >= grandTotal - 0.01
            ? "paid"
            : Number(paidAmount) > 0
            ? "partial"
            : "unpaid",
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
      setPaidAmount("");
      setDiscountAmount(0);

      setToast({
        type: "success",
        title: "Customer Order Placed!",
        subtitle: `Order #${ord.order_number} created for ${ord.customer?.name || "customer"}.`,
        actionLabel: "View Orders",
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
      setToast({
        type: "error",
        title: "Download Failed",
        subtitle: apiErrorMessage(err, "Could not generate invoice PDF."),
      });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              POS Billing & Checkout
            </span>
            {activeShop && (
              <span className="text-xs text-slate-400 font-medium">
                • {activeShop.name} ({activeShop.code})
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <span>POS Cart & Create Bill</span>
            {items.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {items.length} {items.length === 1 ? "Product" : "Products"} ({totalQty} Units)
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review items, choose customer, select payment method, and complete bill generation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all items from this cart?")) {
                  clearCart();
                }
              }}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition shadow-2xs"
            >
              Clear Cart
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/app/billing")}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-700 hover:bg-brand-800 rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            <span>Add Products (POS Terminal)</span>
          </button>
        </div>
      </div>

      {/* Cart Content */}
      {items.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center shadow-xs">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-navy-900">Your POS Cart is Empty</h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            There are no products currently staged for billing. Scan barcodes or select items from the POS terminal to start creating a customer bill.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/app/billing"
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              Open POS Billing Terminal
            </Link>
            <Link
              to="/app/products"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition"
            >
              Browse Products Catalog
            </Link>
            <Link
              to="/app/inventory"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
            >
              Check Inventory
            </Link>
          </div>
        </div>
      ) : (
        /* 2-Column Responsive Layout: Left = Cart Items Table, Right = Create Bill & Checkout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Items Table (7 cols on lg, 7 cols on xl) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            {/* Rate Mode Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-emerald-50/70 border border-emerald-200/90 p-3 rounded-2xl shadow-2xs text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-950">Billing Rate Mode:</span>
                <div className="inline-flex items-center p-0.5 rounded-xl bg-white border border-emerald-300">
                  <button
                    type="button"
                    onClick={() => handlePriceSourceChange("selling")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      priceSource === "selling"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Selling Price (Counter)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePriceSourceChange("live")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      priceSource === "live"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Live Price (Online)
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-emerald-800 font-medium">
                {priceSource === "live" ? "⚡ Live Online Pricing Active" : "Store Counter Rate Active"}
              </span>
            </div>

            {/* Items Table Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider text-[10.5px] border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Product Details</th>
                      <th className="py-3.5 px-3 text-center">Category</th>
                      <th className="py-3.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-3.5 px-3 text-center">Qty</th>
                      <th className="py-3.5 px-4 text-right">Line Total</th>
                      <th className="py-3.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {items.map((item) => {
                      const p = item.product || {};
                      const coverImg = (p.images?.find((img: any) => img.is_primary) || p.images?.[0])?.url;
                      const photo = coverImg || p.cover_image || (p.photos && p.photos[0]?.url) || null;
                      const lineTotal = Number(item.unitPrice || 0) * item.quantity;
                      const catName = p.category?.name || (typeof p.category === "string" ? p.category : "");
                      const catAlias = getCategoryAlias(catName, p.category?.alias);
                      const stock = getStock(p);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          {/* Product Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                {photo ? (
                                  <img
                                    src={resolveAssetUrl(photo) ?? undefined}
                                    alt={p.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-slate-400 font-bold text-xs">📦</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-navy-900 text-xs sm:text-[13px] truncate max-w-[200px]" title={p.name}>
                                  {p.name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                                    {p.sku || "NO-SKU"}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold tabular ${
                                      stock > 0
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    Stock: {stock}
                                  </span>
                                  {p.live_price && Number(p.live_price) === item.unitPrice ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      Live Rate
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category Alias */}
                          <td className="py-3 px-3 text-center">
                            <span
                              title={catName || "Category"}
                              className="font-mono font-black text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs whitespace-nowrap"
                            >
                              {catAlias}
                            </span>
                          </td>

                          {/* Editable Rate */}
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <span className="text-slate-400 text-xs">₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateUnitPrice(p.id, Number(e.target.value) || 0)}
                                className="w-16 px-1.5 py-1 text-right text-xs font-bold rounded-lg border border-slate-200 tabular focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-none"
                                title="Edit item rate"
                              />
                            </div>
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                                title="Decrease"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateQuantity(p.id, Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-8 text-center text-xs font-bold text-navy-900 border-x border-slate-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                                title="Increase"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-black text-emerald-800 text-xs sm:text-sm tabular">
                            {formatINR(lineTotal)}
                          </td>

                          {/* Delete Button */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(p.id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition mx-auto"
                              title={`Remove ${p.name}`}
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Actions */}
              <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate("/app/billing")}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition shadow-2xs flex items-center gap-1.5"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  <span>Add More Products from POS Terminal</span>
                </button>
                <div className="text-slate-500 font-medium">
                  Subtotal: <strong className="text-navy-900 tabular">{formatINR(rawSubtotal)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: "Create Bill" Card (5 cols on lg, 5 cols on xl) */}
          <div className="lg:col-span-5 xl:col-span-5 sticky top-20">
            <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/70">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-bold text-navy-900">Create Bill & Invoice</h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                      {totalQty} {totalQty === 1 ? "unit" : "units"}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    {activeShop?.name || "Shop POS Station"}
                  </p>
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Clear all items from this bill?")) {
                        clearCart();
                      }
                    }}
                    className="text-[11.5px] text-slate-400 hover:text-rose-600 px-2 py-1 rounded hover:bg-rose-50 font-medium transition"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Form Content */}
              <div className="p-4 sm:p-5 space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto">
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

                {/* Calculations & Totals */}
                <div className="space-y-2 text-[12.5px] p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="tabular font-semibold text-slate-700">{formatINR(rawSubtotal)}</span>
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
                    <span className="tabular font-semibold text-slate-700">{formatINR(totalTax)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-[16px] text-navy-900 pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span className="tabular text-brand-700 font-mono text-xl">{formatINR(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[12px] font-bold text-navy-900 block mb-1.5 flex items-center justify-between">
                      <span>Payment Method</span>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Shop Enabled Modes
                      </span>
                    </label>
                    <ChoiceGroup
                      cols={enabledPaymentOptions.length > 4 ? 3 : (enabledPaymentOptions.length as any || 2)}
                      value={paymentMethod}
                      onChange={(val) => {
                        setPaymentMethod(val);
                        if (val === "unpaid") {
                          setPaidAmount(0);
                        } else if (paidAmount === 0) {
                          setPaidAmount(Number(grandTotal.toFixed(2)));
                        }
                      }}
                      options={enabledPaymentOptions}
                    />
                  </div>

                  {paymentMethod === "unpaid" && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <span>⚠️</span>
                        <span>Unpaid Bill / Udhaar (Credit)</span>
                      </div>
                      <p className="text-amber-700 leading-relaxed text-[11.5px]">
                        Paid amount is set to <strong>₹0.00</strong>. The full balance of{" "}
                        <strong>{formatINR(grandTotal)}</strong> will be charged as customer debt on their credit ledger.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-bold text-navy-900">Paid Amount (₹)</label>
                      <div className="flex gap-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(Number(grandTotal.toFixed(2)));
                            if (paymentMethod === "unpaid") {
                              setPaymentMethod(enabledPaymentOptions[0]?.[0] || "cash");
                            }
                          }}
                          className="text-brand-700 hover:underline"
                        >
                          Full
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(0);
                            setPaymentMethod("unpaid");
                          }}
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
                      disabled={paymentMethod === "unpaid"}
                      placeholder={paymentMethod === "unpaid" ? "0.00 (Unpaid / Udhaar)" : grandTotal.toFixed(2)}
                      className={`input tabular font-bold text-[13.5px] ${
                        paymentMethod === "unpaid" ? "bg-amber-50/50 text-amber-800 border-amber-200 cursor-not-allowed" : "bg-white"
                      }`}
                      value={paymentMethod === "unpaid" ? 0 : paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                    />
                    {items.length > 0 && (() => {
                      const previewPaid = paidAmount === "" ? grandTotal : Number(paidAmount);
                      const previewDue = Math.max(0, grandTotal - previewPaid);
                      const st = previewPaid >= grandTotal - 0.01 ? "Paid" : previewPaid > 0.01 ? "Partial" : "Unpaid";
                      return (
                        <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                          <span className={st === "Paid" ? "badge-active" : st === "Partial" ? "badge-warn" : "badge-danger"}>
                            {st}
                          </span>
                          <span className="text-slate-500 font-medium">
                            Due <b className="tabular text-navy-900">{formatINR(previewDue)}</b>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 sm:p-5 border-t border-border bg-slate-50/70 space-y-2">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={processing || items.length === 0}
                  className="btn-primary btn-lg w-full h-12 text-[14.5px] font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  {processing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving Bill…
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="w-5 h-5" strokeWidth={2.6} /> Complete & Save Bill · {formatINR(grandTotal)}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCreateCustomerOrder}
                  disabled={processing || items.length === 0}
                  className="w-full h-10 rounded-xl border border-brand-700 bg-white hover:bg-brand-50 text-brand-800 text-[13px] font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  title="Place this bill as a customer sales order in Orders management"
                >
                  <Icon name="cart" className="w-4 h-4" /> Place Customer Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialogs */}
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
