import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface B2BListing {
  id: string;
  name: string;
  sellerShopId: string;
  sellerShopName: string;
  wholesalePrice: number;
  retailPrice: number;
  moq: number;
  availableStock: number;
}

const B2B_CATALOG: B2BListing[] = [
  {
    id: "b1",
    name: "boAt Type-C Braided Cable 1.5m",
    sellerShopId: "s4",
    sellerShopName: "Verma Distributors",
    wholesalePrice: 105,
    retailPrice: 299,
    moq: 50,
    availableStock: 2000,
  },
  {
    id: "b2",
    name: "Ambrane Lightning Cable 1m",
    sellerShopId: "s4",
    sellerShopName: "Verma Distributors",
    wholesalePrice: 82,
    retailPrice: 249,
    moq: 50,
    availableStock: 1500,
  },
  {
    id: "b3",
    name: "Mi 33W SonicCharge Adapter",
    sellerShopId: "s4",
    sellerShopName: "Verma Distributors",
    wholesalePrice: 690,
    retailPrice: 899,
    moq: 20,
    availableStock: 400,
  },
  {
    id: "b4",
    name: "Tempered Glass Screen Guard (Carton 100pcs)",
    sellerShopId: "s4",
    sellerShopName: "Verma Distributors",
    wholesalePrice: 48,
    retailPrice: 149,
    moq: 100,
    availableStock: 5000,
  },
  {
    id: "b5",
    name: "Silicone Back Case for Redmi 13C",
    sellerShopId: "s4",
    sellerShopName: "Verma Distributors",
    wholesalePrice: 68,
    retailPrice: 199,
    moq: 50,
    availableStock: 900,
  },
  {
    id: "b6",
    name: "JBL Go 3 Bluetooth Speaker",
    sellerShopId: "s3",
    sellerShopName: "Gupta Electronics",
    wholesalePrice: 2199,
    retailPrice: 2799,
    moq: 5,
    availableStock: 20,
  },
];

interface DraftLine {
  listing: B2BListing;
  quantity: number;
}

export default function B2BMarketplace() {
  const navigate = useNavigate();
  const activeShop = useAuthStore((s) => s.activeShop);
  const buyerShopName = activeShop?.name || "Sharma Mobile Hub";

  const [quantities, setQuantities] = useState<Record<string, number>>({
    b1: 50,
    b2: 50,
    b3: 20,
    b4: 100,
    b5: 50,
    b6: 5,
  });

  const [draft, setDraft] = useState<DraftLine[]>([
    { listing: B2B_CATALOG[0], quantity: 100 },
    { listing: B2B_CATALOG[3], quantity: 200 },
  ]);

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [terms, setTerms] = useState<"Advance" | "Net 15" | "Net 30">("Net 15");
  const [advancePaid, setAdvancePaid] = useState("5000");

  const handleQtyChange = (id: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, val) }));
  };

  const handleAddToPO = (item: B2BListing) => {
    const qty = quantities[item.id] || item.moq;
    if (qty < item.moq) {
      alert(`Minimum order quantity for this item is ${item.moq}`);
      return;
    }
    setDraft((prev) => {
      const idx = prev.findIndex((l) => l.listing.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity = qty;
        return copy;
      }
      return [...prev, { listing: item, quantity: qty }];
    });
  };

  const handleRemoveDraftLine = (id: string) => {
    setDraft((prev) => prev.filter((l) => l.listing.id !== id));
  };

  const draftTotal = draft.reduce(
    (sum, line) => sum + line.listing.wholesalePrice * line.quantity,
    0
  );

  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Purchase order PO-${Math.floor(3000 + Math.random() * 900)} submitted to Verma Distributors!`);
    setCheckoutModalOpen(false);
    setDraft([]);
    navigate("/app/b2b-po");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            B2B wholesale marketplace
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Verified wholesale catalog from distributors and authorized dealers. You are purchasing as <b>{buyerShopName}</b>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Listings Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {B2B_CATALOG.map((item) => {
            const currentQty = quantities[item.id] || item.moq;
            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-gray-200 hover:border-emerald-300 shadow-2xs transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mb-1">
                    <span>{item.sellerShopName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px]">
                      MOQ: {item.moq} pcs
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-lg font-black text-gray-900">
                      ₹{item.wholesalePrice}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      wholesale (retail: ₹{item.retailPrice})
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Available stock: <b>{item.availableStock.toLocaleString("en-IN")} pcs</b>
                  </div>
                </div>

                {/* Add to Draft Stepper */}
                <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                  <div className="w-24">
                    <input
                      type="number"
                      min={item.moq}
                      step="5"
                      value={currentQty}
                      onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value, 10) || item.moq)}
                      className="w-full h-9 px-2 text-center rounded-xl border border-gray-200 text-xs font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToPO(item)}
                    className="flex-1 h-9 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    + Add to PO
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* PO Draft Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs sticky top-20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-black text-sm text-gray-900">Purchase order draft</h3>
            <span className="text-xs font-semibold text-gray-500">
              {draft.length} line(s)
            </span>
          </div>

          {draft.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              Draft is empty. Add products from the wholesale catalog to build your purchase order.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {draft.map((line) => (
                  <div key={line.listing.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-gray-900 truncate">
                        {line.listing.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {line.quantity} pcs @ ₹{line.listing.wholesalePrice}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xs text-gray-900">
                        ₹{(line.quantity * line.listing.wholesalePrice).toLocaleString("en-IN")}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftLine(line.listing.id)}
                        className="text-[10px] text-rose-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between font-black text-sm text-gray-900">
                <span>PO Total:</span>
                <span className="text-emerald-800 text-base">
                  ₹{draftTotal.toLocaleString("en-IN")}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Review & submit PO →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review & Submit Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPO}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Submit purchase order</h3>
              <p className="text-xs text-gray-500">
                Total ₹{draftTotal.toLocaleString("en-IN")} · Sent to Verma Distributors for approval
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Payment terms</label>
              <select
                value={terms}
                onChange={(e) => setTerms(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                <option value="Net 15">Credit · Net 15 (needs seller approval)</option>
                <option value="Net 30">Credit · Net 30 (needs seller approval)</option>
                <option value="Advance">Full advance payment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Advance paid now (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none"
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-[11.5px] text-emerald-900 border border-emerald-200">
              Sellers approve each PO before stock dispatch. Credit terms are recorded in your wholesale payables ledger.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B]"
              >
                Submit PO
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
