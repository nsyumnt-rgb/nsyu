import { useEffect, useState } from "react";
import { listProducts } from "../api/products";
import { listCustomers, createCustomer } from "../api/customers";
import { createSale, downloadInvoicePdf } from "../api/sales";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import type { Customer, Product } from "../types";

function BillingInner() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; unitPrice: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Process State
  const [processing, setProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ id: number; number: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick Customer Add
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: "", phone: "" });

  function loadData() {
    setLoading(true);
    Promise.all([listProducts(), listCustomers()])
      .then(([p, c]) => {
        setProducts(p.data.data ?? []);
        setCustomers(c.data.data ?? []);
        if (c.data.data && c.data.data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(c.data.data[0].id);
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
      alert(`No stock available in ${activeShop?.name || "this shop"}!`);
      return;
    }
    const existingIndex = cart.findIndex((item) => item.product.id === p.id);
    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity >= stock) {
        alert(`Cannot exceed available stock of ${stock}`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product: p, quantity: 1, unitPrice: Number(p.selling_price) }]);
    }
  }

  function updateQuantity(idx: number, delta: number) {
    const item = cart[idx];
    const stock = getStock(item.product);
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else if (newQty > stock) {
      alert(`Only ${stock} available in stock`);
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
    } catch (err) {
      alert(apiErrorMessage(err, "Could not add customer"));
    }
  }

  async function handleCheckout() {
    if (!selectedCustomerId) {
      setError("Please select or add a customer");
      return;
    }
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const res = await createSale({
        customerId: Number(selectedCustomerId),
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        overallDiscount: Number(discountAmount) || 0,
        paidAmount: paidAmount === "" ? grandTotal : Number(paidAmount),
        paymentMethod,
      });

      const sale = res.data.data!;
      setLastInvoice({ id: sale.id, number: sale.invoice_number });
      setCart([]);
      setPaidAmount("");
      setDiscountAmount(0);
      loadData(); // refresh stock numbers
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to complete checkout"));
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
      alert(apiErrorMessage(err, "Could not download PDF"));
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            POS Billing Terminal
            <span className="badge bg-accent-100 text-accent-700 font-mono text-xs">
              {activeShop?.name || "No Shop"}
            </span>
          </h1>
          <p className="text-sm text-muted">Rapid point-of-sale register with live stock checks.</p>
        </div>

        {lastInvoice && (
          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded flex items-center gap-3">
            <span className="text-xs text-emerald-800 font-medium">
              Invoice #{lastInvoice.number} Generated!
            </span>
            <button
              onClick={() => downloadPdf(lastInvoice.id, lastInvoice.number)}
              className="btn-primary py-1 px-3 text-xs"
            >
              Print / PDF
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Catalog & Search */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search product name or SKU…"
              className="input flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto p-1">
            {loading ? (
              <div className="col-span-3 text-center py-12 text-muted">Loading catalog…</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted">No products found.</div>
            ) : (
              filteredProducts.map((p) => {
                const stock = getStock(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={stock <= 0}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      stock > 0
                        ? "border-border bg-surface hover:border-accent-400 hover:shadow-sm"
                        : "border-border/50 bg-canvas/40 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] font-mono text-muted">{p.sku}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono font-bold text-accent-700">₹{p.selling_price}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          stock > 0 ? "bg-accent-100 text-accent-700" : "bg-danger/10 text-danger"
                        }`}
                      >
                        Stock: {stock}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Cart & Checkout Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-5 space-y-4">
            {/* Customer Select */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="label">Customer</label>
                <button
                  onClick={() => setShowQuickCustomer((v) => !v)}
                  className="text-xs text-accent-600 hover:underline"
                >
                  {showQuickCustomer ? "Cancel" : "+ Quick Add"}
                </button>
              </div>

              {showQuickCustomer ? (
                <form onSubmit={handleQuickAddCustomer} className="bg-canvas p-3 rounded space-y-2 text-xs">
                  <input
                    required
                    placeholder="Name"
                    className="input py-1 text-xs"
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                  />
                  <input
                    required
                    placeholder="Phone"
                    className="input py-1 text-xs"
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                  />
                  <button type="submit" className="btn-primary w-full py-1 text-xs">
                    Save & Select Customer
                  </button>
                </form>
              ) : (
                <select
                  className="input"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value) || "")}
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Cart Table */}
            <div className="border rounded divide-y max-h-56 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">Cart is empty. Click a product to add.</div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="truncate max-w-[150px]">
                      <div className="font-medium truncate">{item.product.name}</div>
                      <div className="font-mono text-muted">₹{item.unitPrice} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-5 h-5 rounded bg-canvas border flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="font-mono font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-5 h-5 rounded bg-canvas border flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-mono font-bold">₹{(item.quantity * item.unitPrice).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations */}
            <div className="space-y-2 border-t pt-3 text-xs">
              <div className="flex justify-between text-muted">
                <span>Subtotal:</span>
                <span className="font-mono">₹{rawSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  className="input w-24 py-1 text-right font-mono"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between font-bold text-base text-ink-900 border-t pt-2">
                <span>Total Due:</span>
                <span className="font-mono text-accent-700">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode & Tender */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <label className="label">Payment Mode</label>
                <select
                  className="input text-xs"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="label">Amount Tendered</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={String(grandTotal)}
                  className="input text-xs font-mono"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              onClick={handleCheckout}
              disabled={processing || cart.length === 0}
              className="btn-primary w-full py-2.5 text-sm font-semibold tracking-wide"
            >
              {processing ? "Generating Invoice…" : `Charge ₹${grandTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
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
