import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPurchase, downloadPurchasePdf, returnPurchase } from "../../api/purchases";
import { apiErrorMessage } from "../../api/client";
import ReferenceLink from "../../components/ReferenceLink";
import type { Purchase } from "../../types";

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<{ [purchaseItemId: number]: number }>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  async function handleRecordReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!purchase) return;
    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([purchaseItemId, quantity]) => ({
        purchaseItemId: Number(purchaseItemId),
        quantity: Number(quantity),
      }));

    if (itemsToReturn.length === 0) {
      alert("Please enter a return quantity greater than 0 for at least one item.");
      return;
    }

    setReturnSubmitting(true);
    try {
      await returnPurchase(purchase.id, itemsToReturn, returnReason.trim() || undefined);
      const refreshed = await getPurchase(purchase.id);
      if (refreshed.data.success && refreshed.data.data) {
        setPurchase(refreshed.data.data);
      }
      setShowReturnModal(false);
      setStatusMsg("Purchase return processed successfully. Stock deducted and supplier ledger debited.");
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to process purchase return"));
    } finally {
      setReturnSubmitting(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getPurchase(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setPurchase(res.data.data);
        } else {
          setError("Purchase bill not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load purchase bill");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPdf() {
    if (!purchase) return;
    setDownloading(true);
    try {
      const res = await downloadPurchasePdf(purchase.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Purchase-${purchase.purchase_number || purchase.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading purchase bill...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Purchase Bill Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No purchase bill matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/purchase")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Purchases
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
    unpaid: "bg-rose-50 text-rose-700 border-rose-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const statusBadge = statusColors[purchase.status] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go Back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono text-slate-900">{purchase.purchase_number}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusBadge}`}>
                {purchase.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Purchased on {new Date(purchase.purchase_date || (purchase as any).created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {purchase.status !== "cancelled" && purchase.status !== "returned" && (
            <button
              onClick={() => {
                const initial: Record<number, number> = {};
                (purchase.items || []).forEach((it) => {
                  initial[it.id] = 0;
                });
                setReturnItems(initial);
                setReturnReason("");
                setShowReturnModal(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>Return to Supplier</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Information Cards: Supplier & Shop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Supplier Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier Details</span>
            {purchase.supplier && (
              <ReferenceLink type="supplier" id={purchase.supplier.id} className="text-xs font-medium">
                View Profile →
              </ReferenceLink>
            )}
          </div>
          {purchase.supplier ? (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 text-sm">
                <ReferenceLink type="supplier" id={purchase.supplier.id}>
                  {purchase.supplier.name}
                </ReferenceLink>
              </p>
              {purchase.supplier.phone && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">Phone:</span> {purchase.supplier.phone}
                </p>
              )}
              {purchase.supplier.email && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">Email:</span> {purchase.supplier.email}
                </p>
              )}
              {purchase.supplier.gstin && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">GSTIN:</span> <span className="font-mono">{purchase.supplier.gstin}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No supplier associated</p>
          )}
        </div>

        {/* Shop Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Receiving Shop</span>
            <span className="text-xs font-mono font-medium text-slate-500">{purchase.shop?.code}</span>
          </div>
          {purchase.shop ? (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 text-sm">{purchase.shop.name}</p>
              {purchase.shop.phone && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">Phone:</span> {purchase.shop.phone}
                </p>
              )}
              {purchase.shop.address && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">Address:</span> {purchase.shop.address}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Default Store</p>
          )}
        </div>
      </div>

      {/* Purchased Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Purchased Items</span>
          <span className="text-xs text-slate-500">{purchase.items?.length || 0} product(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4 text-right">Qty</th>
                <th className="py-2.5 px-4 text-right">Returned</th>
                <th className="py-2.5 px-4 text-right">Purchase Rate</th>
                <th className="py-2.5 px-4 text-right">Discount</th>
                <th className="py-2.5 px-4 text-right">Tax</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {purchase.items && purchase.items.length > 0 ? (
                purchase.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.product_id ? (
                        <ReferenceLink type="product" id={item.product_id} className="text-slate-900 hover:text-emerald-700 font-normal">
                          {item.product?.name || `Product #${item.product_id}`}
                        </ReferenceLink>
                      ) : (
                        item.product?.name || "Product"
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {item.product_id ? (
                        <ReferenceLink type="product" id={item.product_id}>
                          {item.product?.sku || "—"}
                        </ReferenceLink>
                      ) : (
                        item.product?.sku || "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{item.quantity}</td>
                    <td className="py-3 px-4 text-right">
                      {(item as any).returned_quantity > 0 ? (
                        <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full text-[11px]">
                          {(item as any).returned_quantity}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">₹{Number(item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {item.discount_amount && item.discount_amount > 0 ? `₹${Number(item.discount_amount).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {item.tax_amount > 0 ? `₹${Number(item.tax_amount).toLocaleString("en-IN")} (${item.tax_percent}%)` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      ₹{Number(item.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400 italic">No items found in this purchase bill</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bill Summary Box */}
        <div className="p-5 bg-slate-50/40 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="text-xs text-slate-500 space-y-1">
            <p><span className="font-semibold text-slate-600">Payment Method:</span> <span className="uppercase">{purchase.payment_method || "Bank Transfer"}</span></p>
            {purchase.notes && <p><span className="font-semibold text-slate-600">Notes:</span> {purchase.notes}</p>}
          </div>

          <div className="w-full md:w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{Number(purchase.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {Number(purchase.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-₹{Number(purchase.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {Number(purchase.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>+₹{Number(purchase.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Grand Total</span>
              <span>₹{Number(purchase.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold pt-1">
              <span>Paid to Supplier</span>
              <span>₹{Number(purchase.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {Number((purchase as any).returned_amount) > 0 && (
              <div className="flex justify-between text-amber-700 font-semibold pt-1">
                <span>Returned to Supplier</span>
                <span>-₹{Number((purchase as any).returned_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {Number(purchase.due_amount) > 0 && (
              <div className="flex justify-between text-rose-700 font-bold border-t border-rose-100 pt-1">
                <span>Balance Due</span>
                <span>₹{Number(purchase.due_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Payments Table */}
      {purchase.payments && purchase.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier Payments Recorded</span>
            <span className="text-xs text-slate-500">{purchase.payments.length} payment(s)</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Payment #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Transaction Ref</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchase.payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-800">#{p.id}</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {new Date(p.payment_date || p.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-2.5 px-4 uppercase text-slate-700 font-medium">{p.method}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{p.transaction_id || "—"}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                    ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Return to Supplier Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Return Items to Supplier — #{purchase.purchase_number}</h3>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 leading-relaxed">
              Returning items will deduct stock from your inventory, record a debit entry in the supplier ledger (reducing payable balance), and update this purchase bill.
            </div>

            <form onSubmit={handleRecordReturn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-2">Select Items to Return</label>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                  {(purchase.items || []).map((item) => {
                    const alreadyReturned = (item as any).returned_quantity || 0;
                    const available = Math.max(0, item.quantity - alreadyReturned);
                    const currentQty = returnItems[item.id] || 0;
                    return (
                      <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.product?.name || `Product #${item.product_id}`}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Purchased: {item.quantity} • Returned: {alreadyReturned} • <span className="text-emerald-700 font-medium">Available: {available}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
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
                <label className="block font-semibold text-slate-700 mb-1">Return Reason (Optional)</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Defective pieces, excess inventory, wrong specification"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowReturnModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={returnSubmitting} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
                  {returnSubmitting ? "Processing…" : "Confirm Supplier Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
