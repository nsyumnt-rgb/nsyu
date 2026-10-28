import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSales, createSale, recordSalePayment, cancelSale, downloadInvoicePdf } from "../api/sales";
import { listCustomers } from "../api/customers";
import { listProducts } from "../api/products";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Sale, Customer, Product } from "../types";

function SalesInner() {
  const { can, isOwner } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [allShopsToggle, setAllShopsToggle] = useState(false);

  // Create Sale Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [saleItems, setSaleItems] = useState<Array<{ productId: number; quantity: number; unitPrice: number }>>([
    { productId: 0, quantity: 1, unitPrice: 0 },
  ]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isEmi, setIsEmi] = useState(false);
  const [emiTenure, setEmiTenure] = useState(6);
  const [emiInterest, setEmiInterest] = useState(0);

  // Payment Modal State
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paySaving, setPaySaving] = useState(false);

  function loadSales() {
    setLoading(true);
    listSales({
      status: statusFilter || undefined,
      allShops: isOwner && allShopsToggle ? true : undefined,
    })
      .then((res) => setSales(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load sales")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSales();
  }, [shopId, statusFilter, allShopsToggle]);

  useEffect(() => {
    Promise.all([listCustomers(), listProducts()]).then(([c, p]) => {
      setCustomers(c.data.data ?? []);
      setProducts(p.data.data ?? []);
    });
  }, [shopId]);

  function getProductCurrentStock(prodId: number) {
    const prod = products.find((p) => p.id === prodId);
    if (!prod || !prod.stocks || prod.stocks.length === 0) return 0;
    const stock = prod.stocks.find((s) => s.shop_id === shopId);
    return stock ? stock.current_stock : 0;
  }

  function handleAddItem() {
    setSaleItems([...saleItems, { productId: 0, quantity: 1, unitPrice: 0 }]);
  }

  function handleRemoveItem(idx: number) {
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  }

  function handleProductChange(idx: number, prodId: number) {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...saleItems];
    updated[idx].productId = prodId;
    updated[idx].unitPrice = prod ? Number(prod.selling_price) : 0;
    setSaleItems(updated);
  }

  const subtotal = saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  async function handleCreateSale(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) {
      setCreateError("Please select a customer");
      return;
    }
    const validItems = saleItems.filter((i) => i.productId > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      setCreateError("Add at least one product with quantity > 0");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await createSale({
        customerId: Number(selectedCustomerId),
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        paidAmount: Number(paidAmount) || 0,
        paymentMethod: isEmi ? "cash" : paymentMethod,
        isEmi,
        emi: isEmi
          ? {
              downPayment: Number(paidAmount) || 0,
              tenureMonths: Number(emiTenure),
              interestRatePercent: Number(emiInterest),
            }
          : undefined,
      });

      setShowCreate(false);
      setSelectedCustomerId("");
      setSaleItems([{ productId: 0, quantity: 1, unitPrice: 0 }]);
      setPaidAmount(0);
      setIsEmi(false);
      loadSales();
    } catch (err) {
      setCreateError(apiErrorMessage(err, "Could not create sale"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingSale) return;
    setPaySaving(true);
    try {
      await recordSalePayment(payingSale.id, {
        amount: Number(payAmount),
        method: payMethod,
      });
      setPayingSale(null);
      setPayAmount("");
      loadSales();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not record payment"));
    } finally {
      setPaySaving(false);
    }
  }

  async function handleCancel(saleId: number) {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await cancelSale(saleId, reason);
      loadSales();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not cancel sale"));
    }
  }

  async function handleDownloadPdf(saleId: number, invoiceNum: string) {
    try {
      const res = await downloadInvoicePdf(saleId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${invoiceNum}.pdf`;
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
          <h1 className="text-2xl">Sales & Invoicing</h1>
          <p className="text-sm text-muted mt-1">
            Manage invoices, counter billing, stock deduction, and payment settlements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app/billing" className="btn-secondary">
            POS Billing Terminal
          </Link>
          {can("sales", "create") && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + New Sale
            </button>
          )}
        </div>
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
            <option value="unpaid">Unpaid</option>
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

      {/* Sales Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Customer</th>
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
                  Loading sales…
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  No sales found. Click "+ New Sale" or "POS Billing Terminal" to start.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs font-medium">
                    <ReferenceLink type="sale" id={s.id} refNumber={s.invoice_number} />
                  </td>
                  <td className="text-xs text-muted">
                    {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="font-medium text-ink-900">
                    {s.customer ? (
                      <ReferenceLink type="customer" id={s.customer.id}>
                        {s.customer.name}
                      </ReferenceLink>
                    ) : (
                      <span className="text-muted">Walk-in</span>
                    )}
                  </td>
                  {allShopsToggle && (
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                        {s.shop?.name || `Shop #${s.shop_id}`}
                      </span>
                    </td>
                  )}
                  <td className="font-mono font-medium">₹{Number(s.total_amount).toFixed(2)}</td>
                  <td className="font-mono text-accent-600">₹{Number(s.paid_amount).toFixed(2)}</td>
                  <td className="font-mono text-danger font-medium">
                    {Number(s.due_amount) > 0 ? `₹${Number(s.due_amount).toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        s.status === "paid"
                          ? "bg-accent-100 text-accent-700"
                          : s.status === "partially_paid"
                          ? "bg-amber-100 text-amber-700"
                          : s.status === "cancelled"
                          ? "bg-danger/10 text-danger"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    <Link
                      to={`/app/sales/${s.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDownloadPdf(s.id, s.invoice_number)}
                      className="text-xs text-accent-600 hover:text-accent-700 font-medium underline"
                    >
                      PDF
                    </button>
                    {Number(s.due_amount) > 0 && s.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          setPayingSale(s);
                          setPayAmount(String(s.due_amount));
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium underline"
                      >
                        Pay Due
                      </button>
                    )}
                    {s.status !== "cancelled" && (
                      <button
                        onClick={() => handleCancel(s.id)}
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

      {/* Create Sale Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">New Sale Invoice — {activeShop?.name}</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-ink-900">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="space-y-4">
              <div>
                <label className="label">Customer *</label>
                <select
                  required
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
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">Line Items</label>
                  <button type="button" onClick={handleAddItem} className="text-xs text-accent-600 hover:underline">
                    + Add Product
                  </button>
                </div>

                {saleItems.map((item, idx) => {
                  const currentStock = getProductCurrentStock(item.productId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-canvas p-2 rounded">
                      <div className="col-span-6">
                        <select
                          required
                          className="input text-xs"
                          value={item.productId}
                          onChange={(e) => handleProductChange(idx, Number(e.target.value))}
                        >
                          <option value="0">Select Product</option>
                          {products.map((p) => {
                            const pStock = getProductCurrentStock(p.id);
                            return (
                              <option key={p.id} value={p.id} disabled={pStock <= 0}>
                                {p.name} (Stock: {pStock})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          max={currentStock || 1}
                          required
                          className="input text-xs font-mono"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...saleItems];
                            updated[idx].quantity = Number(e.target.value);
                            setSaleItems(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="input text-xs font-mono"
                          placeholder="Rate"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...saleItems];
                            updated[idx].unitPrice = Number(e.target.value);
                            setSaleItems(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {saleItems.length > 1 && (
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
                  );
                })}
              </div>

              {/* Subtotal preview */}
              <div className="flex justify-between font-mono text-sm font-semibold border-t pt-2">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Payment Section */}
              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <label className="label">Amount Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Payment Mode</label>
                  <select
                    className="input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={isEmi}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* EMI Toggle */}
              <div className="bg-canvas p-3 rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isEmi}
                    onChange={(e) => setIsEmi(e.target.checked)}
                    className="rounded border-border text-accent-600"
                  />
                  Enable EMI / Installment Plan
                </label>

                {isEmi && (
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div>
                      <label className="label">Tenure (Months)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        className="input"
                        value={emiTenure}
                        onChange={(e) => setEmiTenure(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="label">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        value={emiInterest}
                        onChange={(e) => setEmiInterest(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {createError && <p className="text-sm text-danger">{createError}</p>}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? "Generating Invoice…" : "Confirm & Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Due Modal */}
      {payingSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Record Payment against {payingSale.invoice_number}</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="label">Payment Amount * (Outstanding: ₹{payingSale.due_amount})</label>
                <input
                  type="number"
                  step="0.01"
                  max={payingSale.due_amount}
                  required
                  className="input font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPayingSale(null)}>
                  Cancel
                </button>
                <button disabled={paySaving} className="btn-primary">
                  {paySaving ? "Saving…" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sales() {
  return (
    <RequireModule module="sales">
      <SalesInner />
    </RequireModule>
  );
}
