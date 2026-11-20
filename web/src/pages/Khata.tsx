import { useState } from "react";
import { useAuthStore } from "../store/authStore";

interface KhataCustomer {
  id: string;
  name: string;
  phone: string;
  udhaar: number;
  limit: number;
  history: { date: string; type: string; ref: string; note: string; dr: number; cr: number }[];
}

const INITIAL_KHATA: KhataCustomer[] = [
  {
    id: "c1",
    name: "Amit Kumar",
    phone: "98765 43210",
    udhaar: 3000,
    limit: 10000,
    history: [
      { date: "2026-11-01", type: "Bill", ref: "INV-1001", note: "Order O-2041 · Pay Later", dr: 5000, cr: 0 },
      { date: "2026-11-01", type: "Payment", ref: "INV-1001", note: "Paid at checkout · UPI", dr: 0, cr: 1000 },
      { date: "2026-11-15", type: "Payment", ref: "INV-1001", note: "Cash received at shop", dr: 0, cr: 1000 },
    ],
  },
  {
    id: "c2",
    name: "Priya Nair",
    phone: "98765 11111",
    udhaar: 8999,
    limit: 5000,
    history: [
      { date: "2026-10-25", type: "Opening", ref: "—", note: "Balance carried forward", dr: 1500, cr: 0 },
      { date: "2026-11-10", type: "Bill", ref: "INV-1002", note: "Counter bill · Pay Later", dr: 3200, cr: 0 },
      { date: "2026-11-10", type: "Payment", ref: "INV-1002", note: "Cash at counter", dr: 0, cr: 1000 },
      { date: "2026-11-19", type: "Bill", ref: "INV-1007", note: "Order O-2058 · approved exception", dr: 5299, cr: 0 },
    ],
  },
  {
    id: "c3",
    name: "Rohit Singh",
    phone: "98765 22222",
    udhaar: 2450,
    limit: 5000,
    history: [
      { date: "2026-11-12", type: "Bill", ref: "INV-1008", note: "Counter sale · 2 cables + charger", dr: 2450, cr: 0 },
    ],
  },
  {
    id: "c4",
    name: "Sunita Devi",
    phone: "98765 33333",
    udhaar: 4050,
    limit: 10000,
    history: [
      { date: "2026-11-05", type: "Bill", ref: "INV-1009", note: "Mixer grinder accessories", dr: 4050, cr: 0 },
    ],
  },
];

