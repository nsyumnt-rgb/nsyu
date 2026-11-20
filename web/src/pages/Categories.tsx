import React, { useEffect, useRef, useState } from "react";
import {
  listCategories,
  createCategory,
  updateCategory,
  uploadCategoryImage,
  deleteCategory,
} from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import type { Category } from "../types";

const PRESET_ICONS = [
  { icon: "💻", label: "Computers / Tech" },
  { icon: "📱", label: "Mobiles" },
  { icon: "🎧", label: "Accessories" },
  { icon: "👕", label: "Fashion / Apparel" },
  { icon: "🛋️", label: "Home & Furniture" },
  { icon: "🧴", label: "Beauty & Personal" },
  { icon: "🍎", label: "Groceries & Food" },
  { icon: "🏀", label: "Sports & Fitness" },
  { icon: "💊", label: "Health & Pharma" },
  { icon: "🚗", label: "Automotive" },
  { icon: "📚", label: "Books & Stationery" },
  { icon: "📦", label: "General Goods" },
];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Form states for Add / Edit
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("📦");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Direct table upload ref
  const tableFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetCatId, setUploadTargetCatId] = useState<number | null>(null);
  const [tableUploading, setTableUploading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await listCategories();
      setCategories(res.data?.data || []);
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function openAddModal() {
    setEditingCategory(null);
    setFormName("");
    setFormIcon("📦");
    setFormStatus("active");
    setFormImageFile(null);
    setFormImagePreview(null);
    setShowAddModal(true);
  }

  function openEditModal(c: Category) {
    setEditingCategory(c);
    setFormName(c.name);
    setFormIcon(c.icon || "📦");
    setFormStatus(c.status);
    setFormImageFile(null);
    setFormImagePreview(c.image_url ? resolveAssetUrl(c.image_url) : null);
    setShowAddModal(true);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFormImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Please enter a category name");
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        // Update existing category
        const res = await updateCategory(editingCategory.id, {
          name: formName.trim(),
          icon: formIcon.trim() || null,
          status: formStatus,
        });
        let updated = res.data?.data;

        // If new image was chosen, upload it
        if (formImageFile) {
          const upRes = await uploadCategoryImage(editingCategory.id, formImageFile);
          if (upRes.data?.data?.category) {
            updated = upRes.data.data.category;
          }
        }

        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, ...updated } : c))
        );
        showToast(`✓ Category "${formName}" updated successfully`);
      } else {
        // Create new category
        const res = await createCategory({
          name: formName.trim(),
          icon: formIcon.trim() || null,
          status: formStatus,
        });
        let created = res.data?.data;

        // If image was selected, upload it
        if (formImageFile && created?.id) {
          const upRes = await uploadCategoryImage(created.id, formImageFile);
          if (upRes.data?.data?.category) {
            created = upRes.data.data.category;
          }
        }

        if (created) {
          setCategories((prev) => [created!, ...prev]);
        }
        showToast(`✓ Category "${formName}" created successfully`);
      }

      setShowAddModal(false);
      loadCategories();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to save category"));
    } finally {
      setSaving(false);
    }
  }

  // Direct table image upload trigger
  function triggerTableImageUpload(catId: number) {
    setUploadTargetCatId(catId);
    if (tableFileInputRef.current) {
      tableFileInputRef.current.value = "";
      tableFileInputRef.current.click();
    }
  }

  async function handleTableFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetCatId) return;

    setTableUploading(true);
    try {
      const res = await uploadCategoryImage(uploadTargetCatId, file);
      const updatedCat = res.data?.data?.category;
      if (updatedCat) {
        setCategories((prev) =>
          prev.map((c) => (c.id === uploadTargetCatId ? { ...c, ...updatedCat } : c))
        );
      }
      showToast("✓ Category PNG / image uploaded successfully");
      loadCategories();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to upload category image"));
    } finally {
      setTableUploading(false);
      setUploadTargetCatId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id);
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      showToast(`✓ Category "${categoryToDelete.name}" deleted`);
      setCategoryToDelete(null);
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to delete category"));
    }
  }

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
  const activeCount = categories.filter((c) => c.status === "active").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hidden file input for table PNG upload */}
      <input
        type="file"
        ref={tableFileInputRef}
        onChange={handleTableFileChange}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              📁
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Categories & Icons
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Manage your store categories, customize icon badges, and upload high-resolution PNG / image covers.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Category</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Total Categories</span>
            <span className="text-base">🗂️</span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{categories.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Organizing your product catalog</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Active Categories</span>
            <span className="text-base">✅</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{activeCount}</div>
          <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Visible on storefront & marketplace</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Linked Products</span>
            <span className="text-base">📦</span>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{totalProducts}</div>
          <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Items assigned across all categories</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div className="text-xs text-gray-400 font-semibold">
          Showing {filteredCategories.length} of {categories.length} categories
        </div>
      </div>

      {/* Categories Table / Card Grid */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-500 font-medium">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto mb-3" />
            Loading categories...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 font-medium">
            <div className="text-3xl mb-2">📂</div>
            <p className="font-bold text-gray-800 text-sm">No categories found</p>
            <p className="text-gray-400 mt-1 max-w-sm mx-auto">
              {search
                ? "No categories match your search term. Try a different query."
                : "Create your first category to group products and assign icons or images."}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-800 transition"
              >
                + Add Category Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-600 uppercase font-black tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Image / PNG</th>
                  <th className="py-3 px-4">Icon</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4 text-center">Products</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* PNG / Image Preview & Direct Upload */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {c.image_url ? (
                          <div className="relative group w-12 h-12 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
                            <img
                              src={resolveAssetUrl(c.image_url) ?? undefined}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => triggerTableImageUpload(c.id)}
                              className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition"
                              title="Change PNG / Image"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 flex items-center justify-center text-gray-400 shrink-0 text-[11px]">
                            No PNG
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerTableImageUpload(c.id)}
                          disabled={tableUploading && uploadTargetCatId === c.id}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-lg text-[11px] transition shrink-0 flex items-center gap-1 shadow-2xs"
                        >
                          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>{c.image_url ? "Change PNG" : "Upload PNG"}</span>
                        </button>
                      </div>
                    </td>

                    {/* Icon Badge */}
                    <td className="py-3 px-4">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200/80 flex items-center justify-center text-lg shadow-2xs">
                        {c.icon || "📦"}
                      </div>
                    </td>

                    {/* Category Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 text-sm">{c.name}</div>
                      <div className="text-[11px] text-gray-400">ID: #{c.id}</div>
                    </td>

                    {/* Product Count */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                        {c.product_count || 0} products
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          c.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {c.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95"
                          title="Edit Category Name & Icon"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoryToDelete(c)}
                          className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95"
                          title="Delete Category"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span>{editingCategory ? "✏️ Edit Category" : "✨ Add New Category"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Smart Watches, Audio, Groceries..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 font-medium"
                />
              </div>

              {/* Related Icon */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category Icon <span className="text-gray-400 font-normal">(Emoji or symbol)</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xl shrink-0">
                    {formIcon || "📦"}
                  </div>
                  <input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="Enter emoji or icon code"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 font-medium"
                  />
                </div>
                {/* Preset Icon Selector */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {PRESET_ICONS.map((p) => (
                    <button
                      key={p.icon}
                      type="button"
                      onClick={() => setFormIcon(p.icon)}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition border ${
                        formIcon === p.icon
                          ? "border-emerald-600 bg-emerald-50 scale-110"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      }`}
                      title={p.label}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Image / PNG Banner */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Upload Category Image / PNG <span className="text-gray-400 font-normal">(Optional cover or badge)</span>
                </label>
                <div className="flex items-center gap-3">
                  {formImagePreview ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
                      <img
                        src={formImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-xs shrink-0">
                      No Image
                    </div>
                  )}

                  <label className="flex-1 cursor-pointer">
                    <div className="px-3.5 py-2.5 border border-dashed border-gray-300 hover:border-emerald-600 rounded-xl text-center bg-gray-50/50 hover:bg-emerald-50/20 transition">
                      <span className="text-xs font-bold text-emerald-800">Choose PNG / JPG Image</span>
                      <p className="text-[10.5px] text-gray-400 mt-0.5">PNG, JPG, or WebP up to 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === "active"}
                      onChange={() => setFormStatus("active")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Active (Visible on store)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === "inactive"}
                      onChange={() => setFormStatus("inactive")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingCategory ? "Save Changes" : "Create Category"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Delete Category</h3>
                <p className="text-xs text-gray-500">Are you sure you want to delete this category?</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
              <p className="font-bold text-gray-800">{categoryToDelete.name}</p>
              <p className="text-gray-500 mt-1">
                {categoryToDelete.product_count || 0} products currently linked to this category will be unassigned.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
