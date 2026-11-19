import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSales, createSale, recordSalePayment, cancelSale, returnSale, downloadInvoicePdf } from "../api/sales";
import { listCustomers } from "../api/customers";
import { listProducts } from "../api/products";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Sale, Customer, Product } from "../types";
import { Avatar, EmptyState, Icon, Meter, Modal, PageHeader, SearchInput, Segmented, StatCard, type IconName } from "../components/ui";

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
  const [allShopsToggle, setAllShopsToggle] = useState(!shopId);
  const [search, setSearch] = useState("");

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

  // Return Modal State
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ [saleItemId: number]: number }>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  function openReturnModal(s: Sale) {
    setReturningSale(s);
    setReturnReason("");
    const initialMap: { [saleItemId: number]: number } = {};
    (s.items || []).forEach((item) => {
      initialMap[item.id] = 0;
    });
    setReturnItems(initialMap);
  }

  async function handleReturnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!returningSale) return;
    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([saleItemId, quantity]) => ({
        saleItemId: Number(saleItemId),
        quantity: Number(quantity),
      }));

    if (itemsToReturn.length === 0) {
      alert("Please enter a return quantity greater than 0 for at least one item.");
      return;
    }

    setReturnSubmitting(true);
    try {
      await returnSale(returningSale.id, itemsToReturn, returnReason.trim() || undefined);
      setReturningSale(null);
      loadSales();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to process sale return"));
    } finally {
      setReturnSubmitting(false);
    }
  }

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
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        idempotencyKey,
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
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }
    if (amt > Number(payingSale.due_amount) + 0.01) {
      alert(`Payment amount ₹${amt} cannot exceed remaining due amount ₹${payingSale.due_amount}`);
      return;
    }
    setPaySaving(true);
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pay-${payingSale.id}-${Date.now()}`;
    try {
      await recordSalePayment(payingSale.id, {
        amount: amt,
        method: payMethod,
        idempotencyKey,
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

  const q = search.trim().toLowerCase();
  const visible = q
    ? sales.filter((s) => s.invoice_number?.toLowerCase().includes(q) || s.customer?.name?.toLowerCase().includes(q) || String(s.customer?.phone || "").includes(q))
    : sales;
  const live = sales.filter((s) => s.status !== "cancelled");
  const stats = {
    billed: live.reduce((a, s) => a + Number(s.total_amount || 0), 0),
    collected: live.reduce((a, s) => a + Number(s.paid_amount || 0), 0),
    due: live.reduce((a, s) => a + Number(s.due_amount || 0), 0),
    unpaidCount: live.filter((s) => Number(s.due_amount) > 0).length,
  };
  const collectedPct = stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0;
  const cols = allShopsToggle ? 8 : 7;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Sales"
        title="Sales & invoices"
        subtitle="Every invoice, what's been collected, and what customers still owe."
        actions={
          <>
            <Link to="/app/billing" className="btn-secondary">
              <Icon name="terminal" className="w-4 h-4 text-slate-500" /> POS billing
            </Link>
            {can("sales", "create") && (
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
                <Icon name="plus" /> New sale
              </button>
            )}
          </>
        }
      />

      {/* KPIs (from the invoices currently listed) */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Invoices" icon="receipt" tone="brand" value={live.length.toLocaleString("en-IN")} loading={loading} hint={`${sales.length - live.length} cancelled`} />
        <StatCard label="Total billed" icon="trend" tone="sky" value={inr(stats.billed)} loading={loading} hint={statusFilter ? `Filter: ${STATUS_LABEL[statusFilter] || statusFilter}` : "All listed invoices"} />
        <StatCard
          label="Collected"
          icon="wallet"
          tone="emerald"
          value={inr(stats.collected)}
          valueClass="text-emerald-600"
          loading={loading}
          footer={
            <div className="flex items-center gap-2">
              <Meter value={stats.collected} max={stats.billed} tone="emerald" className="flex-1" />
              <span className="tabular text-slate-500">{collectedPct}%</span>
            </div>
          }
        />
        <StatCard
          label="Due"
          icon="clock"
          tone="rose"
          value={inr(stats.due)}
          valueClass={stats.due > 0 ? "text-rose-600" : undefined}
          loading={loading}
          hint={`${stats.unpaidCount} invoice${stats.unpaidCount === 1 ? "" : "s"} pending`}
          active={statusFilter === "unpaid"}
          onClick={() => setStatusFilter(statusFilter === "unpaid" ? "" : "unpaid")}
        />
      </div>

      {/* Table card */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { key: "", label: "All" },
              { key: "paid", label: "Paid" },
              { key: "partially_paid", label: "Partial" },
              { key: "unpaid", label: "Unpaid" },
              { key: "cancelled", label: "Cancelled" },
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {isOwner && (
              <label className="inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-600 cursor-pointer select-none">
                <span className={`relative w-9 h-5 rounded-full transition ${allShopsToggle ? "bg-brand-600" : "bg-slate-300"}`}>
                  <input type="checkbox" className="sr-only" checked={allShopsToggle} onChange={(e) => setAllShopsToggle(e.target.checked)} />
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${allShopsToggle ? "translate-x-4" : ""}`} />
                </span>
                All shops
              </label>
            )}
            <SearchInput className="sm:w-[260px]" value={search} onChange={setSearch} placeholder="Invoice #, customer or phone…" />
          </div>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
            <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                {allShopsToggle && <th>Shop</th>}
                <th className="!text-right">Total</th>
                <th className="!text-right">Paid</th>
                <th className="!text-right">Due</th>
                <th>Status</th>
                <th className="!text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={cols}>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-3 rounded bg-slate-100" />
                        <div className="w-8 h-8 rounded-full bg-slate-100" />
                        <div className="flex-1 h-3 rounded bg-slate-100" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="!p-0">
                    {sales.length === 0 ? (
                      <EmptyState
                        icon="receipt"
                        tone="brand"
                        title={statusFilter ? `No ${(STATUS_LABEL[statusFilter] || statusFilter).toLowerCase()} invoices` : "No sales yet"}
                        text="Create an invoice here, or ring up a sale on the POS billing screen."
                        action={
                          <div className="flex gap-2 justify-center">
                            <Link to="/app/billing" className="btn-secondary btn-sm"><Icon name="terminal" className="w-3.5 h-3.5" /> POS billing</Link>
                            {can("sales", "create") && <button type="button" onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Icon name="plus" className="w-3.5 h-3.5" /> New sale</button>}
                          </div>
                        }
                      />
                    ) : (
                      <EmptyState icon="search" title="No invoices match" text="Try a different invoice number or customer name." />
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((s) => {
                  const due = Number(s.due_amount);
                  const st = statusChip(s);
                  return (
                    <tr key={s.id} className={s.status === "cancelled" ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap">
                        <div className="font-mono text-[12.5px] font-semibold">
                          <ReferenceLink type="sale" id={s.id} refNumber={s.invoice_number} />
                        </div>
                        <div className="text-[11.5px] text-slate-400">
                          {new Date(s.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </td>
                      <td>
                        {s.customer ? (
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <Avatar name={s.customer.name} size="sm" />
                            <div className="min-w-0">
                              <ReferenceLink type="customer" id={s.customer.id} className="!font-sans block truncate max-w-[200px] text-[13px] font-semibold text-navy-900 hover:text-brand-700">
                                {s.customer.name}
                              </ReferenceLink>
                              {s.customer.phone && <div className="text-[11.5px] text-slate-400 tabular">{s.customer.phone}</div>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <Avatar name="Walk in" size="sm" />
                            <span className="text-slate-500">Walk-in</span>
                          </div>
                        )}
                      </td>
                      {allShopsToggle && (
                        <td>
                          <span className="badge-inactive">{s.shop?.name || `Shop #${s.shop_id}`}</span>
                        </td>
                      )}
                      <td className="text-right font-semibold text-navy-900 tabular whitespace-nowrap">{inr2(s.total_amount)}</td>
                      <td className="text-right tabular text-emerald-600 whitespace-nowrap">{inr2(s.paid_amount)}</td>
                      <td className="text-right tabular whitespace-nowrap">
                        {due > 0 ? <span className="font-semibold text-rose-600">{inr2(due)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td>
                        <span className={st.cls}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                        {s.is_emi && <span className="ml-1 badge-brand">EMI</span>}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {due > 0 && s.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayingSale(s);
                                setPayAmount(String(s.due_amount));
                              }}
                              className="btn-soft btn-sm"
                            >
                              <Icon name="wallet" className="w-3.5 h-3.5" /> Collect
                            </button>
                          )}
                          <RowBtn title="View invoice" icon="eye" to={`/app/sales/${s.id}`} />
                          <RowBtn title="Download PDF" icon="download" onClick={() => handleDownloadPdf(s.id, s.invoice_number)} />
                          {s.status !== "cancelled" && s.status !== "returned" && can("sales", "edit") && (
                            <RowBtn title="Process return" icon="refresh" onClick={() => openReturnModal(s)} />
                          )}
                          {s.status !== "cancelled" && <RowBtn title="Cancel sale" icon="ban" tone="rose" onClick={() => handleCancel(s.id)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && visible.length > 0 && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 text-[12.5px] text-slate-500 flex flex-wrap gap-x-5 gap-y-1">
            <span><b className="text-navy-900 tabular">{visible.length}</b> invoice{visible.length === 1 ? "" : "s"}</span>
            <span>Total <b className="text-navy-900 tabular">{inr(visible.filter((s) => s.status !== "cancelled").reduce((a, s) => a + Number(s.total_amount || 0), 0))}</b></span>
            <span>Due <b className="text-rose-600 tabular">{inr(visible.filter((s) => s.status !== "cancelled").reduce((a, s) => a + Number(s.due_amount || 0), 0))}</b></span>
          </div>
        )}
      </section>

      {/* Create Sale Modal */}
      {showCreate && (
        <Modal
          icon="receipt"
          title="New sale invoice"
          subtitle={activeShop?.name ? `Billing from ${activeShop.name}` : undefined}
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="create-sale-form" disabled={creating} className="btn-primary">
                {creating ? "Generating invoice…" : "Create invoice"}
              </button>
            </>
          }
        >
          <form id="create-sale-form" onSubmit={handleCreateSale} className="space-y-5">
            <div>
              <label className="label">Customer *</label>
              <select required className="input" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(Number(e.target.value) || "")}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0">Items</label>
                <button type="button" onClick={handleAddItem} className="btn-ghost btn-sm text-brand-700">
                  <Icon name="plus" className="w-3.5 h-3.5" /> Add item
                </button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-3">Rate (₹)</div>
                  <div className="col-span-1" />
                </div>
                <div className="divide-y divide-slate-100">
                  {saleItems.map((item, idx) => {
                    const currentStock = getProductCurrentStock(item.productId);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2.5">
                        <div className="col-span-12 sm:col-span-6">
                          <select required className="input text-[12.5px]" value={item.productId} onChange={(e) => handleProductChange(idx, Number(e.target.value))}>
                            <option value="0">Select product</option>
                            {products.map((p) => {
                              const pStock = getProductCurrentStock(p.id);
                              return (
                                <option key={p.id} value={p.id} disabled={pStock <= 0}>
                                  {p.name} {p.status !== "active" ? "(Offline)" : ""} (Stock: {pStock})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            min="1"
                            max={currentStock || 1}
                            required
                            className="input text-[12.5px] tabular"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...saleItems];
                              updated[idx].quantity = Number(e.target.value);
                              setSaleItems(updated);
                            }}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            required
                            className="input text-[12.5px] tabular"
                            placeholder="Rate"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const updated = [...saleItems];
                              updated[idx].unitPrice = Number(e.target.value);
                              setSaleItems(updated);
                            }}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          {saleItems.length > 1 && (
                            <button type="button" onClick={() => handleRemoveItem(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item">
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 border-t border-slate-100">
                  <span className="text-[12.5px] font-semibold text-slate-600">Subtotal</span>
                  <span className="text-[16px] font-bold text-navy-900 tabular">{inr2(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{isEmi ? "Down payment" : "Amount paid"}</label>
                <input type="number" step="0.01" className="input tabular" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
                {subtotal > 0 && (
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="button" onClick={() => setPaidAmount(subtotal)} className="text-[11.5px] font-semibold text-brand-700 hover:underline">Full amount</button>
                    <span className="text-slate-300">·</span>
                    <button type="button" onClick={() => setPaidAmount(0)} className="text-[11.5px] font-semibold text-slate-500 hover:underline">Nothing now</button>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Payment mode</label>
                <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={isEmi}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                </select>
              </div>
            </div>

            {subtotal > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-[13px]">
                <span className="text-slate-500">Balance after this sale</span>
                <b className={`tabular ${subtotal - (Number(paidAmount) || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {inr2(Math.max(0, subtotal - (Number(paidAmount) || 0)))}
                </b>
              </div>
            )}

            {/* EMI */}
            <div className={`rounded-xl border p-3.5 transition ${isEmi ? "border-brand-300 bg-brand-50/40" : "border-border"}`}>
              <label className="flex items-center gap-2.5 cursor-pointer text-[13px] font-semibold text-navy-900">
                <input type="checkbox" checked={isEmi} onChange={(e) => setIsEmi(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4" />
                Sell on EMI / installments
              </label>
              {isEmi && (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <label className="label">Tenure (months)</label>
                    <input type="number" min="1" max="60" className="input" value={emiTenure} onChange={(e) => setEmiTenure(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Interest rate (%)</label>
                    <input type="number" step="0.1" className="input" value={emiInterest} onChange={(e) => setEmiInterest(Number(e.target.value))} />
                  </div>
                </div>
              )}
            </div>

            {createError && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {createError}</p>
            )}
          </form>
        </Modal>
      )}

      {/* Pay Due Modal */}
      {payingSale && (
        <Modal
          size="sm"
          icon="wallet"
          title="Collect payment"
          subtitle={`Invoice ${payingSale.invoice_number}${payingSale.customer ? ` · ${payingSale.customer.name}` : ""}`}
          onClose={() => setPayingSale(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPayingSale(null)}>Cancel</button>
              <button type="submit" form="pay-due-form" disabled={paySaving} className="btn-primary">{paySaving ? "Saving…" : "Save payment"}</button>
            </>
          }
        >
          <form id="pay-due-form" onSubmit={handleRecordPayment} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniFigure label="Total" value={inr2(payingSale.total_amount)} />
              <MiniFigure label="Paid" value={inr2(payingSale.paid_amount)} tone="text-emerald-600" />
              <MiniFigure label="Due" value={inr2(payingSale.due_amount)} tone="text-rose-600" />
            </div>
            <div>
              <label className="label">Amount *</label>
              <input type="number" step="0.01" max={payingSale.due_amount} required className="input text-[16px] font-semibold tabular" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["cash", "Cash"],
                  ["upi", "UPI"],
                  ["card", "Card"],
                  ["bank_transfer", "Bank"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPayMethod(k)}
                    className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold ring-1 transition ${payMethod === k ? "ring-2 ring-brand-500 bg-brand-50 text-brand-800" : "ring-border text-slate-600 hover:ring-slate-300"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Sale Modal */}
      {returningSale && (
        <Modal
          icon="refresh"
          title={`Process Return — ${returningSale.invoice_number}`}
          subtitle={`Customer: ${returningSale.customer?.name || "Customer"}`}
          onClose={() => setReturningSale(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setReturningSale(null)}>
                Cancel
              </button>
              <button
                type="submit"
                form="return-sale-form"
                disabled={returnSubmitting}
                className="btn-primary"
              >
                {returnSubmitting ? "Processing…" : "Confirm Return & Refund"}
              </button>
            </>
          }
        >
          <form id="return-sale-form" onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 leading-relaxed">
              Returning items automatically restores inventory stock, posts a credit adjustment to the customer ledger reducing their balance, and updates invoice status.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Select Items to Return
              </label>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {(returningSale.items || []).map((item) => {
                  const alreadyReturned = item.returned_quantity || 0;
                  const available = Math.max(0, item.quantity - alreadyReturned);
                  const currentQty = returnItems[item.id] || 0;
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">{item.product_name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Purchased: {item.quantity} • Returned: {alreadyReturned} • <span className="font-medium text-emerald-700">Max returnable: {available}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={available}
                          disabled={available <= 0}
                          value={currentQty}
                          onChange={(e) => {
                            const val = Math.min(available, Math.max(0, parseInt(e.target.value, 10) || 0));
                            setReturnItems((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          className="w-16 input text-center font-mono py-1 px-1.5"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Defective item, customer returned, wrong size"
                className="input w-full text-xs"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { paid: "Paid", partially_paid: "Partial", unpaid: "Unpaid", cancelled: "Cancelled" };

const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const inr2 = (n: number | string) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusChip(s: Sale): { label: string; cls: string; dot: string } {
  switch (s.status) {
    case "paid":
      return { label: "Paid", cls: "badge-active", dot: "bg-emerald-500" };
    case "partially_paid":
      return { label: "Partial", cls: "badge-warn", dot: "bg-amber-500" };
    case "cancelled":
      return { label: "Cancelled", cls: "badge-inactive", dot: "bg-slate-400" };
    case "returned":
      return { label: "Returned", cls: "badge-inactive", dot: "bg-slate-400" };
    case "partially_returned":
      return { label: "Part returned", cls: "badge-warn", dot: "bg-amber-500" };
    default:
      return { label: "Unpaid", cls: "badge-danger", dot: "bg-rose-500" };
  }
}

function RowBtn({ title, icon, onClick, to, tone }: { title: string; icon: IconName; onClick?: () => void; to?: string; tone?: "rose" }) {
  const cls = `w-8 h-8 rounded-lg flex items-center justify-center transition ${tone === "rose" ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-slate-500 hover:bg-slate-100 hover:text-navy-900"}`;
  if (to)
    return (
      <Link to={to} title={title} aria-label={title} className={cls}>
        <Icon name={icon} className="w-4 h-4" />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cls}>
      <Icon name={icon} className="w-4 h-4" />
    </button>
  );
}

function MiniFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-[13.5px] font-bold tabular truncate ${tone || "text-navy-900"}`}>{value}</div>
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
