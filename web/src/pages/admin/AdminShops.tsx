import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchAdminShops,
  createAdminShop,
  updateAdminShop,
  toggleAdminShopStatus,
  approveAdminShop,
  rejectAdminShop,
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [selectedShop, setSelectedShop] = useState<AdminShopItem | null>(null);

  // Form States
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formOwnerId, setFormOwnerId] = useState<number | "">("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formReason, setFormReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
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

  const openApproveModal = (shop: AdminShopItem) => {
    setSelectedShop(shop);
    setApproveNote("");
    setFormError(null);
    setShowApproveModal(true);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await approveAdminShop(selectedShop.id, approveNote.trim() || undefined);
      setShowApproveModal(false);
      setActionSuccess(`Shop "${selectedShop.name}" approved and activated successfully.`);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to approve shop");
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectModal = (shop: AdminShopItem) => {
    setSelectedShop(shop);
    setFormReason("");
    setFormError(null);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    if (!formReason.trim()) {
      setFormError("Please provide a reason for rejecting this registration.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await rejectAdminShop(selectedShop.id, formReason.trim());
      setShowRejectModal(false);
      setActionSuccess(`Shop "${selectedShop.name}" registration rejected.`);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to reject shop");
    } finally {
      setSubmitting(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">
              Tenant Architecture
            </span>
          </div>
          <h1 className="page-title">Shop Management</h1>
          <p className="page-subtitle">Manage tenant shops, operational states, and business parameters</p>
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

      {/* Pending Approvals Attention Banner */}
      {pendingCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-black shadow-xs">
              {pendingCount}
            </div>
            <div>
              <div className="text-sm font-bold text-amber-950">
                Action Required: {pendingCount} Pending Shop Registration{pendingCount > 1 ? "s" : ""}
              </div>
              <div className="text-xs text-amber-800">
                New tenant registrations awaiting Super Admin identity verification and approval.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("status", "pending_approval");
              setSearchParams(next);
            }}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition self-start sm:self-auto shrink-0"
          >
            Review Pending ({pendingCount})
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">✕</button>
        </div>
      )}

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
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              currentFilter === t.key
                ? t.highlight
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-brand-600 text-white shadow-brand"
                : t.highlight
                ? "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-bold"
                : "bg-white text-slate-600 border border-border hover:border-brand-300 hover:text-brand-700 font-semibold"
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
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
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
                    <td className="py-3.5 px-4 tabular text-slate-400 font-semibold">{shop.id}</td>
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
                        {shop.status === "pending_approval" ? (
                          <>
                            <button
                              onClick={() => openApproveModal(shop)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-2xs"
                              title="Review and approve shop"
                            >
                              <span>✓</span>
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openRejectModal(shop)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 transition flex items-center gap-1 shadow-2xs"
                              title="Reject registration"
                            >
                              <span>✕</span>
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openStatusModal(shop)}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition font-bold ${
                              shop.status === "active"
                                ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {shop.status === "active" ? "Suspend" : "Activate"}
                          </button>
                        )}
                        <Link
                          to={`/admin/support?shopId=${shop.id}`}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 hover:border-slate-300 text-emerald-700 font-semibold text-xs rounded-lg border border-border shadow-2xs transition"
                          title="Read-only Support Viewer"
                        >
                          Support View
                        </Link>
                        <button
                          onClick={() => openEditModal(shop)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold text-xs rounded-lg border border-border shadow-2xs transition"
                        >
                          Edit
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
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-pop space-y-4 animate-scale-in">
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
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-pop space-y-4 animate-scale-in">
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

      {/* APPROVE SHOP MODAL */}
      {showApproveModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-3xl max-w-md w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-pop space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-emerald-700">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-900">Approve Shop Registration</h3>
                <p className="text-xs text-slate-500">Activate shop and grant portal & POS access</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Shop Name:</span>
                <span className="font-bold text-navy-900">{selectedShop.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shop Code:</span>
                <span className="font-mono font-bold text-emerald-800">{selectedShop.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner:</span>
                <span className="font-medium text-navy-900">{selectedShop.owner?.name || `#${selectedShop.owner_id}`} ({selectedShop.owner?.email || "-"})</span>
              </div>
              {selectedShop.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-medium text-navy-900">{selectedShop.phone}</span>
                </div>
              )}
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Welcome / Approval Note <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="e.g. Welcome to NSYU! Your store is now active and ready for billing."
                  className="input text-xs bg-white py-2"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Sent as an in-app notification to the shop owner.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Approving..." : "Confirm & Approve Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT SHOP MODAL */}
      {showRejectModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-3xl max-w-md w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-pop space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold">
                ✕
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-900">Reject Shop Registration</h3>
                <p className="text-xs text-slate-500">Decline registration and notify the business owner</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Rejecting <strong className="text-navy-900">{selectedShop.name}</strong> ({selectedShop.code}) will set its status to suspended and send an official alert notification with your rejection reason.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Incomplete business documentation or invalid shop code. Please contact platform support."
                  className="input text-xs bg-white py-2"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Required. This message will be delivered to the applicant via notification and recorded in audit trail.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 text-xs bg-rose-700 hover:bg-rose-800"
                >
                  {submitting ? "Rejecting..." : "Confirm & Reject Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showStatusModal && selectedShop && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-border rounded-3xl max-w-md w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-pop space-y-4 animate-scale-in">
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
