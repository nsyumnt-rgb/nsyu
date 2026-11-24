import { useEffect, useState } from "react";
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  uploadAdminCategoryImage,
  type AdminCategoryItem,
} from "../../api/admin";
import { resolveAssetUrl } from "../../api/client";
import { getCategoryAlias } from "../../utils/categoryAlias";

export default function AdminCategories() {
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCat, setSelectedCat] = useState<AdminCategoryItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formAlias, setFormAlias] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCategories();
      setCategories(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load master categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormName("");
    setFormAlias("");
    setFormStatus("active");
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Category Name is required");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createAdminCategory({
        name: formName.trim(),
        alias: formAlias.trim() ? formAlias.trim().toUpperCase() : getCategoryAlias(formName.trim()),
        status: formStatus,
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (cat: AdminCategoryItem) => {
    setSelectedCat(cat);
    setFormName(cat.name);
    setFormAlias(cat.alias || getCategoryAlias(cat.name));
    setFormStatus(cat.status);
    setFormError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCat) return;
    if (!formName.trim()) {
      setFormError("Category Name is required");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateAdminCategory(selectedCat.id, {
        name: formName.trim(),
        alias: formAlias.trim() ? formAlias.trim().toUpperCase() : null,
        status: formStatus,
      });
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  const openUploadModal = (cat: AdminCategoryItem) => {
    setSelectedCat(cat);
    setUploadFile(null);
    setUploadPreview(cat.image_url ? resolveAssetUrl(cat.image_url) : null);
    setFormError(null);
    setShowUploadModal(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCat || !uploadFile) {
      setFormError("Please select an icon image or PNG to upload");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await uploadAdminCategoryImage(selectedCat.id, uploadFile);
      setShowUploadModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to upload icon");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (cat: AdminCategoryItem) => {
    setSelectedCat(cat);
    setFormError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedCat) return;
    setSubmitting(true);
    try {
      await deleteAdminCategory(selectedCat.id);
      setShowDeleteModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to delete category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat: AdminCategoryItem) => {
    const nextStatus = cat.status === "active" ? "inactive" : "active";
    try {
      await updateAdminCategory(cat.id, { status: nextStatus });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to change status");
    }
  };

  // Metrics
  const totalCategories = categories.length;
  const activeCount = categories.filter((c) => c.status === "active").length;
  const inactiveCount = categories.filter((c) => c.status === "inactive").length;
  const totalProductsMapped = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);

  const filtered = categories.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mName = c.name.toLowerCase().includes(q);
      const mAlias = (c.alias || "").toLowerCase().includes(q);
      return mName || mAlias;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Catalog Governance
            </span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Master Platform Categories</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Centrally manage global categories, aliases, and brand icons across all marketplace shops
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs font-bold px-4 py-2.5 shadow-xs cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Master Category</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
          <div className="text-slate-400 text-xs font-bold uppercase">Total Categories</div>
          <div className="text-2xl font-black text-navy-900 mt-1">{totalCategories}</div>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
          <div className="text-emerald-700 text-xs font-bold uppercase">Active Categories</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-bold uppercase">Inactive Categories</div>
          <div className="text-2xl font-black text-slate-600 mt-1">{inactiveCount}</div>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
          <div className="text-blue-700 text-xs font-bold uppercase">Total Products Mapped</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{totalProductsMapped}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(["all", "active", "inactive"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize ${
                statusFilter === tab
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab === "all" ? `All (${totalCategories})` : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category name or alias..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-2 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Icon</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4 text-center">Alias</th>
                <th className="py-3 px-4 text-center">Products</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading categories...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No categories found.
                  </td>
                </tr>
              ) : (
                filtered.map((cat) => {
                  const resolvedImg = cat.image_url ? resolveAssetUrl(cat.image_url) : null;
                  const displayAlias = cat.alias || getCategoryAlias(cat.name);

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition">
                      {/* Icon */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => openUploadModal(cat)}
                          className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-500 transition group"
                          title="Click to change or upload category icon"
                        >
                          {resolvedImg ? (
                            <img
                              src={resolvedImg || undefined}
                              alt={cat.name}
                              className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <span className="font-bold text-xs text-slate-400 font-mono">
                              {cat.name.charAt(0)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-900 text-sm">{cat.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          ID: #{cat.id}
                        </div>
                      </td>

                      {/* Alias */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black font-mono tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-200">
                          {displayAlias}
                        </span>
                      </td>

                      {/* Products */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {cat.product_count || 0} products
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cat)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                            cat.status === "active"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              cat.status === "active" ? "bg-emerald-600" : "bg-slate-400"
                            }`}
                          />
                          {cat.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openUploadModal(cat)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-emerald-700 font-semibold text-xs rounded-lg border border-[#E5E7EB] shadow-2xs transition cursor-pointer"
                            title="Upload Icon or PNG"
                          >
                            📷 Icon
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-[#E5E7EB] shadow-2xs transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(cat)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 shadow-2xs transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy-900">Create Master Category</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center font-bold"
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
                <label className="block text-slate-700 font-bold mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formAlias) setFormAlias(getCategoryAlias(e.target.value));
                  }}
                  placeholder="e.g. Power Bank Charger"
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Category Alias (Short Code)
                </label>
                <input
                  type="text"
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  placeholder="e.g. PB (auto-generated if blank)"
                  className="input h-10 text-xs bg-white font-mono uppercase"
                />
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Used in inventory lists and badges (e.g. Charger $\rightarrow$ CH, Neckband $\rightarrow$ NB)
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="input h-10 text-xs bg-white cursor-pointer"
                >
                  <option value="active">Active (Visible across all shops)</option>
                  <option value="inactive">Inactive</option>
                </select>
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
                  {submitting ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedCat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy-900">Edit Category: {selectedCat.name}</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center font-bold"
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
                <label className="block text-slate-700 font-bold mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input h-10 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Category Alias</label>
                <input
                  type="text"
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  className="input h-10 text-xs bg-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="input h-10 text-xs bg-white cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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

      {/* UPLOAD ICON MODAL */}
      {showUploadModal && selectedCat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy-900">Upload Icon: {selectedCat.name}</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition">
                {uploadPreview ? (
                  <div className="relative mb-3">
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="w-20 h-20 object-contain p-2 bg-white rounded-xl border border-gray-200 shadow-2xs"
                    />
                  </div>
                ) : (
                  <div className="text-4xl text-gray-300 mb-2">📁</div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                      setUploadPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
                />
                <span className="text-[10px] text-gray-400 mt-2">
                  Supports PNG, JPG, WebP transparent icons up to 10MB
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary btn-sm text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !uploadFile}
                  className="btn-primary btn-sm text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Uploading..." : "Save Icon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && selectedCat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-navy-900">Delete Category</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete category{" "}
              <strong className="text-navy-900">{selectedCat.name}</strong>? Any products currently linked to this category will have their category field set to unassigned.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary btn-sm text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 transition"
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
