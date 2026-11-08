import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPortalBillsApi } from "../../api/portal";
import { getApiBaseUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { BillStatusBadge } from "./PortalHome";

export default function PortalBills() {
  const [bills, setBills] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const accessToken = usePortalStore((s) => s.accessToken);

  useEffect(() => {
    async function loadBills() {
      setLoading(true);
      try {
        const res = await listPortalBillsApi({
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          limit: 10,
        });
        setBills(res?.data || []);
        setTotalPages(res?.pagination?.pages || 1);
      } catch {
        setBills([]);
      } finally {
        setLoading(false);
      }
    }
    loadBills();
  }, [statusFilter, page]);

  const handleDownloadPdf = async (billId: number, invoiceNumber: string) => {
    try {
      const url = `${getApiBaseUrl()}/customer-portal/bills/${billId}/pdf`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Invoice-${invoiceNumber || billId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Error generating invoice PDF. Please try again.");
    }
  };

  const filterTabs = [
    { id: "all", label: "All Invoices" },
    { id: "unpaid", label: "Unpaid" },
    { id: "partially_paid", label: "Partially Paid" },
    { id: "paid", label: "Paid" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Bills & Invoices</h1>
          <p className="text-xs text-gray-500 mt-0.5">Download official tax invoices and track payment balances.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === tab.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading invoices...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <BillsIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No invoices found</h3>
          <p className="text-xs text-gray-500 mt-1">There are no invoices matching the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const balanceDue = Number(bill.total_amount) - Number(bill.paid_amount || 0);

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:border-emerald-200 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-base text-gray-900">
                      {bill.invoice_number || `Invoice #${bill.id}`}
                    </span>
                    <BillStatusBadge status={bill.payment_status} />
                  </div>

                  <div className="text-xs text-gray-500">
                    Dated {new Date(bill.createdAt || bill.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block">Total Amount</span>
                    <span className="font-bold text-sm text-gray-900">
                      ₹{Number(bill.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Paid Amount</span>
                    <span className="font-bold text-sm text-emerald-600">
                      ₹{Number(bill.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Balance Due</span>
                    <span className={`font-bold text-sm ${balanceDue > 0 ? "text-rose-600" : "text-gray-900"}`}>
                      ₹{Math.max(0, balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Payment Mode</span>
                    <span className="font-semibold text-gray-700 capitalize">
                      {bill.payment_method || "Credit / Ledger"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(bill.id, bill.invoice_number)}
                    className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>

                  <Link
                    to={`/portal/bills/${bill.id}`}
                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-xs font-semibold text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

function BillsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

