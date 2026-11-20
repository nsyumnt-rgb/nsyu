import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface LowStockItem {
  id: string;
  name: string;
  brand: string;
  sku: string;
  inStock: number;
  alertLevel: number;
  unit: string;
  reorderSupplier: string;
}

const INITIAL_LOW_ITEMS: LowStockItem[] = [
  { id: "p1", name: "Samsung Galaxy M15 5G", brand: "Samsung", sku: "NSY-1-0002", inStock: 3, alertLevel: 5, unit: "pcs", reorderSupplier: "Sharma Hub Central" },
  { id: "p2", name: "Mi 33W SonicCharge Adapter", brand: "Xiaomi", sku: "NSY-1-0005", inStock: 4, alertLevel: 10, unit: "pcs", reorderSupplier: "Verma Distributors" },
  { id: "p3", name: "Ambrane Lightning Cable 1m", brand: "Ambrane", sku: "NSY-1-0007", inStock: 0, alertLevel: 20, unit: "pcs", reorderSupplier: "Ambrane India Ltd" },
  { id: "p4", name: "Havells Table Fan 400mm", brand: "Havells", sku: "NSY-2-0021", inStock: 0, alertLevel: 4, unit: "pcs", reorderSupplier: "Havells India Ltd" },
  { id: "p5", name: "Whirlpool 190L Refrigerator", brand: "Whirlpool", sku: "NSY-2-0017", inStock: 2, alertLevel: 3, unit: "pcs", reorderSupplier: "Whirlpool India" },
];

export default function LowStock() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const [items, setItems] = useState<LowStockItem[]>(INITIAL_LOW_ITEMS);
  const [adjustItem, setAdjustItem] = useState<LowStockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty)) return;

    setItems((prev) =>
      prev.map((i) => (i.id === adjustItem.id ? { ...i, inStock: i.inStock + qty } : i))
    );

    setAdjustItem(null);
    setAdjustQty("");
    setAdjustReason("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Low stock alerts
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Items at or below minimum threshold for {activeShop?.name || "Sharma Mobile Hub"}. Restock these first to prevent lost sales.
          </p>
        </div>
        <Link
          to="/app/b2b-market"
          className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>🏭</span>
          <span>Order B2B Wholesale</span>
        </Link>
      </div>

      {/* Low Stock Items Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU / Brand</th>
                <th className="py-3 px-4 text-right">In Stock</th>
                <th className="py-3 px-4 text-right">Alert Level</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((i) => {
                const isOut = i.inStock <= 0;
                return (
                  <tr key={i.id} className="hover:bg-gray-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <span>{i.name}</span>
                      {isOut && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                          Out of stock
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <span>{i.sku}</span> · <span className="text-gray-400">{i.brand}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`font-black text-sm ${isOut ? "text-red-600" : "text-amber-600"}`}>
                        {i.inStock} {i.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-semibold">
                      {i.alertLevel} {i.unit}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-medium">{i.reorderSupplier}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setAdjustItem(i)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-[11px] font-bold transition shadow-2xs"
                      >
                        Adjust stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustStock}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Adjust stock</h3>
              <p className="text-xs text-gray-500">
                {adjustItem.name} · Current: {adjustItem.inStock} {adjustItem.unit}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Add stock quantity (or negative to deduct)
              </label>
              <input
                type="number"
                step="1"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 10"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-emerald-600"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reason / Reference</label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Distributor stock delivery"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B]"
              >
                Save adjustment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
