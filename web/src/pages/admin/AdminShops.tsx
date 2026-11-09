import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminShops,
  createAdminShop,
  updateAdminShop,
  toggleAdminShopStatus,
  fetchAdminOwners,
  type AdminShopItem,
  type AdminOwnerItem,
} from "../../api/admin";

export default function AdminShops() {
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedShop, setSelectedShop] = useState<AdminShopItem | null>(null);

  // Form States
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formOwnerId, setFormOwnerId] = useState<number | "">("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shopsRes, ownersRes] = await Promise.all([fetchAdminShops(), fetchAdminOwners()]);
      setShops(shopsRes.data?.data || []);
      setOwners(ownersRes.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load shops");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormName("");
    setFormCode("");
    setFormOwnerId(owners.length > 0 ? owners[0].id : "");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim() || !formOwnerId) {
      setFormError("Shop Name, Code, and Owner are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createAdminShop({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        owner_id: Number(formOwnerId),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to create shop");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (shop: AdminShopItem) => {
    setSelectedShop(shop);
    setFormName(shop.name);
    setFormPhone(shop.phone || "");
    setFormEmail(shop.email || "");
    setFormAddress(shop.address || "");
    setFormError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateAdminShop(selectedShop.id, {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
      });
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to update shop");
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusModal = (shop: AdminShopItem) => {
    setSelectedShop(shop);
    setFormReason("");
    setFormError(null);
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    const targetStatus = selectedShop.status === "suspended" ? "active" : "suspended";
    setSubmitting(true);
    setFormError(null);
    try {
      await toggleAdminShopStatus(selectedShop.id, targetStatus, formReason.trim() || undefined);
      setShowStatusModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to update shop status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Shop Management</h1>
          <p className="text-sm text-slate-400">Manage tenant shops, operational states, and business parameters</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-md transition self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create New Shop</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Shops Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Shop Details</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading shops...
                  </td>
                </tr>
              ) : shops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No shops registered yet. Click &quot;Create New Shop&quot; to begin.
                  </td>
                </tr>
              ) : (
                shops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{shop.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{shop.name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{shop.address || "No address specified"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {shop.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{shop.owner?.name || `Owner #${shop.owner_id}`}</div>
                      <div className="text-[11px] text-slate-400">{shop.owner?.email || "-"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <div>{shop.phone || "-"}</div>
                      <div className="text-[11px]">{shop.email || "-"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          shop.status === "active"
                            ? "bg-emerald-950/70 text-emerald-300 border-emerald-800"
                            : "bg-rose-950/70 text-rose-300 border-rose-800"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            shop.status === "active" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        ></span>
                        {shop.status === "active" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/admin/support?shopId=${shop.id}`}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs rounded border border-slate-700 transition"
                          title="Read-only Support Viewer"
                        >
                          Support View
                        </Link>
                        <button
                          onClick={() => openEditModal(shop)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openStatusModal(shop)}
                          className={`px-2.5 py-1 text-xs rounded border transition font-medium ${
                            shop.status === "active"
                              ? "bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60"
                              : "bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60"
                          }`}
                        >
                          {shop.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SHOP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create New Shop</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. NSYU Telecom Downtown"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Shop Code *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. NSYU-01"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Owner *</label>
                <select
                  required
                  value={formOwnerId}
                  onChange={(e) => setFormOwnerId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select an Owner</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. shop@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address, city, state, pin"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHOP MODAL */}
      {showEditModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Shop: {selectedShop.name}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATE / SUSPEND CONFIRMATION MODAL */}
      {showStatusModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-white">
                {selectedShop.status === "active" ? "Suspend Shop" : "Reactivate Shop"}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedShop.status === "active" ? (
                <>
                  Suspending <strong className="text-white">{selectedShop.name}</strong> will{" "}
                  <strong className="text-rose-400">immediately block login and API access</strong> for all of its users (Owner, Managers, Staff, and Customers) until reactivated. Existing data is preserved and will never be deleted.
                </>
              ) : (
                <>
                  Reactivating <strong className="text-white">{selectedShop.name}</strong> will restore full access for all shop accounts.
                </>
              )}
            </p>

            {formError && (
              <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Status Change</label>
                <textarea
                  rows={2}
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Non-payment of platform invoice / Administrative hold"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50 ${
                    selectedShop.status === "active"
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {submitting
                    ? "Updating..."
                    : selectedShop.status === "active"
                    ? "Confirm Suspension"
                    : "Confirm Reactivation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
