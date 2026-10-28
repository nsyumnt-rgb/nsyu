import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMovement } from "../../api/inventory";
import ReferenceLink from "../../components/ReferenceLink";

export default function MovementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movement, setMovement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getMovement(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setMovement(res.data.data);
        } else {
          setError("Inventory movement not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load movement details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading movement details...</p>
      </div>
    );
  }

  if (error || !movement) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Movement Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No movement matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/inventory")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  const isInward = movement.quantity > 0;

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
              <h1 className="text-xl font-bold font-mono text-slate-900">MOV-{movement.id}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  isInward
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {movement.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Recorded on {new Date(movement.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* Movement Details Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 space-y-6">
        <div className="text-center py-4 border-b border-slate-100">
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Quantity Impact</p>
          <h2 className={`text-4xl font-extrabold tracking-tight font-mono ${isInward ? "text-emerald-600" : "text-rose-600"}`}>
            {isInward ? `+${movement.quantity}` : movement.quantity} Units
          </h2>
          <p className="text-xs text-slate-500 mt-1 capitalize font-medium">
            Type: <span className="font-semibold text-slate-700">{movement.type?.replace("_", " ")}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Product</span>
            {movement.product ? (
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  <ReferenceLink type="product" id={movement.product.id}>
                    {movement.product.name}
                  </ReferenceLink>
                </p>
                <p className="text-slate-500 font-mono">SKU: {movement.product.sku}</p>
              </div>
            ) : (
              <p className="text-slate-500 italic">Product #{movement.product_id}</p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Shop / Location</span>
            <p className="font-semibold text-slate-800 text-sm">{movement.shop?.name || "Main Store"}</p>
            <p className="font-mono text-slate-400">{movement.shop?.code}</p>
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Source Reference</span>
            {movement.reference_type && movement.reference_id ? (
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  {movement.reference_type === "Sale" ? (
                    <ReferenceLink type="sale" id={movement.reference_id} refNumber={`Sale #${movement.reference_id}`} />
                  ) : movement.reference_type === "Purchase" ? (
                    <ReferenceLink type="purchase" id={movement.reference_id} refNumber={`Purchase #${movement.reference_id}`} />
                  ) : movement.reference_type === "StockTransfer" ? (
                    <ReferenceLink type="transfer" id={movement.reference_id} refNumber={`Transfer #${movement.reference_id}`} />
                  ) : (
                    <span className="font-mono">{movement.reference_type} #{movement.reference_id}</span>
                  )}
                </p>
                <p className="text-slate-400 capitalize">{movement.reference_type} Document</p>
              </div>
            ) : (
              <p className="text-slate-500 italic">Manual Stock Adjustment</p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Balance After Transaction</span>
            <p className="font-mono font-bold text-slate-900 text-sm">
              {movement.remaining_stock !== null && movement.remaining_stock !== undefined ? `${movement.remaining_stock} Units` : "—"}
            </p>
            <p className="text-slate-400">Post-movement balance</p>
          </div>
        </div>

        {movement.notes && (
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
            <span className="font-semibold text-slate-700 block mb-0.5">Remarks / Reason:</span>
            <p className="text-slate-600">{movement.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
