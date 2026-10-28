import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTransfer } from "../../api/inventory";
import ReferenceLink from "../../components/ReferenceLink";

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getTransfer(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setTransfer(res.data.data);
        } else {
          setError("Stock transfer not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load stock transfer details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading stock transfer details...</p>
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Transfer Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No transfer matching reference "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/inventory")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_transit: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const statusBadge = statusColors[transfer.status] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
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
              <h1 className="text-xl font-bold font-mono text-slate-900">{transfer.transfer_no || `TRF-${transfer.id}`}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusBadge}`}>
                {transfer.status?.replace("_", " ") || "completed"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Initiated on {new Date(transfer.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Transfer Note
        </button>
      </div>

      {/* Transfer Route Visual Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Transfer Route</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Source Shop */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">From Shop (Source)</span>
            <p className="font-bold text-slate-800 text-sm">{transfer.fromShop?.name || "Source Store"}</p>
            <p className="text-xs font-mono text-slate-500">{transfer.fromShop?.code}</p>
            {transfer.fromShop?.address && <p className="text-xs text-slate-500 mt-1">{transfer.fromShop.address}</p>}
          </div>

          {/* Directional Indicator */}
          <div className="flex flex-col items-center justify-center text-center py-2">
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-1">
              {transfer.quantity} Unit(s)
            </span>
            <svg className="w-8 h-8 text-blue-600 hidden md:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <svg className="w-6 h-6 text-blue-600 md:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>

          {/* Destination Shop */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">To Shop (Destination)</span>
            <p className="font-bold text-slate-800 text-sm">{transfer.toShop?.name || "Destination Store"}</p>
            <p className="text-xs font-mono text-slate-500">{transfer.toShop?.code}</p>
            {transfer.toShop?.address && <p className="text-xs text-slate-500 mt-1">{transfer.toShop.address}</p>}
          </div>
        </div>
      </div>

      {/* Product Details Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Transferred Product</span>
          {transfer.product && (
            <ReferenceLink type="product" id={transfer.product.id} className="text-xs font-medium">
              View Product Master →
            </ReferenceLink>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              <ReferenceLink type="product" id={transfer.product?.id}>
                {transfer.product?.name || "Product"}
              </ReferenceLink>
            </h4>
            <p className="text-xs text-slate-500 font-mono mt-0.5">SKU: {transfer.product?.sku || "—"}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Quantity</span>
            <span className="text-lg font-bold text-slate-900">{transfer.quantity}</span>
          </div>
        </div>
        {transfer.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Remarks: </span>
            {transfer.notes}
          </div>
        )}
      </div>

      {/* Stock Movement Audit Log */}
      {transfer.transactions && transfer.transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Movement Audit History</span>
            <span className="text-xs text-slate-500">{transfer.transactions.length} transaction(s)</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Tx ID</th>
                <th className="py-2.5 px-4">Shop</th>
                <th className="py-2.5 px-4">Movement Type</th>
                <th className="py-2.5 px-4 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfer.transactions.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-medium">
                    <ReferenceLink type="movement" id={tx.id} refNumber={`MOV-${tx.id}`} />
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{tx.shop?.name || `Shop #${tx.shop_id}`}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                        tx.type === "transfer_in"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className={`py-2.5 px-4 text-right font-bold font-mono ${tx.quantity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {tx.quantity >= 0 ? `+${tx.quantity}` : tx.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
