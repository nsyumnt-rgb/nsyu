import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPurchases, createPurchase, recordPurchasePayment, cancelPurchase, downloadPurchasePdf } from "../api/purchases";
import { listSuppliers } from "../api/suppliers";
import { listProducts } from "../api/products";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Purchase, Supplier, Product } from "../types";

function PurchaseInner() {
  const { can, isOwner } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Create Purchase Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [items, setItems] = useState<Array<{ productId: number; quantity: number; rate: number }>>([
    { productId: 0, quantity: 1, rate: 0 },
  ]);
  const [initialPaid, setInitialPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("bank");

  // Payment Modal State
  const [payingPurchase, setPayingPurchase] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank");
  const [paySaving, setPaySaving] = useState(false);

  function loadPurchases() {
    setLoading(true);
    listPurchases({
      status: statusFilter || undefined,
      allShops: isOwner && allShopsToggle ? true : undefined,
    })
      .then((res) => setPurchases(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load purchases")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPurchases();
  }, [shopId, statusFilter, allShopsToggle]);

  useEffect(() => {
    Promise.all([listSuppliers(), listProducts()]).then(([s, p]) => {
      setSuppliers(s.data.data ?? []);
      setProducts(p.data.data ?? []);
    });
  }, [shopId]);

  function handleAddItem() {
    setItems([...items, { productId: 0, quantity: 1, rate: 0 }]);
  }

  function handleRemoveItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleProductChange(idx: number, prodId: number) {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...items];
    updated[idx].productId = prodId;
    updated[idx].rate = prod ? Number(prod.purchase_price || prod.selling_price) : 0;
    setItems(updated);
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);

  async function handleCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId) {
      setCreateError("Please select a supplier");
      return;
    }
    const validItems = items.filter((i) => i.productId > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      setCreateError("Add at least one product with quantity > 0");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await createPurchase({
        supplierId: Number(selectedSupplierId),
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.rate,
        })),
        initialPaid: Number(initialPaid) || 0,
        paymentMethod: Number(initialPaid) > 0 ? paymentMethod : undefined,
      });

      setShowCreate(false);
      setSelectedSupplierId("");
      setItems([{ productId: 0, quantity: 1, rate: 0 }]);
      setInitialPaid(0);
      loadPurchases();
    } catch (err) {
      setCreateError(apiErrorMessage(err, "Could not create purchase"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingPurchase) return;
    setPaySaving(true);
    try {
      await recordPurchasePayment(payingPurchase.id, {
        amount: Number(payAmount),
        method: payMethod,
      });
      setPayingPurchase(null);
      setPayAmount("");
      loadPurchases();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not record payment"));
    } finally {
      setPaySaving(false);
    }
  }

  async function handleCancel(purchaseId: number) {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await cancelPurchase(purchaseId, reason);
      loadPurchases();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not cancel purchase"));
    }
  }

  async function handleDownloadPdf(purchaseId: number, num: string) {
    try {
      const res = await downloadPurchasePdf(purchaseId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Purchase_${num}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(apiErrorMessage(err, "Could not download PDF"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Purchases & Inward Stock</h1>
          <p className="text-sm text-muted mt-1">
            Supplier purchase bills, inward stock receipts, and accounts payable.
          </p>
        </div>
        {can("purchase", "create") && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Purchase
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-muted uppercase">Status:</label>
          <select
            className="input py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="received">Received (Unpaid)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={allShopsToggle}
                onChange={(e) => setAllShopsToggle(e.target.checked)}
                className="rounded border-border text-accent-600 focus:ring-accent-500"
              />
              Consolidated (All Shops)
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Purchases Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Purchase #</th>
              <th>Date</th>
              <th>Supplier</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  Loading purchases…
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  No purchases found. Click "+ New Purchase" to record inventory stock-in.
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs font-medium">
                    <ReferenceLink type="purchase" id={p.id} refNumber={p.purchase_number} />
                  </td>
                  <td className="text-xs text-muted">
                    {new Date(p.purchase_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="font-medium text-ink-900">
                    {p.supplier ? (
                      <ReferenceLink type="supplier" id={p.supplier.id}>
                        {p.supplier.name}
                      </ReferenceLink>
                    ) : (
                      <span className="text-muted">Supplier</span>
                    )}
                  </td>
                  {allShopsToggle && (
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                        {p.shop?.name || `Shop #${p.shop_id}`}
                      </span>
                    </td>
                  )}
                  <td className="font-mono font-medium">₹{Number(p.total_amount).toFixed(2)}</td>
                  <td className="font-mono text-accent-600">₹{Number(p.paid_amount).toFixed(2)}</td>
                  <td className="font-mono text-danger font-medium">
                    {Number(p.due_amount) > 0 ? `₹${Number(p.due_amount).toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === "paid"
                          ? "bg-accent-100 text-accent-700"
                          : p.status === "partially_paid"
                          ? "bg-amber-100 text-amber-700"
                          : p.status === "cancelled"
                          ? "bg-danger/10 text-danger"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    <Link
                      to={`/app/purchase/${p.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDownloadPdf(p.id, p.purchase_number)}
                      className="text-xs text-accent-600 hover:text-accent-700 font-medium underline"
                    >
                      PDF
                    </button>
                    {Number(p.due_amount) > 0 && p.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          setPayingPurchase(p);
                          setPayAmount(String(p.due_amount));
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium underline"
                      >
                        Pay Due
                      </button>
                    )}
                    {p.status !== "cancelled" && (
                      <button
                        onClick={() => handleCancel(p.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Purchase Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">Inward Purchase Bill — {activeShop?.name}</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-ink-900">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <div>
                <label className="label">Supplier *</label>
                <select
                  required
                  className="input"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(Number(e.target.value) || "")}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone || "No phone"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">Inward Items</label>
                  <button type="button" onClick={handleAddItem} className="text-xs text-accent-600 hover:underline">
                    + Add Product
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-canvas p-2 rounded">
                    <div className="col-span-6">
                      <select
                        required
                        className="input text-xs"
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, Number(e.target.value))}
                      >
                        <option value="0">Select Product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        required
                        className="input text-xs font-mono"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].quantity = Number(e.target.value);
                          setItems(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="input text-xs font-mono"
                        placeholder="Cost Rate"
                        value={item.rate}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].rate = Number(e.target.value);
                          setItems(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-danger hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total preview */}
              <div className="flex justify-between font-mono text-sm font-semibold border-t pt-2">
                <span>Total Amount:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Payment Section */}
              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <label className="label">Initial Paid (Advance/Tender)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono"
                    value={initialPaid}
                    onChange={(e) => setInitialPaid(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select
                    className="input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="bank">Bank Transfer / NEFT</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {createError && <p className="text-sm text-danger">{createError}</p>}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? "Stocking In…" : "Stock In & Save Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Due Modal */}
      {payingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Pay Supplier Due for {payingPurchase.purchase_number}</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="label">Amount (Outstanding: ₹{payingPurchase.due_amount})</label>
                <input
                  type="number"
                  step="0.01"
                  max={payingPurchase.due_amount}
                  required
                  className="input font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPayingPurchase(null)}>
                  Cancel
                </button>
                <button disabled={paySaving} className="btn-primary">
                  {paySaving ? "Saving…" : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Purchase() {
  return (
    <RequireModule module="purchase">
      <PurchaseInner />
    </RequireModule>
  );
}
