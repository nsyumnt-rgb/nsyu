import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listPurchases, createPurchase, recordPurchasePayment, cancelPurchase, downloadPurchasePdf } from "../api/purchases";
import { listSuppliers } from "../api/suppliers";
import { listProducts } from "../api/products";
import { getSupplierOutstandingReport } from "../api/reports";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import type { Purchase, Supplier, Product } from "../types";
import { Avatar, ChoiceGroup, EmptyState, Icon, IconButton, Modal, PageHeader, SearchInput, Segmented, StatCard, Switch } from "../components/ui";

/* Marketplace wireframe — board 17 (Purchases). */

const inr = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);
const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pur-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const STATUS: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "badge-danger" },
  received: { label: "Unpaid", tone: "badge-danger" },
  partially_paid: { label: "Partial", tone: "badge-warn" },
  paid: { label: "Paid", tone: "badge-active" },
  partially_returned: { label: "Part returned", tone: "badge-brand" },
  returned: { label: "Returned", tone: "badge-inactive" },
  cancelled: { label: "Cancelled", tone: "badge-inactive" },
};
const FILTERS: [string, string][] = [
  ["", "All"],
  ["unpaid", "Unpaid"],
  ["partially_paid", "Partial"],
  ["paid", "Paid"],
  ["partially_returned", "Returned"],
  ["cancelled", "Cancelled"],
];

interface Line {
  productId: number;
  quantity: number;
  rate: number;
  taxPercent: number;
}
const blankLine = (): Line => ({ productId: 0, quantity: 1, rate: 0, taxPercent: 0 });

