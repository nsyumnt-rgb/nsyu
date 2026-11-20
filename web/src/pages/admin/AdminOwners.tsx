import { useEffect, useState } from "react";
import {
  fetchAdminOwners,
  createAdminOwner,
  resetAdminOwnerPassword,
  toggleAdminOwnerStatus,
  type AdminOwnerItem,
} from "../../api/admin";

export default function AdminOwners() {
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedOwner, setSelectedOwner] = useState<AdminOwnerItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive" | "suspended">("active");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadOwners = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminOwners();
      setOwners(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load owners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, []);

  const openCreateModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setFormError("Name, Email, and Password are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createAdminOwner({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword.trim(),
        phone: formPhone.trim() || undefined,
      });
      setShowCreateModal(false);
      await loadOwners();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to create owner");
    } finally {
      setSubmitting(false);
    }
  };

  const openPasswordModal = (owner: AdminOwnerItem) => {
    setSelectedOwner(owner);
    setFormPassword("");
    setFormError(null);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;
    if (!formPassword || formPassword.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await resetAdminOwnerPassword(selectedOwner.id, formPassword);
      setShowPasswordModal(false);
      alert(`Password successfully updated for ${selectedOwner.email}`);
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusModal = (owner: AdminOwnerItem) => {
    setSelectedOwner(owner);
    setFormStatus(owner.status);
    setFormReason("");
    setFormError(null);
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await toggleAdminOwnerStatus(selectedOwner.id, formStatus, formReason.trim() || undefined);
      setShowStatusModal(false);
      await loadOwners();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to update owner status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Identity & Access
            </span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Owner Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">Create tenant owners, reset credentials, and govern account lifecycles</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs font-bold px-4 py-2.5 shadow-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span>Create First Owner</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Owners Table */}
      <div className="bg-white border border-[#EAE7DD] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Owner Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Shops</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading owners...
                  </td>
                </tr>
              ) : owners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No owners found in database.
                  </td>
                </tr>
              ) : (
                owners.map((owner) => (
                  <tr key={owner.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">{owner.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy-900 text-sm">{owner.name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{owner.email}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">{owner.phone || "-"}</td>
                    <td className="py-3.5 px-4">
                      {owner.is_super_admin ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                          Super Admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          Owner
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {owner.shops && owner.shops.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {owner.shops.map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-[11px] font-semibold"
                            >
                              {s.name} ({s.code})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No shops linked</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          owner.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            owner.status === "active" ? "bg-emerald-600" : "bg-rose-500"
                          }`}
                        ></span>
                        {owner.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!owner.is_super_admin && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openPasswordModal(owner)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-[#EAE7DD] shadow-2xs transition"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => openStatusModal(owner)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-[#EAE7DD] shadow-2xs transition"
                          >
                            Status
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE FIRST OWNER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Create First Owner for Shop</h3>
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
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email (Login Username) *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="owner@domain.com"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-[11px] leading-relaxed">
                ℹ Creating an owner account automatically initializes default system roles (Owner, Manager, Sales Staff) with standardized granular permissions.
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
                  {submitting ? "Creating..." : "Create Owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showPasswordModal && selectedOwner && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Reset Password for {selectedOwner.name}</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Set a new secure password for <strong className="text-navy-900 font-semibold">{selectedOwner.email}</strong>.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE OWNER STATUS MODAL */}
      {showStatusModal && selectedOwner && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE7DD] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Update Status for {selectedOwner.name}</h3>
              <button
                onClick={() => setShowStatusModal(false)}
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

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Account Status *</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="input h-10 text-xs bg-white font-semibold"
                >
                  <option value="active">Active (Full access)</option>
                  <option value="inactive">Inactive (Deactivated)</option>
                  <option value="suspended">Suspended (Blocked)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason</label>
                <textarea
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Optional note for platform audit log"
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
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
