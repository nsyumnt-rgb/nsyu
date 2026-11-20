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
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-900 shadow-xs">
        <div className="w-5 h-5 mt-0.5 text-amber-600 shrink-0">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800">
            Support Viewer Mode — Read-Only Access
          </h4>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Super Admin has strictly read-only inspection access to shop operational data. Creating, editing, or cancelling bills, orders, inventory stock, or customer payments is restricted to preserve business audit integrity.
          </p>
        </div>
      </div>

      {/* Header & Shop Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Diagnostic Console
            </span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Shop Support Viewer</h1>
          <p className="text-xs sm:text-sm text-slate-500">Inspect business records for customer support and system diagnosis</p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-500">Target Shop:</span>
          <select
            value={selectedShopId || ""}
            onChange={(e) => setSelectedShopId(Number(e.target.value))}
            className="input h-10 text-xs font-semibold bg-white"
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
              className="btn-secondary btn-sm p-2.5"
              title="Refresh shop data"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading shop data...
        </div>
      ) : supportData ? (
        <div className="space-y-6">
          {/* Shop Profile & Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-[#EAE7DD] rounded-2xl shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Total Bills</span>
              <span className="text-2xl font-black text-navy-900 font-mono tabular">{supportData.stats.billsCount}</span>
            </div>
            <div className="p-4 bg-white border border-[#EAE7DD] rounded-2xl shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Total Orders</span>
              <span className="text-2xl font-black text-navy-900 font-mono tabular">{supportData.stats.ordersCount}</span>
            </div>
            <div className="p-4 bg-white border border-[#EAE7DD] rounded-2xl shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Stock Lines</span>
              <span className="text-2xl font-black text-navy-900 font-mono tabular">{supportData.stats.productsCount}</span>
            </div>
            <div className="p-4 bg-white border border-[#EAE7DD] rounded-2xl shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Customers</span>
              <span className="text-2xl font-black text-navy-900 font-mono tabular">{supportData.stats.customersCount}</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold gap-2">
            {[
              { key: "bills", label: `Bills (${supportData.recentBills.length})` },
              { key: "orders", label: `Orders (${supportData.recentOrders.length})` },
              { key: "inventory", label: `Inventory Stock (${supportData.inventorySummary.length})` },
              { key: "customers", label: `Customers (${supportData.customersList.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2.5 px-4 border-b-2 font-bold transition ${
                  activeTab === tab.key
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-navy-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: BILLS */}
          {activeTab === "bills" && (
            <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {supportData.recentBills.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                          No bills recorded for this shop.
                        </td>
                      </tr>
                    ) : (
                      supportData.recentBills.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand-700">{b.invoice_number}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {b.invoice_date ? new Date(b.invoice_date).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-navy-900 tabular">₹{Number(b.total_amount).toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-emerald-700 font-bold tabular">₹{Number(b.paid_amount || 0).toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-amber-700 font-bold tabular">₹{Number(b.due_amount || 0).toFixed(2)}</td>
                          <td className="py-3.5 px-4 capitalize text-slate-600 font-medium">{b.payment_method}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                                b.status === "paid"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : b.status === "cancelled"
                                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
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
            <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Billed Bill ID</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {supportData.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                          No orders recorded for this shop.
                        </td>
                      </tr>
                    ) : (
                      supportData.recentOrders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand-700">{o.order_number}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {o.order_date ? new Date(o.order_date).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-navy-900 tabular">₹{Number(o.total_amount).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {o.billed_bill_id ? `#Bill ${o.billed_bill_id}` : "-"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
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
            <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {supportData.inventorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          No stock records found.
                        </td>
                      </tr>
                    ) : (
                      supportData.inventorySummary.map((st: any) => (
                        <tr key={st.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-navy-900">{st.product?.name || `Product #${st.product_id}`}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">{st.product?.sku || "-"}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-bold tabular ${
                                Number(st.current_stock) < 0
                                  ? "text-rose-600 font-mono"
                                  : Number(st.current_stock) === 0
                                  ? "text-slate-400"
                                  : "text-emerald-700"
                              }`}
                            >
                              {st.current_stock}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-navy-900 font-bold tabular">₹{Number(st.product?.selling_price || 0).toFixed(2)}</td>
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
            <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {supportData.customersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          No customer records found.
                        </td>
                      </tr>
                    ) : (
                      supportData.customersList.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-navy-900">{c.name}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">{c.phone || "-"}</td>
                          <td className="py-3.5 px-4 text-slate-500">{c.email || "-"}</td>
                          <td className="py-3.5 px-4 font-bold text-amber-700 tabular">
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
