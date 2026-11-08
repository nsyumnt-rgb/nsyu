import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPortalBillApi } from "../../api/portal";
import { getApiBaseUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { BillStatusBadge } from "./PortalHome";

export default function PortalBillDetail() {
  const { id } = useParams<{ id: string }>();
  const accessToken = usePortalStore((s) => s.accessToken);

  const [bill, setBill] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    fetchBill();
  }, [id]);

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
      <div className="flex items-center justify-between">
        <Link
          to="/portal/bills"
          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
        >
          <span>&larr; Back to Invoices</span>
        </Link>

        <div className="flex items-center gap-2">
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
              <span className="text-lg font-black text-gray-900">{bill.invoice_number || `INV-${bill.id}`}</span>
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

        {/* Invoice Items Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#047857] text-white uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3">Item Description</th>
                <th className="p-3 text-center">HSN</th>
                <th className="p-3 text-center">Qty</th>
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