export default function Khata() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const shopName = activeShop?.name || "Sharma Mobile Hub";

  const [khataList, setKhataList] = useState<KhataCustomer[]>(INITIAL_KHATA);
  const [searchQ, setSearchQ] = useState("");
  const [statementCustomer, setStatementCustomer] = useState<KhataCustomer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<KhataCustomer | null>(null);
  const [paymentAmt, setPaymentAmt] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [giveModalOpen, setGiveModalOpen] = useState(false);
  const [giveCustId, setGiveCustId] = useState("");
  const [giveAmt, setGiveAmt] = useState("");
  const [giveNote, setGiveNote] = useState("");

  const filtered = khataList.filter((k) => {
    return (
      k.udhaar > 0 &&
      (!searchQ || (k.name + " " + k.phone).toLowerCase().includes(searchQ.toLowerCase()))
    );
  });

  const totalUdhaar = filtered.reduce((sum, k) => sum + k.udhaar, 0);
  const overLimitCount = filtered.filter((k) => k.udhaar > k.limit).length;

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amt = parseFloat(paymentAmt);
    if (!amt || amt <= 0) return;

    setKhataList((prev) =>
      prev.map((k) => {
        if (k.id !== paymentCustomer.id) return k;
        const nextUdhaar = Math.max(0, k.udhaar - amt);
        return {
          ...k,
          udhaar: nextUdhaar,
          history: [
            ...k.history,
            {
              date: new Date().toISOString().slice(0, 10),
              type: "Payment",
              ref: "PAY-" + Math.floor(1000 + Math.random() * 9000),
              note: `Khata payment received · ${paymentMode}`,
              dr: 0,
              cr: amt,
            },
          ],
        };
      })
    );

    setPaymentCustomer(null);
    setPaymentAmt("");
  };

  const handleGiveUdhaar = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(giveAmt);
    if (!amt || amt <= 0 || !giveCustId) return;

    setKhataList((prev) =>
      prev.map((k) => {
        if (k.id !== giveCustId) return k;
        return {
          ...k,
          udhaar: k.udhaar + amt,
          history: [
            ...k.history,
            {
              date: new Date().toISOString().slice(0, 10),
              type: "Adjustment",
              ref: "UDH-" + Math.floor(1000 + Math.random() * 9000),
              note: giveNote.trim() || "Udhaar diya (without bill)",
              dr: amt,
              cr: 0,
            },
          ],
        };
      })
    );

    setGiveModalOpen(false);
    setGiveAmt("");
    setGiveNote("");
  };

  const handleExportCSV = () => {
    const rows = [
      ["Customer", "Phone", "Udhaar", "Credit Limit"],
      ...khataList.map((c) => [c.name, c.phone, c.udhaar.toString(), c.limit.toString()]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `khata-${shopName.replace(/\s+/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Udhaar / Khata
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Customers who owe you money, biggest first. Send WhatsApp reminders or record payments in one tap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGiveModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span>
            <span>Udhaar diya</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Total udhaar outstanding</div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            ₹{totalUdhaar.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Receivable balance</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Customers with udhaar</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{filtered.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Active khata accounts</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Over credit limit</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{overLimitCount}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Needs owner decision</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-xs">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search customer name or phone..."
          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-white text-xs outline-none focus:border-[#047857]"
        />
      </div>

      {/* Khata Customers Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Udhaar baaki</th>
                <th className="py-3 px-4 text-right">Credit limit</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((k) => {
                const cleanPhone = k.phone.replace(/\D/g, "").slice(-10);
                const isOverLimit = k.udhaar > k.limit;
                const waMessage = `Namaste ${k.name}, ${shopName} ke khate mein ₹${k.udhaar.toLocaleString("en-IN")} baaki hai. Kripya payment kar dein. Dhanyavaad!`;

                return (
                  <tr key={k.id} className="hover:bg-gray-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <span>{k.name}</span>
                      {isOverLimit && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                          Over limit
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-medium">{k.phone}</td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-700 text-sm">
                      ₹{k.udhaar.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-gray-500">
                      ₹{k.limit.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentCustomer(k);
                            setPaymentAmt(k.udhaar.toString());
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#064E3B] text-white text-[11px] font-bold shadow-xs transition"
                        >
                          Record payment
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatementCustomer(k)}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-bold transition"
                        >
                          Statement
                        </button>
                        {cleanPhone.length === 10 && (
                          <a
                            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition"
                          >
                            WhatsApp reminder 💬
                          </a>
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

      {/* Record Payment Modal */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Record payment</h3>
              <p className="text-xs text-gray-500">
                {paymentCustomer.name} · Current udhaar: ₹{paymentCustomer.udhaar.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Amount received (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={paymentAmt}
                onChange={(e) => setPaymentAmt(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-emerald-600"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Payment mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank transfer">Bank transfer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentCustomer(null)}
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

      {/* Udhaar Diya Modal */}
      {giveModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleGiveUdhaar}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Udhaar diya</h3>
              <p className="text-xs text-gray-500">Record money or items given on credit without a POS bill</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Customer</label>
              <select
                value={giveCustId}
                onChange={(e) => setGiveCustId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-semibold"
                required
              >
                <option value="">Select customer...</option>
                {khataList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.phone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={giveAmt}
                onChange={(e) => setGiveAmt(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Note (optional)</label>
              <input
                type="text"
                value={giveNote}
                onChange={(e) => setGiveNote(e.target.value)}
                placeholder="e.g. Charger + screen guard"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGiveModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B]"
              >
                Save to khata
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Statement Modal */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Khata statement · {statementCustomer.name}
                </h3>
                <p className="text-xs text-gray-500">Phone: {statementCustomer.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setStatementCustomer(null)}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl text-center text-xs">
              <div>
                <div className="text-[10.5px] text-gray-500">Total baaki</div>
                <div className="font-extrabold text-rose-700 text-sm mt-0.5">
                  ₹{statementCustomer.udhaar.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-gray-500">Credit limit</div>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  ₹{statementCustomer.limit.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-gray-500">Entries</div>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  {statementCustomer.history.length}
                </div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 text-xs">
              {statementCustomer.history.map((h, i) => (
                <div key={i} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{h.type} {h.ref !== "—" ? `(${h.ref})` : ""}</div>
                    <div className="text-[10px] text-gray-500">{h.date} · {h.note}</div>
                  </div>
                  <div className={`font-black ${h.dr ? "text-rose-600" : "text-emerald-700"}`}>
                    {h.dr ? `+₹${h.dr.toLocaleString("en-IN")}` : `-₹${h.cr.toLocaleString("en-IN")}`}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStatementCustomer(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
              <a
                href={`https://wa.me/91${statementCustomer.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                  `${shopName} khata - ${statementCustomer.name}\nTotal baaki: ₹${statementCustomer.udhaar}\nLimit: ₹${statementCustomer.limit}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B] flex items-center gap-1.5"
              >
                <span>Send on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
