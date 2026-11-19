import { useEffect, useMemo, useState } from "react";
import {
  getInventoryHistory,
  recordMovement,
  type DirectMovementType,
} from "../api/inventory";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsApi,
} from "../api/products";
import { listCategories } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import type { Category, InventoryTransaction, Product } from "../types";

// Helper for formatting INR currency
function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null) return "₹0.00";
  return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Inventory() {
  const shopId = useAuthStore((s) => s.shopId);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters matching user request: All Products, Low Stock, Out of Stock, Stock Movement
  const [activeFilter, setActiveFilter] = useState<"All" | "Low Stock" | "Out of Stock" | "Stock Movement">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Adjust Stock Form
  const [adjustMode, setAdjustMode] = useState<"change" | "set">("change");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState<"count" | "damaged" | "return" | "other">("count");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Add Product Form
  const [addName, setAddName] = useState("");
  const [addSku, setAddSku] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addPurchasePrice, setAddPurchasePrice] = useState("");
  const [addSellingPrice, setAddSellingPrice] = useState("");
  const [addMinStock, setAddMinStock] = useState("5");
  const [addOpeningStock, setAddOpeningStock] = useState("10");
  const [addingProduct, setAddingProduct] = useState(false);

  // Edit Product Form
  const [editName, setEditName] = useState("");
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("5");
  const [editingProduct, setEditingProduct] = useState(false);

  // Load centralized inventory data
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, histRes] = await Promise.all([
        listProducts(),
        listCategories(),
        getInventoryHistory({ limit: 120 }),
      ]);
      setProducts(prodRes.data?.data || []);
      setCategories(catRes.data?.data || []);
      setHistory(histRes.data?.data || []);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [shopId]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Real database-calculated summary metrics
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + Number(p.stocks?.[0]?.current_stock ?? 0), 0);
  const lowStockProducts = products.filter((p) => {
    const s = Number(p.stocks?.[0]?.current_stock ?? 0);
    const min = Number(p.min_stock ?? 5) || 5;
    return s > 0 && s <= min;
  });
  const lowStockCount = lowStockProducts.length;
  const outOfStockProducts = products.filter((p) => Number(p.stocks?.[0]?.current_stock ?? 0) <= 0);
  const outOfStockCount = outOfStockProducts.length;

  // Filtered Products for Table
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
      const min = Number(p.min_stock ?? 5) || 5;

      if (activeFilter === "Low Stock" && (stock <= 0 || stock > min)) return false;
      if (activeFilter === "Out of Stock" && stock > 0) return false;

      if (categoryFilter !== "All" && p.category?.name !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = p.name.toLowerCase().includes(q);
        const mSku = p.sku.toLowerCase().includes(q);
        const mBarcode = p.barcode?.toLowerCase().includes(q);
        if (!mName && !mSku && !mBarcode) return false;
      }
      return true;
    });
  }, [products, activeFilter, categoryFilter, searchQuery]);

  // Filtered Movement History
  const filteredMovements = useMemo(() => {
    return history.filter((m: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const pName = m.product?.name?.toLowerCase() || "";
      const pSku = m.product?.sku?.toLowerCase() || "";
      const notes = m.notes?.toLowerCase() || "";
      return pName.includes(q) || pSku.includes(q) || notes.includes(q);
    });
  }, [history, searchQuery]);

  // Open Stock Movement / Adjust Modal
  function openAdjust(p?: Product) {
    if (p) setSelectedProduct(p);
    else if (products.length > 0 && !selectedProduct) setSelectedProduct(products[0]);
    setAdjustMode("change");
    setAdjustQuantity("");
    setAdjustReason("count");
    setAdjustNotes("");
    setAdjustError(null);
    setShowAdjustModal(true);
  }

  // Submit Stock Movement / Adjustment
  async function handleSaveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjustError(null);

    const curr = Number(selectedProduct.stocks?.[0]?.current_stock ?? 0);
    const n = Number(adjustQuantity);
    if (!adjustQuantity.trim() || !Number.isFinite(n)) {
      setAdjustError("Please enter a valid quantity.");
      return;
    }

    let delta = 0;
    let type: DirectMovementType = "adjustment";

    if (adjustReason === "damaged") {
      delta = -Math.abs(Math.trunc(n));
      type = "damage";
    } else if (adjustReason === "return") {
      delta = Math.abs(Math.trunc(n));
      type = "customer_return";
    } else {
      delta = adjustMode === "set" ? Math.trunc(n) - curr : Math.trunc(n);
      type = "adjustment";
    }

    if (delta === 0) {
      setAdjustError("Counted quantity matches current stock — nothing to change.");
      return;
    }
    if (curr + delta < 0) {
      setAdjustError(`Stock cannot go below 0 (current: ${curr}).`);
      return;
    }

    setAdjustSaving(true);
    try {
      const quantityToRecord = type === "adjustment" ? delta : Math.abs(delta);
      await recordMovement({
        productId: selectedProduct.id,
        type,
        quantity: quantityToRecord,
        notes: `[Reason: ${adjustReason}] ${adjustNotes.trim()}`.trim(),
      });
      setShowAdjustModal(false);
      setToastMsg(`✓ Stock for "${selectedProduct.name}" updated to ${curr + delta}`);
      loadData();
    } catch (err: any) {
      setAdjustError(apiErrorMessage(err, "Failed to record stock movement"));
    } finally {
      setAdjustSaving(false);
    }
  }

  // Create Product
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addSellingPrice) return;
    setAddingProduct(true);
    try {
      const catId = categories.find((c) => c.name === addCategory)?.id;
      await createProduct({
        name: addName.trim(),
        sku: addSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        selling_price: Number(addSellingPrice) || 0,
        purchase_price: Number(addPurchasePrice) || Number(addSellingPrice) * 0.8,
        category_id: catId,
        min_stock: Number(addMinStock) || 5,
        opening_stock: shopId ? { shopId, quantity: Number(addOpeningStock) || 0 } : undefined,
      });
      setShowAddModal(false);
      setAddName("");
      setAddSku("");
      setAddSellingPrice("");
      setAddPurchasePrice("");
      setToastMsg("✓ Product created successfully");
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to create product"));
    } finally {
      setAddingProduct(false);
    }
  }

  // Open Edit Product
  function openEdit(p: Product) {
    setSelectedProduct(p);
    setEditName(p.name);
    setEditPurchasePrice(String(p.purchase_price || 0));
    setEditSellingPrice(String(p.selling_price || 0));
    setEditMinStock(String(p.min_stock || 5));
    setShowEditModal(true);
  }

  // Save Edit Product
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setEditingProduct(true);
    try {
      await updateProduct(selectedProduct.id, {
        name: editName.trim(),
        purchase_price: Number(editPurchasePrice) || 0,
        selling_price: Number(editSellingPrice) || 0,
        min_stock: Number(editMinStock) || 5,
      });
      setShowEditModal(false);
      setToastMsg("✓ Product details updated");
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to update product"));
    } finally {
      setEditingProduct(false);
    }
  }

  // Delete Product
  async function handleDeleteProduct(p: Product) {
    if (!confirm(`Are you sure you want to deactivate "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      setToastMsg(`✓ Product "${p.name}" deactivated`);
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to delete product"));
    }
  }

  // Export CSV
  function handleExportCSV() {
    const headers = ["Product Name", "SKU", "Category", "Purchase Price", "Selling Price", "Stock", "Stock Value"];
    const rows = filteredProducts.map((p) => {
      const s = Number(p.stocks?.[0]?.current_stock ?? 0);
      const pp = Number(p.purchase_price || 0);
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.category?.name || "—",
        pp,
        p.selling_price,
        s,
        (s * pp).toFixed(2),
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NSYU_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#064E3B] text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. HEADER TITLE & ACTIONS (Matching Specification)             */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-800">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Inventory</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Track stock levels, monitor low stock items, and audit inventory movements.
          </p>
        </div>

        {/* Action Buttons: Stock Movement, Import, Export, Add Product */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openAdjust()}
            className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Stock Movement</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <span className="text-sm font-black">+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SUMMARY METRIC CARDS (Total Products, Total Stock, Low Stock, Out of Stock) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div
          onClick={() => setActiveFilter("All")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "All" ? "border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold">Total Products</div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{totalProducts}</div>
            </div>
          </div>
        </div>

        {/* Total Stock */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold">Total Stock</div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{totalStock.toLocaleString("en-IN")} <span className="text-xs font-normal text-gray-500">units</span></div>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => setActiveFilter("Low Stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "Low Stock" ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-500" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold">Low Stock</div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{lowStockCount}</div>
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setActiveFilter("Out of Stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "Out of Stock" ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-500" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold">Out of Stock</div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{outOfStockCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FILTERS (All Products, Low Stock, Out of Stock, Stock Movement) */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("All")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "All" ? "bg-white text-emerald-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All Products ({totalProducts})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Low Stock")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Low Stock" ? "bg-white text-amber-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Low Stock ({lowStockCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Out of Stock")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Out of Stock" ? "bg-white text-rose-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Stock Movement")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Stock Movement" ? "bg-white text-emerald-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Stock Movement
          </button>
        </div>

        {/* Search input & Category dropdown */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name, SKU or barcode..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {activeFilter !== "Stock Movement" && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none shrink-0"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* 4. INVENTORY TABLE (Columns: Image, SKU, Category, Purchase Price, Selling Price, Stock, Stock Value, Edit/Delete) */}
      {/* ============================================================== */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading inventory...</p>
        </div>
      ) : activeFilter === "Stock Movement" ? (
        /* Stock Movement Audit Table */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Inventory Movement History</h3>
            <span className="text-xs text-gray-500">{filteredMovements.length} logged transaction(s)</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Product Name & SKU</th>
                <th className="p-3">Movement Type</th>
                <th className="p-3 text-center">Quantity</th>
                <th className="p-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No movement records found.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m: any) => {
                  const qty = Number(m.quantity || 0);
                  const isInc = ["opening", "purchase", "customer_return", "transfer_in"].includes((m.type || m.movement_type || "").toLowerCase());
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3 text-gray-500 font-mono text-[11px]">
                        {new Date(m.created_at || m.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{m.product?.name || `Product #${m.product_id}`}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{m.product?.sku || "—"}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                          {m.type || m.movement_type}
                        </span>
                      </td>
                      <td className={`p-3 text-center font-black ${isInc ? "text-emerald-700" : "text-rose-600"}`}>
                        {isInc ? `+${qty}` : `-${qty}`}
                      </td>
                      <td className="p-3 text-gray-600 max-w-xs truncate">
                        {m.notes || m.reference_code || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Inventory Table matching user request */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#064E3B] text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Product Image & Name</th>
                <th className="p-3.5">SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">Purchase Price</th>
                <th className="p-3.5 text-right">Selling Price</th>
                <th className="p-3.5 text-center">Stock</th>
                <th className="p-3.5 text-right">Stock Value</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    No products match the selected inventory filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
                  const purchasePrice = Number(p.purchase_price || 0);
                  const sellingPrice = Number(p.selling_price || 0);
                  const stockValue = Math.max(0, stock) * purchasePrice;
                  const min = Number(p.min_stock ?? 5) || 5;
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= min;
                  const coverImg = (p.images?.find((i) => i.is_primary) || p.images?.[0])?.url;
                  const imgSrc = coverImg ? resolveAssetUrl(coverImg) : null;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition">
                      {/* Product Image & Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                            {imgSrc ? (
                              <img src={imgSrc} alt="" className="w-full h-full object-contain p-1" />
                            ) : (
                              <span className="text-gray-400 font-bold text-xs">{p.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate max-w-xs">{p.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{p.brand || "—"}</div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-3 font-mono text-gray-600 font-semibold">{p.sku}</td>

                      {/* Category */}
                      <td className="p-3 text-gray-600">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">
                          {p.category?.name || "—"}
                        </span>
                      </td>

                      {/* Purchase Price */}
                      <td className="p-3 text-right font-medium text-gray-700">
                        {formatINR(purchasePrice)}
                      </td>

                      {/* Selling Price */}
                      <td className="p-3 text-right font-bold text-gray-900">
                        {formatINR(sellingPrice)}
                      </td>

                      {/* Stock */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                            isOut
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isLow
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {stock} {stock === 1 ? "unit" : "units"}
                        </span>
                      </td>

                      {/* Stock Value */}
                      <td className="p-3 text-right font-black text-emerald-800">
                        {formatINR(stockValue)}
                      </td>

                      {/* Edit / Delete / Adjust Actions */}
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAdjust(p)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition"
                          title="Record Stock Movement"
                        >
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-semibold transition"
                          title="Edit Details"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                          title="Deactivate Product"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODALS: Stock Movement, Add Product, Edit Product, Import    */}
      {/* ============================================================== */}

      {/* Stock Movement / Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-900 text-sm">Stock Movement & Adjustment</h3>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">{selectedProduct.name} ({selectedProduct.sku})</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            {adjustError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleSaveAdjustment} className="space-y-3.5 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-semibold text-gray-600">Current Stock on Hand:</span>
                <span className="font-black text-sm text-gray-900">{Number(selectedProduct.stocks?.[0]?.current_stock ?? 0)} units</span>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Adjustment Reason:</label>
                <select
                  value={adjustReason}
                  onChange={(e: any) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="count">Count Correction (Physical count differs)</option>
                  <option value="damaged">Damaged / Expired (Removes stock)</option>
                  <option value="return">Customer Return (Adds stock back)</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              {adjustReason === "count" && (
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdjustMode("change")}
                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition ${adjustMode === "change" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-500"}`}
                  >
                    Adjust by Delta (+ / -)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("set")}
                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition ${adjustMode === "set" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-500"}`}
                  >
                    Set Counted Total
                  </button>
                </div>
              )}

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  {adjustMode === "set" ? "New Total Counted Quantity:" : "Quantity to Adjust:"}
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder={adjustMode === "set" ? "e.g. 50" : "e.g. 5 or -2"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Audit Notes / Explanation:</label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Annual stock audit verification or damaged box..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {adjustSaving ? "Saving..." : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Add New Product to Inventory</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Wireless Mouse X1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={addSku}
                    onChange={(e) => setAddSku(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Category</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addPurchasePrice}
                    onChange={(e) => setAddPurchasePrice(e.target.value)}
                    placeholder="e.g. 400.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addSellingPrice}
                    onChange={(e) => setAddSellingPrice(e.target.value)}
                    placeholder="e.g. 599.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Min Stock (Reorder)</label>
                  <input
                    type="number"
                    value={addMinStock}
                    onChange={(e) => setAddMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Opening Stock</label>
                  <input
                    type="number"
                    value={addOpeningStock}
                    onChange={(e) => setAddOpeningStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingProduct}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {addingProduct ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Edit Product Information</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Reorder Level (Min Stock)</label>
                <input
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingProduct}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {editingProduct ? "Updating..." : "Update Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Bulk Import Inventory CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <p className="text-xs text-gray-500">
              Upload your CSV file containing columns: Name, SKU, Category, Selling Price, Purchase Price, Stock.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importProductsApi({ file, shopId: shopId || undefined });
                  alert("Inventory CSV imported successfully!");
                  setShowImportModal(false);
                  loadData();
                } catch (err: any) {
                  alert(apiErrorMessage(err, "Import failed"));
                }
              }}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
            />
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
