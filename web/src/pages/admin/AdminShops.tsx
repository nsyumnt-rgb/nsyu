import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchAdminShops,
  createAdminShop,
  updateAdminShop,
  toggleAdminShopStatus,
  approveAdminShop,
  fetchAdminOwners,
  type AdminShopItem,
  type AdminOwnerItem,
} from "../../api/admin";

export default function AdminShops() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFilter = searchParams.get("status") || "all";

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
    if (!formName.trim()) {
      setFormError("Shop Name is required.");
      return;
    }
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
    setSubmitting(true);
    setFormError(null);
    try {
      const nextStatus = selectedShop.status === "active" ? "suspended" : "active";
      await toggleAdminShopStatus(
        selectedShop.id,
        nextStatus,
        formReason.trim() || undefined
      );
      setShowStatusModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (shop: AdminShopItem) => {
    if (!window.confirm(`Approve and activate "${shop.name}" (${shop.code})?`)) return;
    try {
      await approveAdminShop(shop.id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to approve shop");
    }
  };

  const pendingCount = shops.filter((s) => s.status === "pending_approval").length;
  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;

  const filteredShops = shops.filter((s) => {
    if (currentFilter === "all") return true;
    return s.status === currentFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Tenant Architecture
            </span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Shop Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">Manage tenant shops, operational states, and business parameters</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs font-bold px-4 py-2.5 shadow-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create New Shop</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { key: "all", label: `All (${shops.length})` },
          { key: "pending_approval", label: `Pending Approval (${pendingCount})`, highlight: pendingCount > 0 },
          { key: "active", label: `Active (${activeCount})` },
          { key: "suspended", label: `Suspended (${suspendedCount})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (t.key === "all") next.delete("status");
              else next.set("status", t.key);
              setSearchParams(next);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              currentFilter === t.key
                ? t.highlight
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-emerald-700 text-white shadow-xs"
                : t.highlight
                ? "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-bold"
                : "bg-white text-slate-700 border border-[#EAE7DD] hover:bg-slate-50 shadow-2xs font-semibold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Shops Table */}
      <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
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
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading shops...
                  </td>
                </tr>
              ) : filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No shops match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredShops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">{shop.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy-900 text-sm">{shop.name}</div>
                      <div className="text-[11.5px] text-slate-500 truncate max-w-xs">{shop.address || "No address specified"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                        {shop.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy-900">{shop.owner?.name || `Owner #${shop.owner_id}`}</div>
                      <div className="text-[11.5px] text-slate-500">{shop.owner?.email || "-"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium">{shop.phone || "-"}</div>
                      <div className="text-[11px] text-slate-400">{shop.email || "-"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          shop.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : shop.status === "pending_approval"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            shop.status === "active"
                              ? "bg-emerald-600"
                              : shop.status === "pending_approval"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-rose-500"
                          }`}
                        ></span>
                        {shop.status === "active"
                          ? "Active"
                          : shop.status === "pending_approval"
                          ? "Pending Approval"
                          : "Suspended"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {shop.status === "pending_approval" && (
                          <button
                            onClick={() => handleApprove(shop)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-2xs"
                            title="Approve this shop"
                          >
                            <span>✓</span>
                            <span>Approve</span>
                          </button>
                        )}
                        <Link
                          to={`/admin/support?shopId=${shop.id}`}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-emerald-700 font-semibold text-xs rounded-lg border border-[#EAE7DD] shadow-2xs transition"
                          title="Read-only Support Viewer"
                        >
                          Support View
                        </Link>
                        <button
                          onClick={() => openEditModal(shop)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-[#EAE7DD] shadow-2xs transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openStatusModal(shop)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition font-bold ${
                            shop.status === "active"
                              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {shop.status === "active" ? "Suspend" : shop.status === "pending_approval" ? "Reject" : "Activate"}
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Create New Shop</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. NSYU Telecom Downtown"
                    className="input h-10 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Shop Code *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. NSYU-01"
                    className="input h-10 text-xs font-mono uppercase bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assigned Owner *</label>
                <select
                  required
                  value={formOwnerId}
                  onChange={(e) => setFormOwnerId(Number(e.target.value))}
                  className="input h-10 text-xs bg-white font-medium"
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
                  <label className="block text-slate-700 font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="input h-10 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. shop@example.com"
                    className="input h-10 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address, city, state, pin"
                  className="input text-xs bg-white py-2"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Edit Shop: {selectedShop.name}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="input h-10 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="input h-10 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="input text-xs bg-white py-2"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-navy-900">
                {selectedShop.status === "active" ? "Suspend Shop" : "Reactivate Shop"}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedShop.status === "active" ? (
                <>
                  Suspending <strong className="text-navy-900">{selectedShop.name}</strong> will{" "}
                  <strong className="text-rose-600">immediately block login and API access</strong> for all of its users (Owner, Managers, Staff, and Customers) until reactivated. Existing data is preserved and will never be deleted.
                </>
              ) : (
                <>
                  Reactivating <strong className="text-navy-900">{selectedShop.name}</strong> will restore full access for all shop accounts.
                </>
              )}
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason for Status Change</label>
                <textarea
                  rows={2}
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Non-payment of platform invoice / Administrative hold"
                  className="input text-xs bg-white py-2"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 text-xs ${
                    selectedShop.status === "active"
                      ? "bg-rose-700 hover:bg-rose-800"
                      : "bg-emerald-700 hover:bg-emerald-800"
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
