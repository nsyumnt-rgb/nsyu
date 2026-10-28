import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct } from "../../api/products";
import ReferenceLink from "../../components/ReferenceLink";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getProduct(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setProduct(res.data.data);
        } else {
          setError("Product not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load product details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Product Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No product matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/products")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Products
        </button>
      </div>
    );
  }

  const totalStockAcrossShops = (product.stocks || []).reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
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
              <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
              <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                SKU: {product.sku}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  totalStockAcrossShops > (product.min_stock || 5)
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : totalStockAcrossShops > 0
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {totalStockAcrossShops > (product.min_stock || 5) ? "In Stock" : totalStockAcrossShops > 0 ? "Low Stock" : "Out of Stock"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {product.category?.name || "General"} {product.brand ? `• Brand: ${product.brand}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/inventory")}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
          >
            Adjust Stock
          </button>
          <button
            onClick={() => navigate("/app/products")}
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors"
          >
            Edit Product
          </button>
        </div>
      </div>

      {/* Pricing and Stock Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Selling Price</span>
          <p className="text-2xl font-extrabold text-blue-600">
            ₹{Number(product.selling_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">MRP: ₹{Number(product.mrp || 0).toLocaleString("en-IN")}</span>
        </div>

        {product.purchase_price !== undefined && (
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Purchase Price</span>
            <p className="text-2xl font-extrabold text-slate-800">
              ₹{Number(product.purchase_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium">
              Margin: ₹{(Number(product.selling_price || 0) - Number(product.purchase_price || 0)).toLocaleString("en-IN")}
            </span>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Stock (All Shops)</span>
          <p className={`text-2xl font-extrabold ${totalStockAcrossShops > 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {totalStockAcrossShops} Units
          </p>
          <span className="text-[11px] text-slate-400">Min Alert Level: {product.min_stock || 5}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tax & Supplier</span>
          <p className="text-sm font-semibold text-slate-800">GST: {product.tax_percent || 0}%</p>
          {product.supplier ? (
            <p className="text-xs text-slate-500 mt-1 truncate">
              Supplier:{" "}
              <ReferenceLink type="supplier" id={product.supplier.id}>
                {product.supplier.name}
              </ReferenceLink>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">No supplier mapped</p>
          )}
        </div>
      </div>

      {/* Shop-wise Inventory Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Shop-wise Stock Breakdown</span>
          <span className="text-xs text-slate-500">Inventory across all authorized shops</span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Shop Name</th>
              <th className="py-2.5 px-4">Shop Code</th>
              <th className="py-2.5 px-4 text-right">Available Quantity</th>
              <th className="py-2.5 px-4 text-right">Stock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {product.stocks && product.stocks.length > 0 ? (
              product.stocks.map((st: any) => {
                const qty = Number(st.quantity || 0);
                const isLow = qty <= (st.min_stock || product.min_stock || 5);
                return (
                  <tr key={st.id || st.shop_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">{st.shop?.name || `Shop #${st.shop_id}`}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{st.shop?.code || "—"}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{qty}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          qty === 0
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isLow
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {qty === 0 ? "Out of Stock" : isLow ? "Low Stock" : "Sufficient"}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 italic">No stock records found for this product</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {product.description && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Product Description</h4>
          <p className="text-xs text-slate-700 leading-relaxed">{product.description}</p>
        </div>
      )}
    </div>
  );
}
