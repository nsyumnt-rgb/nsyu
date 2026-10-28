import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPayments, cancelPayment, downloadReceiptPdf, listSupplierPayments } from "../api/payments";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";

function PaymentsInner() {
  const { can, isOwner } = usePermission();
  const shopId = useAuthStore((s) => s.shopId);

  const [activeTab, setActiveTab] = useState<"customer" | "supplier">("customer");
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  function loadData() {
    setLoading(true);
    const params = {
      allShops: isOwner && allShopsToggle ? true : undefined,
    };

    if (activeTab === "customer") {
      listPayments(params)
        .then((res) => setCustomerPayments(res.data.data ?? []))
        .catch((err) => setError(apiErrorMessage(err, "Could not load customer payments")))
        .finally(() => setLoading(false));
    } else {
      listSupplierPayments(params)
        .then((res) => setSupplierPayments(res.data.data ?? []))
        .catch((err) => setError(apiErrorMessage(err, "Could not load supplier payments")))
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    loadData();
  }, [shopId, activeTab, allShopsToggle]);

  async function handleDownloadPdf(id: number) {
    try {
      const res = await downloadReceiptPdf(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt_${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(apiErrorMessage(err, "Could not download receipt"));
    }
  }

  async function handleVoidPayment(id: number) {
    const reason = prompt("Enter void reason:");
    if (!reason) return;
    try {
      await cancelPayment(id, reason);
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not void payment"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Payments & Transactions</h1>
          <p className="text-sm text-muted mt-1">
            Cash, UPI, Card, and Bank settlement logs for customers and suppliers.
          </p>
        </div>

        {isOwner && (
          <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={allShopsToggle}
              onChange={(e) => setAllShopsToggle(e.target.checked)}
              className="rounded border-border text-accent-600 focus:ring-accent-500"
            />
            Consolidated (All Shops)
          </label>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("customer")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "customer"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Customer Receipts ({customerPayments.length})
        </button>
        <button
          onClick={() => setActiveTab("supplier")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "supplier"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Supplier Payments ({supplierPayments.length})
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt / ID</th>
              <th>{activeTab === "customer" ? "Customer" : "Supplier"}</th>
              <th>Reference</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  Loading payments…
                </td>
              </tr>
            ) : activeTab === "customer" ? (
              customerPayments.length === 0 ? (
                <tr>
                  <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                    No customer receipts found.
                  </td>
                </tr>
              ) : (
                customerPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs text-muted">
                      {new Date(p.payment_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="font-mono text-xs font-medium">
                      <ReferenceLink type="payment" id={p.id} refNumber={`PAY-${p.id}`} />
                    </td>
                    <td className="font-medium text-ink-900">
                      {p.customer ? (
                        <ReferenceLink type="customer" id={p.customer.id}>
                          {p.customer.name}
                        </ReferenceLink>
                      ) : (
                        <span className="text-muted">Customer</span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-muted">
                      {p.sale?.invoice_number ? (
                        <ReferenceLink type="sale" id={p.sale.id} refNumber={p.sale.invoice_number} />
                      ) : (
                        p.type
                      )}
                    </td>
                    {allShopsToggle && (
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                          {p.shop?.name || `Shop #${p.shop_id}`}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="uppercase text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-canvas border">
                        {p.method}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-accent-700">₹{Number(p.amount).toFixed(2)}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.status === "cancelled" ? "bg-danger/10 text-danger" : "bg-accent-100 text-accent-700"
                        }`}
                      >
                        {p.status || "active"}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      <Link
                        to={`/app/payments/${p.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDownloadPdf(p.id)}
                        className="text-xs text-accent-600 hover:text-accent-700 font-medium underline"
                      >
                        Receipt PDF
                      </button>
                      {p.status !== "cancelled" && can("payments", "delete") && (
                        <button
                          onClick={() => handleVoidPayment(p.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )
            ) : supplierPayments.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  No supplier payments found.
                </td>
              </tr>
            ) : (
              supplierPayments.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-muted">
                    {new Date(p.payment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="font-mono text-xs">#{p.id}</td>
                  <td className="font-medium text-ink-900">
                    {p.supplier ? (
                      <ReferenceLink type="supplier" id={p.supplier.id}>
                        {p.supplier.name}
                      </ReferenceLink>
                    ) : (
                      <span className="text-muted">Supplier</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {p.purchase_id ? (
                      <ReferenceLink type="purchase" id={p.purchase_id} refNumber={`Purchase #${p.purchase_id}`} />
                    ) : (
                      p.type
                    )}
                  </td>
                  {allShopsToggle && (
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                        {p.shop?.name || `Shop #${p.shop_id}`}
                      </span>
                    </td>
                  )}
                  <td>
                    <span className="uppercase text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-canvas border">
                      {p.method}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-danger">₹{Number(p.amount).toFixed(2)}</td>
                  <td>
                    <span className="badge bg-accent-100 text-accent-700">paid</span>
                  </td>
                  <td className="text-right text-xs text-muted">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Payments() {
  return (
    <RequireModule module="payments">
      <PaymentsInner />
    </RequireModule>
  );
}
