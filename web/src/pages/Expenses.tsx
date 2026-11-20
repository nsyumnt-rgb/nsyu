import { useState } from "react";
import { useAuthStore } from "../store/authStore";

interface ExpenseItem {
  id: string;
  date: string;
  category: "Rent" | "Electricity" | "Transport" | "Packing" | "Tea / food" | "Other";
  amount: number;
  note: string;
}

const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: "e1", date: "2026-11-20", category: "Tea / food", amount: 150, note: "Staff evening tea & snacks" },
  { id: "e2", date: "2026-11-19", category: "Packing", amount: 450, note: "Bubble wrap & courier boxes" },
  { id: "e3", date: "2026-11-15", category: "Transport", amount: 800, note: "Stock pickup from wholesale distributor" },
  { id: "e4", date: "2026-11-01", category: "Rent", amount: 18000, note: "Monthly shop lease Mithepur market" },
  { id: "e5", date: "2026-11-05", category: "Electricity", amount: 3200, note: "BSES Yamuna commercial bill" },
];

export default function Expenses() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseItem["category"]>("Other");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const receivedToday = 4970;
  const expensesToday = expenses
    .filter((e) => e.date === todayStr)
    .reduce((s, e) => s + e.amount, 0);
  const netToday = receivedToday - expensesToday;

  const expenses30Days = expenses.reduce((s, e) => s + e.amount, 0);
  const received30Days = 84500;
  const net30Days = received30Days - expenses30Days;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    setExpenses([
      {
        id: "e-" + Date.now(),
        date: todayStr,
        category,
        amount: amt,
        note: note.trim() || "—",
      },
      ...expenses,
    ]);

    setModalOpen(false);
    setAmount("");
    setNote("");
  };

  const handleDelete = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Expenses & cash book
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Daily money in and out for {activeShop?.name || "Sharma Mobile Hub"}: rent, tea, transport, electricity, packing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>+</span>
          <span>Add expense</span>
        </button>
      </div>

      {/* Metric Cards - Today & 30 Days */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Received today</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">
            ₹{receivedToday.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Customer payments & POS cash</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Expenses today</div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            ₹{expensesToday.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Paid out from drawer</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Net cash today</div>
          <div className={`text-2xl font-black mt-1 ${netToday >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            ₹{netToday.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {netToday >= 0 ? "In profit today" : "Spent more than received"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Received (30 days)</div>
          <div className="text-xl font-extrabold text-gray-900 mt-1">
            ₹{received30Days.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Expenses (30 days)</div>
          <div className="text-xl font-extrabold text-gray-900 mt-1">
            ₹{expenses30Days.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200 shadow-2xs">
          <div className="text-xs font-semibold text-gray-500">Net profit (30 days)</div>
          <div className="text-xl font-extrabold text-emerald-800 mt-1">
            ₹{net30Days.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900">Recorded expenses ({expenses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Note</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/60 transition">
                  <td className="py-3.5 px-4 text-gray-600 font-medium">{e.date}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-semibold text-[10.5px]">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-gray-800">{e.note}</td>
                  <td className="py-3.5 px-4 text-right font-black text-rose-700">
                    -₹{e.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      className="px-2 py-1 rounded-md text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddExpense}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-gray-900">Add shop expense</h3>
              <p className="text-xs text-gray-500">Record a payment made from the shop cash box</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Expense category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                <option value="Rent">Rent</option>
                <option value="Electricity">Electricity</option>
                <option value="Transport">Transport</option>
                <option value="Packing">Packing</option>
                <option value="Tea / food">Tea / food</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 250"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-emerald-600"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Note / Description</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Delivery rickshaw charges"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold shadow-xs hover:bg-[#064E3B]"
              >
                Save expense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