function PurchaseInner() {
  const { can, isOwner } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const [params, setParams] = useSearchParams();
  const supplierFilter = params.get("supplierId") ? Number(params.get("supplierId")) : undefined;

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [payable, setPayable] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [allShopsToggle, setAllShopsToggle] = useState(false);
  const [search, setSearch] = useState("");

  // Record purchase bill (inline form)
  const formRef = useRef<HTMLFormElement>(null);
  const [supplierId, setSupplierId] = useState<number | "">(supplierFilter ?? "");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayISO());
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paidNow, setPaidNow] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(newKey());

  // Payment dialog
  const [paying, setPaying] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const all = isOwner && allShopsToggle ? true : undefined;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    Promise.all([
      listPurchases({ status: statusFilter || undefined, supplierId: supplierFilter, allShops: all, limit: 200 }),
      listPurchases({ from: monthStart, allShops: all, limit: 500 }).catch(() => ({ data: { data: [] as Purchase[] } })),
      getSupplierOutstandingReport().catch(() => null),
    ])
      .then(([list, month, report]) => {
        setPurchases(list.data.data ?? []);
        setMonthTotal(
          (month.data.data ?? [])
            .filter((p: any) => p.status !== "cancelled")
            .reduce((a: number, p: any) => a + Number(p.total_amount) - Number(p.returned_amount || 0), 0)
        );
        setPayable(report ? Number(report.data?.data?.summary?.totalPayable ?? 0) : null);
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load purchases")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopId, statusFilter, allShopsToggle, supplierFilter]);

  useEffect(() => {
    Promise.all([listSuppliers(), listProducts()])
      .then(([s, p]) => {
        setSuppliers((s.data.data ?? []).filter((x) => x.status !== "inactive"));
        setProducts(p.data.data ?? []);
      })
      .catch(() => {});
  }, [shopId]);

  const unpaidCount = purchases.filter((p) => Number(p.due_amount) > 0 && p.status !== "cancelled").length;
  const filterSupplier = suppliers.find((s) => s.id === supplierFilter);

  /* ── form maths (matches the server: rate is unit cost, GST added per line) ── */
  const lineAmounts = lines.map((l) => {
    const base = round2(l.quantity * l.rate);
    const tax = round2((base * (l.taxPercent || 0)) / 100);
    return { base, tax, total: round2(base + tax) };
  });
  const subtotal = round2(lineAmounts.reduce((a, x) => a + x.base, 0));
  const gst = round2(lineAmounts.reduce((a, x) => a + x.tax, 0));
  const total = round2(subtotal + gst);
  const paid = Number(paidNow) || 0;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickProduct(i: number, p: Product) {
    setLine(i, { productId: p.id, rate: Number(p.purchase_price || 0) || Number(p.selling_price || 0) });
  }

  function resetForm() {
    setBillNo("");
    setBillDate(todayISO());
    setLines([blankLine()]);
    setPaidNow("");
    setPaymentMethod("cash");
    setRequestKey(newKey());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSavedMsg(null);
    if (!supplierId) return setFormError("Choose a supplier.");
    const valid = lines.filter((l) => l.productId > 0 && l.quantity > 0);
    if (!valid.length) return setFormError("Add at least one product with a quantity.");
    if (valid.some((l) => !(l.rate >= 0))) return setFormError("Every line needs a cost.");
    if (paid < 0) return setFormError("Paid amount can't be negative.");
    if (paid > total + 0.005) return setFormError(`Paid now can't be more than the bill total (${inr(total)}).`);

    setSaving(true);
    try {
      const res = await createPurchase({
        supplierId: Number(supplierId),
        items: valid.map((l) => ({ productId: l.productId, quantity: l.quantity, rate: l.rate, taxPercent: l.taxPercent || 0 })),
        initialPaid: paid,
        paymentMethod: paid > 0 ? paymentMethod : undefined,
        notes: billNo.trim() ? `Supplier bill no: ${billNo.trim()}` : undefined,
        purchaseDate: billDate ? new Date(`${billDate}T12:00:00`).toISOString() : undefined,
        clientRequestId: requestKey,
      });
      const created: any = res.data.data;
      setSavedMsg(`Saved ${created?.purchase_number || "purchase"} · stock received${Number(created?.due_amount) > 0 ? ` · ${inr(Number(created.due_amount))} added to supplier ledger` : ""}`);
      resetForm();
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not save the purchase bill"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!paying) return;
    const amt = Number(payAmount);
    if (!(amt > 0)) return setPayError("Enter an amount above zero.");
    setPaySaving(true);
    setPayError(null);
    try {
      await recordPurchasePayment(paying.id, { amount: amt, method: payMethod });
      setPaying(null);
      load();
    } catch (err) {
      setPayError(apiErrorMessage(err, "Could not record payment"));
    } finally {
      setPaySaving(false);
    }
  }

  async function handleCancel(p: Purchase) {
    const reason = prompt(`Cancel ${p.purchase_number}? This reverses its stock. Reason:`);
    if (!reason) return;
    try {
      await cancelPurchase(p.id, reason);
      load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not cancel purchase"));
    }
  }

  async function handlePdf(p: Purchase) {
    try {
      const res = await downloadPurchasePdf(p.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.purchase_number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(apiErrorMessage(err, "Could not download PDF"));
    }
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? purchases.filter((p) => String(p.purchase_number || "").toLowerCase().includes(q) || String(p.supplier?.name || "").toLowerCase().includes(q))
    : purchases;
  const dueTotal = purchases.filter((p) => p.status !== "cancelled").reduce((a, p) => a + Number(p.due_amount || 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Buying"
        title="Purchases"
        subtitle="Supplier bills, stock received and what you owe."
        actions={
          <>
            <Link to="/app/suppliers" className="btn-secondary">
              <Icon name="users" className="w-4 h-4 text-slate-500" /> Suppliers
            </Link>
            {can("purchase", "create") && (
              <button type="button" className="btn-primary" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <Icon name="plus" /> Record purchase bill
              </button>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="This month" icon="truck" tone="violet" value={inr0(monthTotal)} loading={loading} hint="Purchases since the 1st" />
        <StatCard
          label="Payable to suppliers"
          icon="wallet"
          tone="amber"
          value={payable === null ? "—" : inr0(payable)}
          valueClass={payable ? "text-amber-600" : undefined}
          loading={loading}
          to="/app/suppliers"
          hint={payable === null ? "No permission" : "Across all suppliers"}
        />
        <StatCard
          label="Unpaid bills"
          icon="clock"
          tone="rose"
          value={String(unpaidCount)}
          valueClass={unpaidCount ? "text-rose-600" : undefined}
          loading={loading}
          hint={`${inr0(dueTotal)} due in this list`}
          active={statusFilter === "unpaid"}
          onClick={() => setStatusFilter(statusFilter === "unpaid" ? "" : "unpaid")}
        />
        <StatCard label="Bills listed" icon="receipt" tone="brand" value={String(purchases.length)} loading={loading} hint={filterSupplier ? `From ${filterSupplier.name}` : "Latest 200"} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5 items-start">
        {/* Purchase history */}
        <section className="card overflow-hidden 2xl:col-span-7">
          <div className="p-4 sm:px-5 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="card-title text-[14.5px]">Purchase history</h2>
                {filterSupplier && (
                  <button type="button" onClick={() => setParams({})} className="badge-brand hover:bg-brand-100" title="Clear supplier filter">
                    {filterSupplier.name} <Icon name="x" className="w-3 h-3" />
                  </button>
                )}
              </div>
              {isOwner && <Switch checked={allShopsToggle} onChange={setAllShopsToggle} label="All shops" />}
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <Segmented size="sm" value={statusFilter} onChange={setStatusFilter} options={FILTERS.map(([key, label]) => ({ key, label }))} />
              <SearchInput className="md:w-[220px]" value={search} onChange={setSearch} placeholder="Bill # or supplier…" />
            </div>
          </div>

          {error && (
            <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
              <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <RowsSkeleton />
          ) : visible.length === 0 ? (
            purchases.length === 0 ? (
              <EmptyState icon="truck" tone="violet" title="No purchase bills yet" text="Record a supplier bill to add stock and track what you owe." />
            ) : (
              <EmptyState icon="search" title="No bills match" text="Try a different bill number or supplier." />
            )
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th className="!text-right">Amount</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const st = STATUS[p.status] || { label: p.status, tone: "badge-inactive" };
                    const due = Number(p.due_amount);
                    const canPay = due > 0 && p.status !== "cancelled" && can("purchase", "edit");
                    const canCancel = p.status !== "cancelled" && Number(p.paid_amount) === 0 && !Number((p as any).returned_amount) && can("purchase", "delete");
                    return (
                      <tr key={p.id} className={p.status === "cancelled" ? "opacity-60" : ""}>
                        <td className="whitespace-nowrap">
                          <Link to={`/app/purchase/${p.id}`} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline">#{p.purchase_number}</Link>
                          <div className="text-[11.5px] text-slate-400">
                            {new Date(p.purchase_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            {allShopsToggle && p.shop?.name ? ` · ${p.shop.name}` : ""}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5 min-w-[140px]">
                            <Avatar name={p.supplier?.name || "?"} size="sm" />
                            <span className="truncate max-w-[160px] text-[13px] font-medium text-navy-900">{p.supplier?.name || "—"}</span>
                          </div>
                        </td>
                        <td><span className={st.tone}>{st.label}</span></td>
                        <td className="text-right whitespace-nowrap">
                          <div className="font-semibold text-navy-900 tabular">{inr(Number(p.total_amount))}</div>
                          {p.status !== "cancelled" && due > 0 && <div className="text-[11.5px] font-semibold text-rose-600 tabular">{inr(due)} due</div>}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {canPay && (
                              <button type="button" className="btn-soft btn-sm" onClick={() => { setPaying(p); setPayAmount(due.toFixed(2)); setPayMethod("cash"); setPayError(null); }}>
                                <Icon name="wallet" className="w-3.5 h-3.5" /> Pay
                              </button>
                            )}
                            <IconButton title="View bill" icon="eye" to={`/app/purchase/${p.id}`} />
                            <IconButton title="Download PDF" icon="download" onClick={() => handlePdf(p)} />
                            {canCancel && <IconButton title="Cancel bill" icon="ban" tone="rose" onClick={() => handleCancel(p)} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Record purchase bill */}
        {can("purchase", "create") && (
          <form ref={formRef} onSubmit={handleSave} className="card overflow-hidden 2xl:col-span-5 2xl:sticky 2xl:top-24 scroll-mt-24">
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center">
                  <Icon name="receipt" className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="card-title text-[14px]">Record purchase bill</h2>
                  {activeShop && <p className="text-[11.5px] text-slate-400">Stock goes into {activeShop.name}</p>}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Supplier</label>
                  <select className="input" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value) || "")}>
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {suppliers.length === 0 && (
                    <Link to="/app/suppliers" className="text-[11.5px] font-semibold text-brand-700 mt-1 inline-block">+ Add a supplier first</Link>
                  )}
                </div>
                <div>
                  <label className="label">Supplier bill no.</label>
                  <input className="input" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Bill number" maxLength={60} />
                </div>
              </div>
              <div>
                <label className="label">Bill date</label>
                <input type="date" className="input" value={billDate} max={todayISO()} onChange={(e) => setBillDate(e.target.value)} />
              </div>

              {/* Lines */}
              <div className="rounded-xl border border-border overflow-visible">
                <div className="hidden md:grid grid-cols-[minmax(140px,1fr)_64px_96px_64px_100px_28px] gap-2 px-3 py-2 bg-slate-50 rounded-t-xl text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span>Cost ₹</span>
                  <span>GST %</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-100">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] md:grid-cols-[minmax(140px,1fr)_64px_96px_64px_100px_28px] gap-2 items-center px-3 py-2">
                      <div className="col-span-4 md:col-span-1 min-w-0">
                        <ProductPicker products={products} value={l.productId} onPick={(p) => pickProduct(i, p)} />
                      </div>
                      <input type="number" min={1} step={1} aria-label="Quantity" placeholder="Qty" className="input px-2 text-center" value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(0, Math.floor(Number(e.target.value))) })} />
                      <input type="number" min={0} step="0.01" aria-label="Cost per unit" placeholder="Cost ₹" className="input px-2" value={l.rate} onChange={(e) => setLine(i, { rate: Number(e.target.value) })} />
                      <input type="number" min={0} max={28} step="0.01" aria-label="GST percent" placeholder="GST %" className="input px-2" value={l.taxPercent} onChange={(e) => setLine(i, { taxPercent: Number(e.target.value) })} />
                      <span className="order-last md:order-none col-span-4 md:col-span-1 text-right text-[13px] font-semibold text-navy-900 tabular"><span className="md:hidden text-slate-400 font-normal mr-1">Amount</span>{inr(lineAmounts[i].total)}</span>
                      <button
                        type="button"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                        aria-label="Remove line"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-slate-100">
                  <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="btn-ghost btn-sm text-brand-700">
                    <Icon name="plus" className="w-3.5 h-3.5" /> Add line
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <label className="label">Paid now (₹)</label>
                    <input type="number" min={0} step="0.01" className="input tabular" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0.00" />
                    {total > 0 && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button type="button" onClick={() => setPaidNow(total.toFixed(2))} className="text-[11.5px] font-semibold text-brand-700 hover:underline">Full amount</button>
                        <span className="text-slate-300">·</span>
                        <button type="button" onClick={() => setPaidNow("")} className="text-[11.5px] font-semibold text-slate-500 hover:underline">On credit</button>
                      </div>
                    )}
                  </div>
                  {paid > 0 && (
                    <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} aria-label="Payment method">
                      {METHODS.map(([k, l]) => (
                        <option key={k} value={k}>{l}</option>
                      ))}
                    </select>
                  )}
                </div>
                <dl className="text-[13px] space-y-1.5 self-end rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="tabular">{inr(subtotal)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>GST (input credit)</dt><dd className="tabular">{inr(gst)}</dd></div>
                  <div className="flex justify-between font-bold text-navy-900 text-[15px] pt-1.5 border-t border-slate-200"><dt>Total</dt><dd className="tabular">{inr(total)}</dd></div>
                  {total > 0 && (
                    <div className="flex justify-between text-[12px] font-semibold text-rose-600"><dt>Will owe supplier</dt><dd className="tabular">{inr(Math.max(0, total - paid))}</dd></div>
                  )}
                </dl>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
                  <Icon name="alert" className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              {savedMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12.5px] text-emerald-800">
                  <Icon name="checkCircle" className="w-4 h-4 shrink-0" /> {savedMsg}
                </div>
              )}

              <button type="submit" disabled={saving} className="btn-primary btn-lg w-full">
                {saving ? "Saving…" : "Save & receive stock"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Payment dialog */}
      {paying && (
        <Modal
          size="sm"
          icon="wallet"
          title="Pay supplier"
          subtitle={`#${paying.purchase_number} · ${paying.supplier?.name || ""}`}
          onClose={() => setPaying(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
              <button type="submit" form="pay-supplier-form" disabled={paySaving} className="btn-primary">{paySaving ? "Saving…" : "Save payment"}</button>
            </>
          }
        >
          <form id="pay-supplier-form" onSubmit={handlePay} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
              <span className="text-[12.5px] font-medium text-rose-700">Due on this bill</span>
              <span className="text-[15px] font-bold text-rose-700 tabular">{inr(Number(paying.due_amount))}</span>
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" min="0.01" step="0.01" max={Number(paying.due_amount)} required className="input text-[16px] font-semibold tabular" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Method</label>
              <ChoiceGroup value={payMethod} onChange={setPayMethod} options={METHODS} cols={3} />
            </div>
            {payError && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {payError}</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────── components ───────────────────────── */

const METHODS: [string, string][] = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["bank_transfer", "Bank / NEFT"],
  ["cheque", "Cheque"],
  ["card", "Card"],
];

const inr0 = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

function RowsSkeleton() {
  return (
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
  );
}

/** Type-to-search product picker (the catalogue can have thousands of products). */
function ProductPicker({ products, value, onPick }: { products: Product[]; value: number; onPick: (p: Product) => void }) {
  const selected = products.find((p) => p.id === value);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? products.filter((p) => p.name.toLowerCase().includes(s) || String(p.sku || "").toLowerCase().includes(s)) : products;
    return list.slice(0, 8);
  }, [q, products]);

  return (
    <div ref={boxRef} className="relative min-w-0">
      <input
        className="input px-2 truncate"
        value={open ? q : selected ? selected.name : q}
        placeholder="Search product…"
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        title={selected?.name}
      />
      {open && (
        <ul className="absolute z-30 left-0 mt-1 w-[min(340px,80vw)] max-h-64 overflow-auto rounded-xl bg-white border border-border shadow-lift py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-slate-500">No match</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onPick(p); setOpen(false); setQ(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-50"
                >
                  <div className="text-[12.5px] font-medium text-navy-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {p.sku} · cost ₹{Number(p.purchase_price || 0).toLocaleString("en-IN")} · stock {Number((p as any).stocks?.[0]?.current_stock ?? 0)}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PurchasePage() {
  return (
    <RequireModule module="purchase">
      <PurchaseInner />
    </RequireModule>
  );
}
