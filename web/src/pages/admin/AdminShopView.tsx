import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchAdminShops,
  fetchAdminShopSupportData,
  type AdminShopItem,
  type AdminShopSupportData,
} from "../../api/admin";

export default function AdminShopView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shopIdParam = searchParams.get("shopId");

  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(
    shopIdParam ? Number(shopIdParam) : null
  );

  const [supportData, setSupportData] = useState<AdminShopSupportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: bills | orders | inventory | customers
  const [activeTab, setActiveTab] = useState<"bills" | "orders" | "inventory" | "customers">("bills");

  useEffect(() => {
    fetchAdminShops()
      .then((res) => {
        const list = res.data?.data || [];
        setShops(list);
        if (!selectedShopId && list.length > 0) {
          setSelectedShopId(list[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadShopData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminShopSupportData(id);
      if (res.data?.data) {
        setSupportData(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load shop support data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedShopId) {
      setSearchParams({ shopId: String(selectedShopId) });
      loadShopData(selectedShopId);
    }
  }, [selectedShopId]);

  return (
    <div className="space-y-6">
      {/* Read-Only Governance Banner */}
      <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start space-x-3 text-amber-200">
        <div className="w-5 h-5 mt-0.5 text-amber-400 shrink-0">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">
            Support Viewer Mode — Read-Only Access
          </h4>
          <p className="text-xs text-amber-200/90 mt-0.5">
            Super Admin has strictly read-only inspection access to shop operational data. Creating, editing, or cancelling bills, orders, inventory stock, or customer payments is restricted to preserve business audit integrity.
          </p>
        </div>
      </div>

      {/* Header & Shop Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Shop Support Viewer</h1>
          <p className="text-sm text-slate-400">Inspect business records for customer support and system diagnosis</p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400">Target Shop:</span>
          <select
            value={selectedShopId || ""}
            onChange={(e) => setSelectedShopId(Number(e.target.value))}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}) - {s.status}
              </option>
            ))}
          </select>
          {selectedShopId && (
            <button
              onClick={() => loadShopData(selectedShopId)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              title="Refresh shop data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-200 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading shop data...
        </div>
      ) : supportData ? (
        <div className="space-y-6">
          {/* Shop Profile & Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Total Bills</span>
              <span className="text-2xl font-bold text-white">{supportData.stats.billsCount}</span>
            </div>
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Total Orders</span>
              <span className="text-2xl font-bold text-white">{supportData.stats.ordersCount}</span>
            </div>
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Stock Lines</span>
              <span className="text-2xl font-bold text-white">{supportData.stats.productsCount}</span>
            </div>
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Customers</span>
              <span className="text-2xl font-bold text-white">{supportData.stats.customersCount}</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-xs font-semibold">
            {[
              { key: "bills", label: `Bills (${supportData.recentBills.length})` },
              { key: "orders", label: `Orders (${supportData.recentOrders.length})` },
              { key: "inventory", label: `Inventory Stock (${supportData.inventorySummary.length})` },
              { key: "customers", label: `Customers (${supportData.customersList.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2.5 px-4 border-b-2 transition ${
                  activeTab === tab.key
                    ? "border-purple-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: BILLS */}
          {activeTab === "bills" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Due</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {supportData.recentBills.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No bills recorded for this shop.
                        </td>
                      </tr>
                    ) : (
                      supportData.recentBills.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-mono font-medium text-white">{b.invoice_number}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {b.invoice_date ? new Date(b.invoice_date).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">₹{Number(b.total_amount).toFixed(2)}</td>
                          <td className="py-3 px-4 text-emerald-400">₹{Number(b.paid_amount || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-amber-400">₹{Number(b.due_amount || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 capitalize text-slate-400">{b.payment_method}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                b.status === "paid"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : b.status === "cancelled"
                                  ? "bg-rose-950 text-rose-300 border border-rose-800"
                                  : "bg-amber-950 text-amber-300 border border-amber-800"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === "orders" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Billed Bill ID</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {supportData.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No orders recorded for this shop.
                        </td>
                      </tr>
                    ) : (
                      supportData.recentOrders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-mono font-medium text-white">{o.order_number}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {o.order_date ? new Date(o.order_date).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">₹{Number(o.total_amount).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {o.billed_bill_id ? `#Bill ${o.billed_bill_id}` : "-"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === "inventory" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {supportData.inventorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No stock records found.
                        </td>
                      </tr>
                    ) : (
                      supportData.inventorySummary.map((st: any) => (
                        <tr key={st.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-medium text-white">{st.product?.name || `Product #${st.product_id}`}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{st.product?.sku || "-"}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold ${
                                Number(st.current_stock) < 0
                                  ? "text-rose-400 font-mono"
                                  : Number(st.current_stock) === 0
                                  ? "text-slate-500"
                                  : "text-emerald-400"
                              }`}
                            >
                              {st.current_stock}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">₹{Number(st.product?.selling_price || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CUSTOMERS */}
          {activeTab === "customers" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {supportData.customersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No customer records found.
                        </td>
                      </tr>
                    ) : (
                      supportData.customersList.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{c.phone || "-"}</td>
                          <td className="py-3 px-4 text-slate-400">{c.email || "-"}</td>
                          <td className="py-3 px-4 font-semibold text-amber-400">
                            ₹{Number(c.current_balance || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
