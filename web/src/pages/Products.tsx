import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  importProductsApi,
  previewImportProductsApi,
  type ImportPreviewResult,
} from "../api/products";
import { listCategories, createCategory } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import ProductPhotos from "../components/ProductPhotos";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import { byRecentChange } from "../utils/productRecency";
import RequireModule from "../components/RequireModule";
import type { Category, Product } from "../types";

// Helper for formatting INR currency without decimals if whole
/** The product's cover photo (or its first photo), if it has any. */
function coverOf(p: Product): string | null {
  const imgs = p.images || [];
  return (imgs.find((i) => i.is_primary) || imgs[0])?.url || null;
}

function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null) return "—";
  return "₹ " + Number(amount).toLocaleString("en-IN");
}

// Product Device Icons matching the screenshot thumbnails
function ProductThumbnail({ name, category, imageUrl }: { name: string; category?: string; imageUrl?: string | null }) {
  const src = resolveAssetUrl(imageUrl);
  if (src) {
    return <img src={src} alt="" loading="lazy" className="w-10 h-10 rounded-xl object-cover ring-1 ring-border bg-slate-100 shrink-0" />;
  }
  const lower = (name + " " + (category || "")).toLowerCase();

  if (lower.includes("iphone") || lower.includes("samsung") || lower.includes("phone")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-navy-800 to-navy-950 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      </div>
    );
  }
  if (lower.includes("laptop") || lower.includes("inspiron") || lower.includes("pavilion")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>
    );
  }
  if (lower.includes("earbud") || lower.includes("headphone") || lower.includes("audio")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-xs border border-slate-300/60">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      </div>
    );
  }
  if (lower.includes("watch")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="7" />
          <polyline points="12 9 12 12 13.5 13.5" />
          <path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83" />
        </svg>
      </div>
    );
  }
  if (lower.includes("cable") || lower.includes("hdmi")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-zinc-600 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
          <path d="M2 20h20" />
          <line x1="14" y1="10" x2="14" y2="10.01" />
          <line x1="10" y1="10" x2="10" y2="10.01" />
        </svg>
      </div>
    );
  }
  if (lower.includes("power") || lower.includes("bank")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-zinc-700 to-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M11 7h2" />
          <path d="M10 11l4 0" />
        </svg>
      </div>
    );
  }
  if (lower.includes("speaker")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-neutral-800 to-neutral-950 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <circle cx="12" cy="14" r="4" />
          <line x1="12" y1="6" x2="12.01" y2="6" />
        </svg>
      </div>
    );
  }
  if (lower.includes("monitor")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-800 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    </div>
  );
}

