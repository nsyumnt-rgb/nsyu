import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface PurchaseOrder {
  id: string;
  date: string;
  buyer: string;
  seller: string;
  items: string;
  total: number;
  paid: number;
  terms: string;
  status: "Pending Approval" | "Approved" | "Dispatched" | "Received" | "Rejected";
}

const INITIAL_POS: PurchaseOrder[] = [
  {
    id: "PO-3001",
    date: "2026-11-08",
    buyer: "Sharma Mobile Hub",
    seller: "Verma Distributors",
    items: "100× boAt Type-C Cable, 200× Screen Guards",
    total: 18100,
    paid: 5000,
    terms: "Net 15",
    status: "Received",
  },
  {
    id: "PO-3002",
    date: "2026-11-19",
    buyer: "Sharma Mobile Hub",
    seller: "Verma Distributors",
    items: "5× Redmi 13C 5G",
    total: 48250,
    paid: 0,
    terms: "Net 30",
    status: "Pending Approval",
  },
  {
    id: "PO-3003",
    date: "2026-11-14",
    buyer: "Gupta Electronics",
    seller: "Verma Distributors",
    items: "20× Mi 33W Adapters",
    total: 13800,
    paid: 13800,
    terms: "Advance",
    status: "Dispatched",
  },
];

export default function B2BPurchaseOrders() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const myShopName = activeShop?.name || "Sharma Mobile Hub";

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [orders, setOrders] = useState<PurchaseOrder[]>(INITIAL_POS);
  const [payModalPO, setPayModalPO] = useState<PurchaseOrder | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");

  const filtered = orders.filter((p) =>
    tab === "buy" ? p.buyer === myShopName : p.seller === myShopName || p.seller.includes("Verma")
  );

  const handleApprove = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Approved" } : o))
    );
    alert(`Purchase order ${id} approved! B2B receivable posted.`);
  };

  const handleReject = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Rejected" } : o))
    );
    alert(`Purchase order ${id} declined.`);
  };

  const handleDispatch = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Dispatched" } : o))
    );
    alert(`Order ${id} marked dispatched. Seller stock reduced.`);
  };

  const handleReceive = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Received" } : o))
    );
    alert(`Goods received on ${id}! Inventory added to your shop catalog.`);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalPO) return;
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === payModalPO.id ? { ...o, paid: Math.min(o.total, o.paid + amt) } : o
      )
    );

    setPayModalPO(null);
    setPayAmt("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Purchase orders
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Shop-to-shop wholesale orders with supplier approval and ledger reconciliation.
          </p>
        </div>
        <Link
          to="/app/b2b-market"
          className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>+</span>
          <span>New purchase order</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("buy")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            tab === "buy"
              ? "bg-[#047857] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          My purchases ({orders.filter((o) => o.buyer === myShopName).length})
        </button>
        <button
          type="button"
          onClick={() => setTab("sell")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            tab === "sell"
              ? "bg-[#047857] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Incoming orders ({orders.filter((o) => o.seller.includes("Verma") || o.seller === myShopName).length})
        </button>
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">{tab === "buy" ? "Seller (Supplier)" : "Buyer (Retailer)"}</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-4 text-right">Paid (₹)</th>
                <th className="py-3 px-4 text-right">Due (₹)</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((po) => {
                const due = Math.max(0, po.total - po.paid);
                return (
                  <tr key={po.id} className="hover:bg-gray-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{po.id}</td>
                    <td className="py-3.5 px-4 text-gray-500 font-medium">{po.date}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">
                      {tab === "buy" ? po.seller : po.buyer}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate">{po.items}</td>
                    <td className="py-3.5 px-4 text-right font-black text-gray-900">
                      ₹{po.total.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-800">
                      ₹{po.paid.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                      ₹{due.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10.5px] font-semibold">
                        {po.terms}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          po.status === "Received"
                            ? "bg-emerald-100 text-emerald-800"
                            : po.status === "Approved"
                            ? "bg-blue-100 text-blue-800"
                            : po.status === "Dispatched"
                            ? "bg-indigo-100 text-indigo-800"
                            : po.status === "Rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {tab === "sell" && po.status === "Pending Approval" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(po.id)}
                              className="px-2 py-1 rounded-md bg-[#047857] text-white text-[10.5px] font-bold"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(po.id)}
                              className="px-2 py-1 rounded-md bg-red-50 text-red-700 text-[10.5px] font-bold border border-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {tab === "sell" && po.status === "Approved" && (
                          <button
                            type="button"
                            onClick={() => handleDispatch(po.id)}
                            className="px-2.5 py-1 rounded-md bg-[#047857] text-white text-[10.5px] font-bold"
                          >
                            Dispatch 🚚
                          </button>
                        )}
                        {tab === "buy" && po.status === "Dispatched" && (
                          <button
                            type="button"
                            onClick={() => handleReceive(po.id)}
                            className="px-2.5 py-1 rounded-md bg-blue-700 text-white text-[10.5px] font-bold"
                          >
                            Receive goods 📦
                          </button>
                        )}
                        {tab === "buy" && due > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayModalPO(po);
                              setPayAmt(due.toString());
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold"
                          >
                            Pay supplier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Supplier Modal */}
      {payModalPO && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handlePaySubmit}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Record supplier payment</h3>
              <p className="text-xs text-gray-500">
                {payModalPO.id} · Seller: {payModalPO.seller}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Amount to pay (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Payment method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                <option value="UPI">UPI</option>
                <option value="Bank transfer">NEFT / RTGS</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayModalPO(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B]"
              >
                Save payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
