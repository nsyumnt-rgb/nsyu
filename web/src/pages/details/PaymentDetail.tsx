import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPayment, downloadReceiptPdf, cancelPayment } from "../../api/payments";
import ReferenceLink from "../../components/ReferenceLink";

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getPayment(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setPayment(res.data.data);
        } else {
          setError("Payment receipt not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load payment details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPdf() {
    if (!payment) return;
    setDownloading(true);
    try {
      const res = await downloadReceiptPdf(payment.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt-PAY-${payment.id}.pdf`;
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

  async function handleCancel() {
    if (!payment) return;
    if (!confirm("Are you sure you want to cancel this payment? This will restore the customer's balance.")) return;
    setCancelling(true);
    try {
      await cancelPayment(payment.id, "Cancelled by user");
      const res = await getPayment(payment.id);
      setPayment(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel payment");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading payment receipt...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Receipt Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No payment matching reference "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/payments")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  const isCancelled = payment.status === "cancelled";

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
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
              <h1 className="text-xl font-bold font-mono text-slate-900">PAY-{payment.id}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  isCancelled
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {payment.status || "completed"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Received on {new Date(payment.payment_date || payment.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCancelled && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Payment"}
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
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? "Downloading..." : "Download Receipt"}
          </button>
        </div>
      </div>

      {/* Hero Payment Receipt Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 space-y-6">
        <div className="text-center py-4 border-b border-slate-100">
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Amount Received</p>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            ₹{Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-1 capitalize font-medium">
            Paid via <span className="font-semibold text-slate-700">{payment.method}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Customer</span>
            {payment.customer ? (
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  <ReferenceLink type="customer" id={payment.customer.id}>
                    {payment.customer.name}
                  </ReferenceLink>
                </p>
                {payment.customer.phone && <p className="text-slate-500">{payment.customer.phone}</p>}
              </div>
            ) : (
              <p className="text-slate-500 italic">Walk-in Customer</p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Linked Sales Invoice</span>
            {payment.sale ? (
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  <ReferenceLink type="sale" id={payment.sale.id} refNumber={payment.sale.invoice_number} />
                </p>
                <p className="text-slate-500">Invoice Reference</p>
              </div>
            ) : (
              <p className="text-slate-500 italic">Direct Account Credit</p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Shop / Branch</span>
            <p className="font-semibold text-slate-800 text-sm">{payment.shop?.name || "Main Store"}</p>
            <p className="font-mono text-slate-400">{payment.shop?.code}</p>
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Transaction Reference</span>
            <p className="font-mono text-slate-800 text-sm">{payment.transaction_id || "—"}</p>
            <p className="text-slate-400 capitalize">{payment.type?.replace("_", " ") || "Payment"}</p>
          </div>
        </div>

        {payment.notes && (
          <div className="p-3.5 bg-amber-50/50 rounded-lg border border-amber-100 text-xs">
            <span className="font-semibold text-amber-900 block mb-0.5">Notes:</span>
            <p className="text-amber-800">{payment.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
