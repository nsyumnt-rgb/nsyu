import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPortalBillApi, requestPortalBillReturnApi } from "../../api/portal";
import { getApiBaseUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { BillStatusBadge } from "./PortalHome";

export default function PortalBillDetail() {
  const { id } = useParams<{ id: string }>();
  const accessToken = usePortalStore((s) => s.accessToken);

  const [bill, setBill] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Return request state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<{ [saleItemId: number]: number }>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnMsg, setReturnMsg] = useState<string | null>(null);

  async function fetchBill() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPortalBillApi(Number(id));
      setBill(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load invoice details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBill();
  }, [id]);

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([saleItemId, quantity]) => ({
        saleItemId: Number(saleItemId),
        quantity: Number(quantity),
      }));

    if (itemsToReturn.length === 0) {
      alert("Please select at least one item with a return quantity greater than 0.");
      return;
    }

    setReturnSubmitting(true);
    try {
      const res = await requestPortalBillReturnApi(bill.id, itemsToReturn, returnReason.trim() || undefined);
      setReturnMsg(res.message || "Return request submitted successfully. Shop staff will review your request.");
      setShowReturnModal(false);
      await fetchBill();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit return request");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!bill) return;
    try {
      const url = `${getApiBaseUrl()}/customer-portal/bills/${bill.id}/pdf`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Invoice-${bill.invoice_number || bill.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Error generating invoice PDF.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 mt-2 font-medium">Loading invoice...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-gray-900">Invoice Not Found</h2>
        <p className="text-xs text-gray-500 mt-1">{error || "The requested invoice could not be located."}</p>
        <Link
          to="/portal/bills"
          className="mt-4 inline-block px-4 py-2 bg-[#047857] text-white rounded-xl text-xs font-bold"
        >
          &larr; Back to Invoices
        </Link>
      </div>
    );
  }

  const balanceDue = Number(bill.total_amount) - Number(bill.paid_amount || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/portal/bills"
          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
        >
          <span>&larr; Back to Invoices</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {bill.payment_status !== "CANCELLED" && bill.status !== "cancelled" && bill.status !== "returned" && (
            <button
              type="button"
              onClick={() => {
                const initial: Record<number, number> = {};
                (bill.items || []).forEach((it: any) => {
                  initial[it.id] = 0;
                });
                setReturnItems(initial);
                setReturnReason("");
                setShowReturnModal(true);
              }}
              className="px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs hover:bg-amber-100 transition shadow-sm flex items-center gap-1.5"
            >
              <span>Request Return</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-sm"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Download Official PDF</span>
          </button>
        </div>
      </div>

      {returnMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{returnMsg}</span>
          </div>
          <button onClick={() => setReturnMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Printable Invoice Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Header: Shop & Invoice Meta */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Tax Invoice</div>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5">{bill.shop?.name || "Shop"}</h1>
            {bill.shop?.address && <p className="text-xs text-gray-600 max-w-sm mt-1">{bill.shop.address}</p>}
            {bill.shop?.phone && <p className="text-xs text-gray-600 mt-0.5">Phone: +91 {bill.shop.phone}</p>}
            {bill.shop?.gstin && <p className="text-xs text-gray-600 font-mono">GSTIN: {bill.shop.gstin}</p>}
          </div>

          <div className="sm:text-right space-y-1">
            <div className="flex items-center sm:justify-end gap-2">
              <span className="text-lg font-black text-gray-900">{bill.invoice_number || `INV${String(bill.id).padStart(6, '0')}`}</span>
              <BillStatusBadge status={bill.payment_status} />
            </div>
            <div className="text-xs text-gray-600">
              Date: <span className="font-semibold">{new Date(bill.createdAt || bill.date).toLocaleDateString("en-IN")}</span>
            </div>
            {bill.due_date && (
              <div className="text-xs text-gray-600">
                Due Date: <span className="font-semibold">{new Date(bill.due_date).toLocaleDateString("en-IN")}</span>
              </div>
            )}
            <div className="text-xs text-gray-600">
              Payment Method: <span className="font-semibold capitalize">{bill.payment_method || "Credit / Ledger"}</span>
            </div>
          </div>
        </div>

        {/* Customer Info Box */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <div>
            <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Billed To</div>
            <div className="font-bold text-sm text-gray-900 uppercase">{bill.customer?.name}</div>
            <div className="text-gray-600 mt-0.5">Mobile: +91 {bill.customer?.phone}</div>
            {bill.customer?.address && <div className="text-gray-600">{bill.customer.address}</div>}
            {bill.customer?.gstin && <div className="text-gray-600 font-mono mt-0.5">GSTIN: {bill.customer.gstin}</div>}
          </div>

          <div className="sm:text-right">
            <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Invoice Amount</div>
            <div className="text-2xl font-black text-gray-900">
              ₹{Number(bill.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            {balanceDue > 0 ? (
              <div className="text-xs font-bold text-rose-600 mt-0.5">
                Balance Due: ₹{balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            ) : (
              <div className="text-xs font-bold text-emerald-600 mt-0.5">Fully Paid</div>
            )}
          </div>
        </div>

        {/* Invoice Items Table (Desktop) */}
        <div className="hidden md:block border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#047857] text-white uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3">Item Description</th>
                <th className="p-3 text-center">HSN</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-center">Returned</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Tax (GST)</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bill.items?.map((item: any, idx: number) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-gray-900">{item.product_name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">SKU: {item.sku}</div>
                  </td>
                  <td className="p-3 text-center text-gray-500 font-mono">{item.hsn_code || "—"}</td>
                  <td className="p-3 text-center font-bold text-gray-800">{item.quantity}</td>
                  <td className="p-3 text-center font-bold text-amber-700">
                    {item.returned_quantity > 0 ? item.returned_quantity : <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className="p-3 text-right text-gray-700">
                    ₹{Number(item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right text-gray-700">
                    {item.tax_rate ? `${item.tax_rate}%` : "0%"} (₹{Number(item.tax_amount || 0).toFixed(2)})
                  </td>
                  <td className="p-3 text-right font-black text-gray-900">
                    ₹{Number(item.line_total || item.total || item.quantity * item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Items (Mobile Cards) */}
        <div className="md:hidden divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
          {bill.items?.map((item: any, idx: number) => (
            <div key={item.id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 text-xs leading-snug">{item.product_name}</div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">#{idx + 1} · SKU: {item.sku || "—"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-gray-900 text-sm">
                    ₹{Number(item.line_total || item.total || item.quantity * item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {item.quantity} × ₹{Number(item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-50">
                <span>HSN: {item.hsn_code || "—"}</span>
                {item.returned_quantity > 0 && (
                  <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                    Ret: {item.returned_quantity}
                  </span>
                )}
                <span>GST: {item.tax_rate ? `${item.tax_rate}%` : "0%"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Returns & Credit Adjustments Card */}
        {bill.returns && bill.returns.length > 0 && (
          <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Returns & Credits Applied</span>
              </div>
              <span className="text-xs font-bold text-amber-800">{bill.returns.length} return record(s)</span>
            </div>
            <div className="divide-y divide-amber-200/60 text-xs">
              {bill.returns.map((ret: any) => (
                <div key={ret.id} className="pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <span>{ret.reference_code || `RET${String(ret.id).padStart(6, "0")}`}</span>
                      <span className="font-normal text-gray-500 text-[11px]">
                        ({new Date(ret.return_date || ret.created_at).toLocaleDateString("en-IN")})
                      </span>
                    </div>
                    {ret.reason && <p className="text-gray-600 text-[11px] mt-0.5">Reason: {ret.reason}</p>}
                  </div>
                  <div className="text-sm font-black text-emerald-700">
                    +₹{Number(ret.refund_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} Credited
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calculation Summary Footer */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1 sm:max-w-xs">
            <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Payment Information</div>
            <p>
              Please verify all item quantities and pricing upon receipt. Direct ledger or bank settlements will be reflected in your statement.
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-gray-800">
                ₹{Number(bill.subtotal || bill.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {Number(bill.discount_amount) > 0 && (
              <div className="flex items-center justify-between text-gray-600">
                <span>Discount:</span>
                <span className="font-semibold text-emerald-600">
                  -₹{Number(bill.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {Number(bill.tax_amount) > 0 && (
              <div className="flex items-center justify-between text-gray-600">
                <span>Tax (GST):</span>
                <span className="font-semibold text-gray-800">
                  +₹{Number(bill.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm font-black text-gray-900">
              <span>Total Amount:</span>
              <span className="text-emerald-800">
                ₹{Number(bill.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-600 pt-1">
              <span>Paid Amount:</span>
              <span className="font-bold text-emerald-600">
                ₹{Number(bill.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between font-bold pt-1 border-t border-gray-100">
              <span>Balance Due:</span>
              <span className={balanceDue > 0 ? "text-rose-600 font-black" : "text-gray-700"}>
                ₹{Math.max(0, balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Return Request Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-900">Request Item Return</h3>
                <p className="text-xs text-gray-500">Invoice: #{bill.invoice_number || bill.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestReturn} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">Select Items & Quantities to Return:</label>
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {bill.items?.map((it: any) => {
                    const alreadyReturned = Number(it.returned_quantity || 0);
                    const availableToReturn = Math.max(0, Number(it.quantity) - alreadyReturned);
                    const selectedQty = returnItems[it.id] || 0;

                    return (
                      <div key={it.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">{it.product_name}</div>
                          <div className="text-[11px] text-gray-500">
                            Purchased: {it.quantity} {alreadyReturned > 0 && `(Returned: ${alreadyReturned})`} • ₹{Number(it.unit_price).toFixed(2)}/unit
                          </div>
                        </div>

                        {availableToReturn > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-500">Max {availableToReturn}:</span>
                            <input
                              type="number"
                              min="0"
                              max={availableToReturn}
                              value={selectedQty}
                              onChange={(e) => {
                                const val = Math.min(availableToReturn, Math.max(0, parseInt(e.target.value) || 0));
                                setReturnItems((prev) => ({ ...prev, [it.id]: val }));
                              }}
                              className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            Fully Returned
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Reason for Return (Optional):</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Defective item, wrong size, or damaged packaging..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-xs flex justify-between items-center text-gray-700">
                <span className="font-medium">Total items selected:</span>
                <span className="font-black text-emerald-800">
                  {Object.values(returnItems).reduce((sum, q) => sum + (Number(q) || 0), 0)} unit(s)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  disabled={returnSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || Object.values(returnItems).reduce((sum, q) => sum + (Number(q) || 0), 0) === 0}
                  className="px-5 py-2 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {returnSubmitting ? "Submitting..." : "Submit Return Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