function ProductsInner() {
  const shopId = useAuthStore((s) => s.shopId);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockStatusFilter, setStockStatusFilter] = useState("All");

  // Pagination & Sorting
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  // Default: most recently added / edited / restocked products on top.
  const [sortField, setSortField] = useState<string>("recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Import Modal states
  const [importStep, setImportStep] = useState<"upload" | "preview" | "success">("upload");
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [importCsvText, setImportCsvText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"all" | "new" | "price_change" | "existing" | "duplicate" | "invalid">("all");
  const [importMarginPercent, setImportMarginPercent] = useState<number>(20);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [updatePurchasePrice, setUpdatePurchasePrice] = useState<boolean>(true);
  const [updateSellingPrice, setUpdateSellingPrice] = useState<boolean>(false);

  async function handleAnalyze(fileToAnalyze?: File, textToAnalyze?: string) {
    const file = fileToAnalyze !== undefined ? fileToAnalyze : importFile;
    const text = textToAnalyze !== undefined ? textToAnalyze : importCsvText;

    if (!file && !text?.trim()) {
      setImportError("Please select an Excel/CSV file or paste CSV text first.");
      return;
    }

    setAnalyzing(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const res = await previewImportProductsApi({
        file: file || undefined,
        csvText: !file && text ? text : undefined,
        shopId: shopId || 1,
        defaultMarginPercent: importMarginPercent,
        defaultBrand: "ERD",
      });

      if (res.data.success && res.data.data) {
        setPreviewResult(res.data.data);
        setImportStep("preview");
      } else {
        setImportError(res.data.message || "Failed to analyze spreadsheet");
      }
    } catch (err: any) {
      setImportError(apiErrorMessage(err, "Failed to analyze spreadsheet"));
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileSelected(file: File) {
    setImportFile(file);
    setImportFileName(file.name);
    setImportCsvText("");
    setImportError(null);
    handleAnalyze(file, "");
  }

  async function handleConfirmImport() {
    if (!previewResult || previewResult.items.length === 0) {
      setImportError("No parsed items available to import.");
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const res = await importProductsApi({
        items: previewResult.items,
        shopId: shopId || 1,
        updateExisting,
        updatePurchasePrice,
        updateSellingPrice,
        defaultMarginPercent: importMarginPercent,
      });

      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setImportSuccess(
          `Successfully imported ${d.total} products: ${d.created} new created, ${d.updated} updated (${d.priceChanges} purchase price updates recorded) across ${d.categories} categories.`
        );
        setImportStep("success");
        loadData();
      } else {
        setImportError(res.data.message || "Import execution failed");
      }
    } catch (err: any) {
      setImportError(apiErrorMessage(err, "Failed to import products"));
    } finally {
      setImporting(false);
    }
  }

  function resetImportState() {
    setShowImportModal(false);
    setImportStep("upload");
    setImportFile(null);
    setImportFileName("");
    setImportCsvText("");
    setPreviewResult(null);
    setImportError(null);
    setImportSuccess(null);
  }

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category_id: "",
    brand: "",
    purchase_price: "",
    margin_amount: "",
    selling_price: "",
    mrp: "",
    min_stock: "5",
    opening_stock: "10",
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function handlePurchasePriceChange(val: string) {
    const pPrice = parseFloat(val) || 0;
    const margin = parseFloat(form.margin_amount) || 0;
    const calcSelling = pPrice > 0 || margin > 0 ? (pPrice + margin).toFixed(2) : "";
    setForm((prev) => ({
      ...prev,
      purchase_price: val,
      selling_price: calcSelling || prev.selling_price,
    }));
  }

  function handleMarginChange(val: string) {
    const pPrice = parseFloat(form.purchase_price) || 0;
    const margin = parseFloat(val) || 0;
    const calcSelling = (pPrice + margin).toFixed(2);
    setForm((prev) => ({
      ...prev,
      margin_amount: val,
      selling_price: calcSelling,
    }));
  }

  // Load Data
  function loadData() {
    setLoading(true);
    Promise.all([listProducts(), listCategories()])
      .then(([pRes, cRes]) => {
        setProducts(pRes.data.data ?? []);
        setCategories(cRes.data.data ?? []);
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load products")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [shopId]);

  // View mode (grid vs list matching Image 2)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Live Category Creation State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryStatus, setNewCategoryStatus] = useState<"active" | "inactive">("active");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const addItemToCart = usePosStore((s) => s.addItem);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  function handleAddToCart(p: Product) {
    addItemToCart(p, 1);
    setToastMsg(`✓ Added "${p.name}" to cart`);
  }

  // Filter & Search Logic
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search by name, SKU, or barcode
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode) return false;
      }

      // Category filter
      if (categoryFilter !== "All" && p.category?.name !== categoryFilter) {
        return false;
      }

      // Status & Stock filter
      if (stockStatusFilter === "Live" && p.status !== "active") return false;
      if (stockStatusFilter === "Offline" && p.status === "active") return false;
      const stock = p.stocks?.[0]?.current_stock ?? 0;
      if (stockStatusFilter === "In Stock" && stock <= 0) return false;
      if (stockStatusFilter === "Low Stock" && (stock > (Number(p.min_stock ?? 5) || 5) || stock <= 0)) return false;
      if (stockStatusFilter === "Out of Stock" && stock > 0) return false;

      return true;
    });
  }, [products, searchQuery, categoryFilter, stockStatusFilter]);

  // Sorting
  const sortedProducts = useMemo(() => {
    if (sortField === "recent") return [...filteredProducts].sort(byRecentChange);
    return [...filteredProducts].sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];

      if (sortField === "stock") {
        valA = a.stocks?.[0]?.current_stock ?? 0;
        valB = b.stocks?.[0]?.current_stock ?? 0;
      } else if (sortField === "category") {
        valA = a.category?.name || "";
        valB = b.category?.name || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + pageSize);

  // Stock Metrics Calculation
  // Real counts from the loaded catalog (low stock uses the product's minimum, default 5 like the API).
  const stockOf = (p: (typeof products)[number]) => Number(p.stocks?.[0]?.current_stock ?? 0);
  const minOf = (p: (typeof products)[number]) => Number(p.min_stock ?? 5) || 5;
  const totalCount = products.length;
  const liveCount = products.filter((p) => p.status === "active").length;
  const offlineCount = products.filter((p) => p.status !== "active").length;
  const lowStockCount = products.filter((p) => stockOf(p) > 0 && stockOf(p) <= minOf(p)).length;
  const outOfStockCount = products.filter((p) => stockOf(p) <= 0).length;

  // Handle Sort Click
  // Header click cycles: A→Z, Z→A, then back to "recently changed first".
  function handleSort(field: string) {
    if (sortField === field && sortOrder === "desc") {
      setSortField("recent");
      setSortOrder("desc");
    } else if (sortField === field) {
      setSortOrder("desc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  // Export CSV
  function handleExportCSV() {
    const headers = ["Product Name", "SKU", "Category", "Brand", "Purchase Price", "Selling Price", "Current Stock", "Status"];
    const rows = sortedProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      p.category?.name || "—",
      p.brand || "—",
      p.purchase_price,
      p.selling_price,
      p.stocks?.[0]?.current_stock ?? 0,
      p.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NSY_Products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Open Edit Modal
  function openEdit(p: Product) {
    setActiveProduct(p);
    const pPrice = Number(p.purchase_price || 0);
    const sPrice = Number(p.selling_price || 0);
    const derivedMargin = sPrice >= pPrice ? (sPrice - pPrice).toFixed(2) : "0.00";
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      category_id: p.category_id ? String(p.category_id) : "",
      brand: p.brand || "",
      purchase_price: String(p.purchase_price || 0),
      margin_amount: derivedMargin,
      selling_price: String(p.selling_price || 0),
      mrp: String(p.mrp || 0),
      min_stock: String(p.min_stock || 5),
      opening_stock: String(p.stocks?.[0]?.current_stock || 0),
    });
    setModalError(null);
    setShowEditModal(true);
  }

  // Save Edit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProduct) return;
    setSaving(true);
    setModalError(null);
    try {
      await updateProduct(activeProduct.id, {
        name: form.name,
        barcode: form.barcode || undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        brand: form.brand || undefined,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        mrp: Number(form.mrp) || 0,
        min_stock: Number(form.min_stock) || 0,
      });
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setModalError(apiErrorMessage(err, "Failed to update product"));
    } finally {
      setSaving(false);
    }
  }

  // Open Create Modal
  function openCreate() {
    setForm({
      name: "",
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      barcode: "",
      category_id: categories[0]?.id ? String(categories[0].id) : "",
      brand: "",
      purchase_price: "",
      margin_amount: "",
      selling_price: "",
      mrp: "",
      min_stock: "5",
      opening_stock: "10",
    });
    setModalError(null);
    setShowAddModal(true);
  }

  // "Add Product" from the Sales screen links here with ?add=1: open the form once the catalog has loaded.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (loading || searchParams.get("add") !== "1") return;
    openCreate();
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  // Live Category Creation Action
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    setCategoryError(null);
    try {
      const res = await createCategory(newCategoryName.trim(), newCategoryStatus);
      const created = res.data?.data;
      if (created) {
        setCategories((prev) => [...prev, created]);
        setCategoryFilter(created.name);
        setForm((prev) => ({ ...prev, category_id: String(created.id) }));
        setToastMsg(`✓ Category "${created.name}" created successfully (${newCategoryStatus === "active" ? "Live" : "Offline"})`);
      } else {
        loadData();
      }
      setShowAddCategoryModal(false);
      setNewCategoryName("");
      setNewCategoryStatus("active");
    } catch (err: any) {
      setCategoryError(apiErrorMessage(err, "Failed to create category"));
    } finally {
      setCreatingCategory(false);
    }
  }

  // Save Create
  async function handleSaveCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      await createProduct({
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        brand: form.brand || undefined,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        mrp: Number(form.mrp) || 0,
        min_stock: Number(form.min_stock) || 5,
        opening_stock: shopId && form.opening_stock ? { shopId, quantity: Number(form.opening_stock) } : undefined,
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setModalError(apiErrorMessage(err, "Failed to create product"));
    } finally {
      setSaving(false);
    }
  }

  // Delete Action
  async function handleConfirmDelete() {
    if (!activeProduct) return;
    setSaving(true);
    try {
      await deleteProduct(activeProduct.id);
      setShowDeleteModal(false);
      loadData();
    } catch (err) {
      setModalError(apiErrorMessage(err, "Failed to delete product"));
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white px-4 py-2.5 rounded-xl shadow-pop ring-1 ring-white/10 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. HEADER (Matching Image 2)                                   */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-800">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h1 className="page-title">Products</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage your products, update prices and stock, and keep your catalog up to date.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <span className="text-sm font-black">+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SUMMARY METRICS CARDS (Matching Image 2)                    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div
          onClick={() => { setStockStatusFilter("All"); setCurrentPage(1); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-card hover:shadow-lift hover:-translate-y-0.5 min-w-0 ${
            stockStatusFilter === "All" ? "border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">Total Products</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">{totalCount}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                  {liveCount} Live
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                  {offlineCount} Offline
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* In Stock */}
        <div
          onClick={() => { setStockStatusFilter("In Stock"); setCurrentPage(1); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-card hover:shadow-lift hover:-translate-y-0.5 min-w-0 ${
            stockStatusFilter === "In Stock" ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">In Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">{totalCount - outOfStockCount}</div>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => { setStockStatusFilter("Low Stock"); setCurrentPage(1); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-card hover:shadow-lift hover:-translate-y-0.5 min-w-0 ${
            stockStatusFilter === "Low Stock" ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-500" : "border-slate-200"
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
              <div className="text-xs text-slate-500 font-bold">Low Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">{lowStockCount}</div>
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => { setStockStatusFilter("Out of Stock"); setCurrentPage(1); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-card hover:shadow-lift hover:-translate-y-0.5 min-w-0 ${
            stockStatusFilter === "Out of Stock" ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-500" : "border-slate-200"
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
              <div className="text-xs text-slate-500 font-bold">Out of Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">{outOfStockCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SEARCH & FILTERS BAR (Matching Image 2)                     */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search product by name, SKU or barcode..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Filters & View Toggles */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 max-w-full">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="min-w-0 max-w-[60vw] sm:max-w-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddCategoryModal(true)}
              className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#047857] font-bold rounded-xl text-xs border border-emerald-200 transition shadow-2xs flex items-center gap-1"
              title="Add a new product category live"
            >
              <span>+</span>
              <span>Category</span>
            </button>
          </div>

          <select
            value={stockStatusFilter}
            onChange={(e) => { setStockStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Live">Live (Active)</option>
            <option value="Offline">Offline (Inactive)</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition ${viewMode === "grid" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
              title="Grid View"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition ${viewMode === "list" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
              title="List View"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3.5. HORIZONTAL SCROLLABLE CATEGORY NAVIGATION (Mobile-First)   */}
      {/* ============================================================== */}
      <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          onClick={() => { setCategoryFilter("All"); setCurrentPage(1); }}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            categoryFilter === "All"
              ? "bg-[#064E3B] text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          All Items ({products.length})
        </button>
        {categories.map((c) => {
          const count = products.filter((p) => p.category?.name === c.name).length;
          const isActive = categoryFilter === c.name;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCategoryFilter(c.name); setCurrentPage(1); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#064E3B] text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 font-semibold"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 4. PRODUCTS PRESENTATION (2-Column Grid on Mobile vs List)      */}
      {/* ============================================================== */}
      {loading && products.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 mt-2 font-medium">Loading products...</p>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
            🛍️
          </div>
          <h3 className="text-sm font-bold text-slate-900">No products match your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try resetting filters or adding new products to your catalog.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* 2-Column Grid on Mobile, Scaling to 5-Column on Desktop */
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {paginatedProducts.map((p) => {
            const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
            const coverImg = coverOf(p);
            const isOutOfStock = stock <= 0;
            const isLowStock = stock > 0 && stock <= (Number(p.min_stock ?? 5) || 5);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition p-2.5 sm:p-3 flex flex-col justify-between group relative"
              >
                <div className="cursor-pointer" onClick={() => setQuickViewProduct(p)}>
                  {/* Image Container with Top-Right Status Badge */}
                  <div className="w-full aspect-square max-h-36 sm:h-32 bg-slate-50/70 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                    {/* Status Badge in top right */}
                    <div className="absolute top-1.5 right-1.5 z-10">
                      <span
                        className={`text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                          isOutOfStock
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : isLowStock
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {isOutOfStock ? "Out" : isLowStock ? "Low" : "In Stock"}
                      </span>
                    </div>

                    {coverImg ? (
                      <img src={resolveAssetUrl(coverImg) || ""} alt={p.name} className="h-full object-contain p-2 group-hover:scale-105 transition-transform" />
                    ) : (
                      <ProductThumbnail name={p.name} category={p.category?.name} />
                    )}
                  </div>

                  {/* Title & SKU */}
                  <h3 className="font-bold text-[12px] sm:text-xs text-slate-900 line-clamp-2 min-h-[30px] sm:min-h-[32px] group-hover:text-emerald-800 transition">
                    {p.name}
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    SKU: {p.sku}
                  </div>

                  {/* Price & Stock */}
                  <div className="mt-1.5 flex items-baseline justify-between flex-wrap gap-1">
                    <div className="text-xs sm:text-sm font-black text-slate-900 tabular">
                      ₹{Number(p.selling_price).toFixed(2)}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <span>Stock: {stock}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar: Full Width Add to Cart */}
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleAddToCart(p)}
                    className="w-full py-1.5 sm:py-2 bg-[#047857] hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-[11px] sm:text-xs transition shadow-xs flex items-center justify-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                    </svg>
                    <span>+ Cart</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* List View (Desktop Table) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th className="p-3 cursor-pointer hover:text-emerald-800" onClick={() => handleSort("name")}>Product</th>
                <th className="p-3 cursor-pointer hover:text-emerald-800" onClick={() => handleSort("sku")}>SKU</th>
                <th className="p-3 cursor-pointer hover:text-emerald-800" onClick={() => handleSort("category")}>Category</th>
                <th className="p-3 text-right cursor-pointer hover:text-emerald-800" onClick={() => handleSort("purchase_price")}>Cost</th>
                <th className="p-3 text-right cursor-pointer hover:text-emerald-800" onClick={() => handleSort("selling_price")}>Selling Price</th>
                <th className="p-3 text-center cursor-pointer hover:text-emerald-800" onClick={() => handleSort("stock")}>Stock</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map((p) => {
                const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
                const isOutOfStock = stock <= 0;
                const isLowStock = stock > 0 && stock <= (Number(p.min_stock ?? 5) || 5);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.brand || "—"}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                    <td className="p-3 text-slate-600">{p.category?.name || "—"}</td>
                    <td className="p-3 text-right font-medium text-slate-600">₹{Number(p.purchase_price || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-black text-slate-900">₹{Number(p.selling_price).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        isOutOfStock ? "bg-rose-50 text-rose-700" : isLowStock ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {stock} units
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition"
                      >
                        Add to Cart
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Products List */}
        <div className="md:hidden space-y-3">
          {paginatedProducts.map((p) => {
            const stock = Number((p as any).current_stock ?? p.stocks?.[0]?.current_stock ?? 0);
            const isOutOfStock = stock <= 0;
            const isLowStock = stock > 0 && stock <= (Number(p.min_stock ?? 5) || 5);
            const primaryImg = p.images?.find((i) => i.is_primary)?.url || p.images?.[0]?.url;
            const img = primaryImg ? resolveAssetUrl(primaryImg) : null;

            return (
              <div key={p.id} className="mobile-card flex flex-col gap-2.5">
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => setQuickViewProduct(p)}
                    className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                  >
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <span className="text-slate-400 font-bold text-sm">{p.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.category?.name || "General"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate">{p.sku}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickViewProduct(p)}
                      className="text-[13.5px] font-bold text-navy-900 leading-snug text-left line-clamp-2"
                    >
                      {p.name}
                    </button>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-emerald-800 tabular">₹{Number(p.selling_price).toFixed(2)}</div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isOutOfStock ? "bg-rose-50 text-rose-700" : isLowStock ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                    }`}>
                      {stock} units
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className={`text-[11px] font-bold ${p.status === "active" ? "text-emerald-700" : "text-slate-400"}`}>
                    ● {p.status === "active" ? "Active" : "Draft"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
                    >
                      + Cart
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} products
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-slate-700">{currentPage} / {totalPages}</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Quick View Product Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop animate-scale-in max-h-[92dvh] overflow-y-auto border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">Product Overview</h3>
              <button onClick={() => setQuickViewProduct(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Name</span>
                <span className="font-bold text-slate-900 text-sm">{quickViewProduct.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">SKU</span>
                  <span className="font-mono font-bold text-slate-800">{quickViewProduct.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Barcode</span>
                  <span className="font-mono font-bold text-slate-800">{quickViewProduct.barcode || "—"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Selling Price</span>
                  <span className="font-black text-emerald-800 text-base">₹{Number(quickViewProduct.selling_price).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stock</span>
                  <span className="font-black text-slate-900 text-base">{Number(quickViewProduct.stocks?.[0]?.current_stock ?? 0)} units</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const p = quickViewProduct;
                  setQuickViewProduct(null);
                  openEdit(p);
                }}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddToCart(quickViewProduct);
                  setQuickViewProduct(null);
                }}
                className="px-4 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ============================================================== */}
      {/* 6. MODALS (Add, Edit, View, Delete, Import)                    */}
      {/* ============================================================== */}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="text-lg font-bold">+</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Add New Product</h3>
                  <p className="text-xs text-slate-400">Fill in the product details and opening stock</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-600">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. iPhone 15 Pro Max"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Optional barcode"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Apple, Samsung"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(e) => handlePurchasePriceChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Margin Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.margin_amount}
                    onChange={(e) => handleMarginChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-emerald-700 bg-emerald-50/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Selling Price (₹) *
                    </label>
                    <span className="text-[10px] text-blue-600 font-medium">Purchase + Margin</span>
                  </div>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 bg-blue-50/40 font-semibold text-blue-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Stock (Units)
                  </label>
                  <input
                    type="number"
                    value={form.opening_stock}
                    onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Creating…" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Edit Product: {activeProduct.name}</h3>
                  <p className="text-xs text-slate-400">Update pricing and product details</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-600">
                  {modalError}
                </div>
              )}

              {activeProduct && (
                <div className="rounded-xl border border-border p-3">
                  <div className="label !mb-2">Photos</div>
                  <ProductPhotos
                    compact
                    productId={activeProduct.id}
                    images={activeProduct.images || []}
                    onChange={(images) => {
                      setActiveProduct((p) => (p ? { ...p, images } : p));
                      setProducts((list) => list.map((x) => (x.id === activeProduct.id ? { ...x, images } : x)));
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(e) => handlePurchasePriceChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Margin Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.margin_amount}
                    onChange={(e) => handleMarginChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-emerald-700 bg-emerald-50/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Selling Price (₹)</label>
                    <span className="text-[10px] text-blue-600 font-medium">Purchase + Margin</span>
                  </div>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 bg-blue-50/40 font-semibold text-blue-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Stock Alert</label>
                  <input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Update Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRODUCT MODAL */}
      {showViewModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <ProductThumbnail name={activeProduct.name} category={activeProduct.category?.name} imageUrl={coverOf(activeProduct)} />
                <div>
                  <h3 className="text-base font-bold text-slate-800">{activeProduct.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{activeProduct.sku}</p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Category</span>
                  <span className="font-semibold text-slate-800">{activeProduct.category?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Brand</span>
                  <span className="font-semibold text-slate-800">{activeProduct.brand || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Purchase Price</span>
                  <span className="font-semibold text-slate-800">{formatINR(activeProduct.purchase_price)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Selling Price</span>
                  <span className="font-semibold text-blue-600">{formatINR(activeProduct.selling_price)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Current Stock</span>
                  <span className="font-bold text-emerald-600">
                    {activeProduct.stocks?.[0]?.current_stock ?? 0} units
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Profit Margin</span>
                  <span className="font-semibold text-emerald-600">
                    {formatINR(Number(activeProduct.selling_price) - Number(activeProduct.purchase_price))}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Deactivate Product?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to deactivate <strong className="text-slate-700">{activeProduct.name}</strong>?
                This preserves inventory history and reports while hiding it from active POS billing.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                {saving ? "Deleting…" : "Confirm Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-pop border border-border w-full max-w-4xl overflow-hidden animate-scale-in p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  📥
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Import Products (.csv, .xlsx, .xls)</h3>
                  <p className="text-xs text-slate-500">
                    Preview, validate, match against database, and import wholesale catalogs or ERD order sheets safely
                  </p>
                </div>
              </div>
              <button
                onClick={resetImportState}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span>{importError}</span>
              </div>
            )}

            {/* STEP 1: UPLOAD */}
            {importStep === "upload" && (
              <div className="space-y-4">
                {/* Mode Switcher */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setImportMode("file")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        importMode === "file" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      📁 Upload File (.csv, .xlsx, .xls)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode("paste")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        importMode === "paste" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      📋 Paste CSV / Spreadsheet Rows
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-slate-500">Default Markup:</label>
                    <select
                      value={importMarginPercent}
                      onChange={(e) => setImportMarginPercent(Number(e.target.value))}
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                    >
                      <option value={15}>15% Margin</option>
                      <option value={20}>20% Margin</option>
                      <option value={25}>25% Margin</option>
                      <option value={30}>30% Margin</option>
                    </select>
                  </div>
                </div>

                {/* Upload or Paste Area */}
                {importMode === "file" ? (
                  <div
                    onClick={() => document.getElementById("csv-file-input")?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/20 cursor-pointer transition-all"
                  >
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelected(file);
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto mb-2.5 flex items-center justify-center text-xl">
                      📊
                    </div>
                    <span className="text-sm text-emerald-800 font-bold block">
                      {importFileName ? `Selected: ${importFileName}` : "Click to browse or drop CSV / Excel file here"}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports Excel (.xlsx, .xls) and CSV (.csv) catalogs or ERD order sheets
                    </p>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={importCsvText}
                      onChange={(e) => setImportCsvText(e.target.value)}
                      placeholder="Paste CSV rows here (e.g. Product Name, SKU, Category, Brand, Purchase Price, Selling Price)..."
                      rows={6}
                      className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-emerald-500 focus:bg-white resize-none"
                    />
                  </div>
                )}

                {/* Action button to analyze */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={resetImportState}
                    disabled={analyzing}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnalyze()}
                    disabled={analyzing || (!importFile && !importCsvText.trim())}
                    className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      analyzing || (!importFile && !importCsvText.trim())
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>Analyzing & Matching Catalog...</span>
                      </>
                    ) : (
                      <span>Analyze & Preview Catalog →</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PREVIEW */}
            {importStep === "preview" && previewResult && (
              <div className="space-y-4">
                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div
                    onClick={() => setPreviewFilter("all")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "all" ? "bg-slate-100 border-slate-400 shadow-xs" : "bg-slate-50 border-slate-200 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Rows</div>
                    <div className="text-lg font-bold text-slate-800">{previewResult.summary.total}</div>
                  </div>

                  <div
                    onClick={() => setPreviewFilter("new")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "new" ? "bg-emerald-100/60 border-emerald-500 shadow-xs" : "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase">New Products</div>
                    <div className="text-lg font-bold text-emerald-700">{previewResult.summary.newCount}</div>
                  </div>

                  <div
                    onClick={() => setPreviewFilter("price_change")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "price_change" ? "bg-amber-100/60 border-amber-500 shadow-xs" : "bg-amber-50/50 border-amber-200 hover:bg-amber-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-amber-700 uppercase">Price Changes</div>
                    <div className="text-lg font-bold text-amber-700">{previewResult.summary.priceChangeCount}</div>
                  </div>

                  <div
                    onClick={() => setPreviewFilter("existing")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "existing" ? "bg-sky-100/60 border-sky-500 shadow-xs" : "bg-sky-50/50 border-sky-200 hover:bg-sky-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-sky-700 uppercase">Existing</div>
                    <div className="text-lg font-bold text-sky-700">{previewResult.summary.existingCount}</div>
                  </div>

                  <div
                    onClick={() => setPreviewFilter("duplicate")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "duplicate" ? "bg-sky-100/60 border-sky-500 shadow-xs" : "bg-sky-50/50 border-sky-200 hover:bg-sky-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-sky-700 uppercase">Duplicates</div>
                    <div className="text-lg font-bold text-sky-700">{previewResult.summary.duplicateCount}</div>
                  </div>

                  <div
                    onClick={() => setPreviewFilter("invalid")}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      previewFilter === "invalid" ? "bg-rose-100/60 border-rose-500 shadow-xs" : "bg-rose-50/50 border-rose-200 hover:bg-rose-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-rose-700 uppercase">Invalid</div>
                    <div className="text-lg font-bold text-rose-700">{previewResult.summary.invalidCount}</div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("all")}
                    className={`px-3 py-1 font-semibold rounded-lg ${
                      previewFilter === "all" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    All ({previewResult.summary.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("new")}
                    className={`px-3 py-1 font-semibold rounded-lg ${
                      previewFilter === "new" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    New ({previewResult.summary.newCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("price_change")}
                    className={`px-3 py-1 font-semibold rounded-lg ${
                      previewFilter === "price_change" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Price Changes ({previewResult.summary.priceChangeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("existing")}
                    className={`px-3 py-1 font-semibold rounded-lg ${
                      previewFilter === "existing" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Existing ({previewResult.summary.existingCount})
                  </button>
                  {previewResult.summary.duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("duplicate")}
                      className={`px-3 py-1 font-semibold rounded-lg ${
                        previewFilter === "duplicate" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Duplicates ({previewResult.summary.duplicateCount})
                    </button>
                  )}
                  {previewResult.summary.invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("invalid")}
                      className={`px-3 py-1 font-semibold rounded-lg ${
                        previewFilter === "invalid" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Invalid ({previewResult.summary.invalidCount})
                    </button>
                  )}
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold z-10">
                      <tr>
                        <th className="py-2 px-2.5 border-b border-slate-200">#</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">Status</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">SKU / Code</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">Product Name</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">Category</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">Brand</th>
                        <th className="py-2 px-2.5 border-b border-slate-200 text-right">Wholesale ₹</th>
                        <th className="py-2 px-2.5 border-b border-slate-200 text-right">Selling ₹</th>
                        <th className="py-2 px-2.5 border-b border-slate-200">Details / Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {previewResult.items
                        .filter((item) => {
                          if (previewFilter === "all") return true;
                          return item.status === previewFilter;
                        })
                        .map((item, idx) => {
                          const isPriceDiff = item.status === "price_change";
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50 ${
                                item.status === "invalid"
                                  ? "bg-rose-50/40"
                                  : item.status === "duplicate"
                                  ? "bg-sky-50/30"
                                  : item.status === "price_change"
                                  ? "bg-amber-50/30"
                                  : ""
                              }`}
                            >
                              <td className="py-1.5 px-2.5 text-slate-400 font-mono">{item.rowIndex}</td>
                              <td className="py-1.5 px-2.5">
                                {item.status === "new" && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                                    + New
                                  </span>
                                )}
                                {item.status === "existing" && (
                                  <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold text-[10px]">
                                    ✓ Match
                                  </span>
                                )}
                                {item.status === "price_change" && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                                    ⚡ Price Diff
                                  </span>
                                )}
                                {item.status === "duplicate" && (
                                  <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold text-[10px]">
                                    🔁 Duplicate
                                  </span>
                                )}
                                {item.status === "invalid" && (
                                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[10px]">
                                    ✕ Invalid
                                  </span>
                                )}
                                {item.status === "ambiguous" && (
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold text-[10px]">
                                    ❓ Ambiguous
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-800">{item.sku || "—"}</td>
                              <td className="py-1.5 px-2.5 truncate max-w-xs">{item.name || "—"}</td>
                              <td className="py-1.5 px-2.5">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5">{item.brand || "—"}</td>
                              <td className="py-1.5 px-2.5 text-right font-medium">
                                {isPriceDiff ? (
                                  <span>
                                    <span className="line-through text-slate-400 mr-1">₹{item.oldPurchasePrice}</span>
                                    <span className="font-bold text-amber-700">₹{item.newPurchasePrice}</span>
                                  </span>
                                ) : (
                                  `₹${item.purchase_price}`
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600">
                                ₹{item.selling_price || "—"}
                              </td>
                              <td className="py-1.5 px-2.5 text-[10px] text-slate-500 truncate max-w-xs">
                                {item.validationError ? (
                                  <span className="text-rose-600 font-medium">{item.validationError}</span>
                                ) : item.ambiguityReason ? (
                                  <span className="text-orange-600 font-medium">{item.ambiguityReason}</span>
                                ) : item.matchedProductId ? (
                                  <span>Matched via {item.matchTier} (ID #{item.matchedProductId})</span>
                                ) : (
                                  <span className="text-slate-400">Will be created as new product</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Import Invariant Options */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <span className="font-medium text-slate-700">Update existing products</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updatePurchasePrice}
                        disabled={!updateExisting}
                        onChange={(e) => setUpdatePurchasePrice(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <span className="font-medium text-slate-700">Update purchase prices</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateSellingPrice}
                        disabled={!updateExisting}
                        onChange={(e) => setUpdateSellingPrice(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <span className="font-medium text-slate-700">Update selling prices</span>
                      <span className="text-[10px] text-slate-400">(Preserved by default)</span>
                    </label>
                  </div>

                  <div className="text-[11px] text-slate-500 italic">
                    ℹ️ Inventory stock is preserved without artificial inflation.
                  </div>
                </div>

                {/* Confirm Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setImportStep("upload")}
                    disabled={importing}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1"
                  >
                    ← Back to Upload
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetImportState}
                      disabled={importing}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={
                        importing ||
                        previewResult.items.filter((i) => i.status !== "invalid" && !i.isDuplicateInFile).length === 0
                      }
                      className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                        importing ||
                        previewResult.items.filter((i) => i.status !== "invalid" && !i.isDuplicateInFile).length === 0
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {importing ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span>Importing Products...</span>
                        </>
                      ) : (
                        <span>
                          Confirm & Import{" "}
                          {previewResult.items.filter((i) => i.status !== "invalid" && !i.isDuplicateInFile).length} Products
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {importStep === "success" && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
                  ✓
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Products Imported Successfully</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{importSuccess}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportStep("upload");
                      setImportFile(null);
                      setImportFileName("");
                      setImportCsvText("");
                      setPreviewResult(null);
                      setImportSuccess(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Import Another File
                  </button>
                  <button
                    type="button"
                    onClick={resetImportState}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                  >
                    Close & View Catalog
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* LIVE ADD CATEGORY MODAL                                        */}
      {/* ============================================================== */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[92dvh] overflow-y-auto shadow-pop border border-border space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
                  +
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Add Product Category</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Create a category live and manage catalog visibility.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {categoryError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Wireless Audio, Smart Watches..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-900"
                />
              </div>

              {/* Live Status ON / OFF Option */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">Live Status (Visible on Storefront)</div>
                  <div className="text-[11px] text-slate-500">
                    {newCategoryStatus === "active" ? "Category is Live & visible immediately" : "Hidden in catalog until turned Live"}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={newCategoryStatus === "active"}
                  onClick={() => setNewCategoryStatus(newCategoryStatus === "active" ? "inactive" : "active")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    newCategoryStatus === "active" ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      newCategoryStatus === "active" ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="px-5 py-2 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  {creatingCategory ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    <span>Add Category</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function Products() {
  return (
    <RequireModule module="products">
      <ProductsInner />
    </RequireModule>
  );
}
