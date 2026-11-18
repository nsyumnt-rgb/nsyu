import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  importProductsApi,
  previewImportProductsApi,
  type ImportPreviewResult,
} from "../api/products";
import { listCategories } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import ProductPhotos from "../components/ProductPhotos";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Category, Product } from "../types";
import { EmptyState, Icon, Meter, PageHeader, Pagination, SearchInput, Segmented, StatCard, type IconName } from "../components/ui";

function IconBtn({ title, icon, onClick, tone }: { title: string; icon: IconName; onClick: () => void; tone?: "brand" | "rose" }) {
  const t = tone === "brand" ? "text-brand-600 hover:bg-brand-50 hover:border-brand-200" : tone === "rose" ? "text-rose-600 hover:bg-rose-50 hover:border-rose-200" : "text-slate-500 hover:bg-slate-50 hover:text-navy-900";
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`w-8 h-8 rounded-lg border border-transparent flex items-center justify-center transition ${t}`}>
      <Icon name={icon} className="w-4 h-4" />
    </button>
  );
}

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
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-indigo-900 text-white flex items-center justify-center shrink-0 shadow-xs">
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
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-800 text-white flex items-center justify-center shrink-0 shadow-xs">
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
  const [brandFilter, setBrandFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stockStatusFilter, setStockStatusFilter] = useState("All");

  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");

  // Pagination & Sorting
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

  // Derived Unique Brands
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand?.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands);
  }, [products]);

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

      // Brand filter
      if (brandFilter !== "All" && p.brand !== brandFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "All" && p.status !== statusFilter.toLowerCase()) {
        return false;
      }

      // Stock Status filter
      const stock = p.stocks?.[0]?.current_stock ?? 0;
      if (stockStatusFilter === "In Stock" && stock <= 0) return false;
      if (stockStatusFilter === "Low Stock" && (stock > (Number(p.min_stock ?? 5) || 5) || stock <= 0)) return false;
      if (stockStatusFilter === "Out of Stock" && stock > 0) return false;

      return true;
    });
  }, [products, searchQuery, categoryFilter, brandFilter, statusFilter, stockStatusFilter]);

  // Sorting
  const sortedProducts = useMemo(() => {
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
  const activeCount = products.filter((p) => p.status === "active").length;
  const lowStockCount = products.filter((p) => stockOf(p) > 0 && stockOf(p) <= minOf(p)).length;
  const outOfStockCount = products.filter((p) => stockOf(p) <= 0).length;

  // Toggle Single Selection
  function handleSelectRow(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Toggle Select All
  function handleSelectAll() {
    if (selectedIds.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedProducts.map((p) => p.id));
    }
  }

  // Reset Filters
  function handleClearFilters() {
    setSearchQuery("");
    setCategoryFilter("All");
    setBrandFilter("All");
    setStatusFilter("All");
    setStockStatusFilter("All");
    setCurrentPage(1);
  }

  // Handle Sort Click
  function handleSort(field: string) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
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

  // Bulk Apply
  async function handleBulkApply() {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "delete") {
      if (!confirm(`Are you sure you want to deactivate ${selectedIds.length} selected products?`)) return;
      for (const id of selectedIds) {
        await deleteProduct(id).catch(() => {});
      }
      setSelectedIds([]);
      loadData();
    } else if (bulkAction === "active") {
      for (const id of selectedIds) {
        await updateProduct(id, { status: "active" }).catch(() => {});
      }
      setSelectedIds([]);
      loadData();
    } else if (bulkAction === "inactive") {
      for (const id of selectedIds) {
        await updateProduct(id, { status: "inactive" }).catch(() => {});
      }
      setSelectedIds([]);
      loadData();
    }
  }

  function SortTh({ field, label, right }: { field: string; label: string; right?: boolean }) {
    const on = sortField === field;
    return (
      <th className={right ? "!text-right" : ""}>
        <button type="button" onClick={() => handleSort(field)} className={`inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-navy-900 transition ${on ? "text-navy-900" : ""}`}>
          {label}
          <span className={`text-[10px] ${on ? "text-brand-600" : "text-slate-300"}`}>{on ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================== */}
      {/* 1. HEADER                                                      */}
      {/* ============================================================== */}
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        subtitle="Your full catalog — prices, margins and stock levels in one place."
        actions={
          <>
            <button type="button" onClick={() => setShowImportModal(true)} className="btn-secondary">
              <Icon name="upload" className="w-4 h-4 text-slate-500" /> Import
            </button>
            <button type="button" onClick={handleExportCSV} className="btn-secondary">
              <Icon name="download" className="w-4 h-4 text-slate-500" /> Export
            </button>
            <button type="button" onClick={openCreate} className="btn-primary">
              <Icon name="plus" /> Add product
            </button>
          </>
        }
      />

      {/* ============================================================== */}
      {/* 2. METRICS                                                     */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total products"
          icon="box"
          tone="brand"
          value={totalCount.toLocaleString("en-IN")}
          loading={loading && products.length === 0}
          hint={`${categories.length} categories · ${uniqueBrands.length} brands`}
          active={stockStatusFilter === "All" && statusFilter === "All"}
          onClick={() => { setStockStatusFilter("All"); setStatusFilter("All"); setCurrentPage(1); }}
        />
        <StatCard
          label="Active"
          icon="checkCircle"
          tone="emerald"
          value={activeCount.toLocaleString("en-IN")}
          loading={loading && products.length === 0}
          hint={`${(totalCount - activeCount).toLocaleString("en-IN")} inactive`}
          active={statusFilter === "Active"}
          onClick={() => { setStatusFilter(statusFilter === "Active" ? "All" : "Active"); setCurrentPage(1); }}
        />
        <StatCard
          label="Low stock"
          icon="alert"
          tone="amber"
          value={lowStockCount.toLocaleString("en-IN")}
          valueClass={lowStockCount ? "text-amber-600" : undefined}
          loading={loading && products.length === 0}
          hint="At or below reorder level"
          active={stockStatusFilter === "Low Stock"}
          onClick={() => { setStockStatusFilter(stockStatusFilter === "Low Stock" ? "All" : "Low Stock"); setCurrentPage(1); }}
        />
        <StatCard
          label="Out of stock"
          icon="archive"
          tone="rose"
          value={outOfStockCount.toLocaleString("en-IN")}
          valueClass={outOfStockCount ? "text-rose-600" : undefined}
          loading={loading && products.length === 0}
          hint="Zero units on hand"
          active={stockStatusFilter === "Out of Stock"}
          onClick={() => { setStockStatusFilter(stockStatusFilter === "Out of Stock" ? "All" : "Out of Stock"); setCurrentPage(1); }}
        />
      </div>

      {/* ============================================================== */}
      {/* 3. TABLE CARD (filters, bulk bar, table, pagination)           */}
      {/* ============================================================== */}
      <section className="card overflow-hidden">
        {/* Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <Segmented
              value={stockStatusFilter}
              onChange={(k) => { setStockStatusFilter(k); setCurrentPage(1); }}
              options={[
                { key: "All", label: "All", count: totalCount },
                { key: "In Stock", label: "In stock", count: totalCount - outOfStockCount, tone: "emerald" },
                { key: "Low Stock", label: "Low", count: lowStockCount, tone: "amber" },
                { key: "Out of Stock", label: "Out", count: outOfStockCount, tone: "rose" },
              ]}
            />
            <SearchInput
              className="md:w-[300px]"
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
              placeholder="Search name, SKU or barcode…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 mr-1">
              <Icon name="sliders" className="w-3.5 h-3.5" /> Filters
            </span>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className={`input w-auto py-1.5 pr-8 text-[12.5px] ${categoryFilter !== "All" ? "border-brand-400 bg-brand-50/50 text-brand-800 font-semibold" : ""}`}>
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1); }} className={`input w-auto py-1.5 pr-8 text-[12.5px] ${brandFilter !== "All" ? "border-brand-400 bg-brand-50/50 text-brand-800 font-semibold" : ""}`}>
              <option value="All">All brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={`input w-auto py-1.5 pr-8 text-[12.5px] ${statusFilter !== "All" ? "border-brand-400 bg-brand-50/50 text-brand-800 font-semibold" : ""}`}>
              <option value="All">Any status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {(searchQuery || categoryFilter !== "All" || brandFilter !== "All" || statusFilter !== "All" || stockStatusFilter !== "All") && (
              <button type="button" onClick={handleClearFilters} className="btn-ghost btn-sm">
                <Icon name="refresh" className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <span className="ml-auto text-[12px] text-slate-500">
              <b className="text-navy-900 tabular">{sortedProducts.length.toLocaleString("en-IN")}</b> {sortedProducts.length === 1 ? "product" : "products"}
            </span>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 px-4 sm:px-5 py-2.5 bg-brand-50/70 border-b border-brand-100 animate-fade-in">
            <span className="text-[12.5px] font-semibold text-brand-800">{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="input w-auto py-1 pr-8 text-[12.5px]">
              <option value="">Choose action…</option>
              <option value="active">Mark as active</option>
              <option value="inactive">Mark as inactive</option>
              <option value="delete">Delete selected</option>
            </select>
            <button type="button" onClick={handleBulkApply} disabled={!bulkAction} className="btn-primary btn-sm">Apply</button>
            <button type="button" onClick={() => setSelectedIds([])} className="btn-ghost btn-sm ml-auto">Clear selection</button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-10 !pr-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === paginatedProducts.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                    aria-label="Select all on this page"
                  />
                </th>
                <SortTh field="name" label="Product" />
                <SortTh field="category" label="Category" />
                <SortTh field="purchase_price" label="Cost" right />
                <SortTh field="selling_price" label="Price" right />
                <SortTh field="stock" label="Stock" />
                <SortTh field="status" label="Status" />
                <th className="!text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 rounded bg-slate-100 w-1/3" />
                          <div className="h-2.5 rounded bg-slate-100 w-1/5" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="!p-0">
                    {products.length === 0 ? (
                      <EmptyState
                        icon="box"
                        tone="brand"
                        title="No products yet"
                        text="Add your first product or import your catalog from a spreadsheet."
                        action={
                          <div className="flex gap-2 justify-center">
                            <button type="button" onClick={() => setShowImportModal(true)} className="btn-secondary btn-sm"><Icon name="upload" className="w-3.5 h-3.5" /> Import</button>
                            <button type="button" onClick={openCreate} className="btn-primary btn-sm"><Icon name="plus" className="w-3.5 h-3.5" /> Add product</button>
                          </div>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon="search"
                        title="No products match"
                        text="Try a different search or reset the filters."
                        action={<button type="button" onClick={handleClearFilters} className="btn-secondary btn-sm"><Icon name="refresh" className="w-3.5 h-3.5" /> Reset filters</button>}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
                  const min = Number(p.min_stock ?? 5) || 5;
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= min;
                  const isSelected = selectedIds.includes(p.id);
                  const cost = Number(p.purchase_price) || 0;
                  const price = Number(p.selling_price) || 0;
                  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;

                  return (
                    <tr key={p.id} className={isSelected ? "!bg-brand-50/60" : ""}>
                      <td className="w-10 !pr-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(p.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                          aria-label={`Select ${p.name}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <ProductThumbnail name={p.name} category={p.category?.name} imageUrl={coverOf(p)} />
                          <div className="min-w-0">
                            <ReferenceLink type="product" id={p.id} refNumber={p.sku} className="!font-sans block max-w-[280px] truncate text-[13.5px] font-semibold text-navy-900 hover:text-brand-700">
                              {p.name}
                            </ReferenceLink>
                            <div className="text-[11.5px] text-slate-400 font-mono truncate">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-[13px] text-slate-700 whitespace-nowrap">{p.category?.name || "—"}</div>
                        {p.brand && <div className="text-[11.5px] text-slate-400 truncate max-w-[160px]">{p.brand}</div>}
                      </td>
                      <td className="text-right whitespace-nowrap tabular text-slate-600">{formatINR(p.purchase_price)}</td>
                      <td className="text-right whitespace-nowrap">
                        <div className="font-semibold text-navy-900 tabular">{formatINR(p.selling_price)}</div>
                        {margin !== null && (
                          <div className={`text-[11px] font-semibold ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{margin}% margin</div>
                        )}
                      </td>
                      <td>
                        <div className="w-[110px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-[13.5px] font-bold tabular ${isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-navy-900"}`}>{stock}</span>
                            <span className={`text-[10.5px] font-semibold uppercase tracking-wide ${isOut ? "text-rose-500" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
                              {isOut ? "Out" : isLow ? "Low" : "In stock"}
                            </span>
                          </div>
                          <Meter value={stock} max={Math.max(min * 3, stock, 1)} tone={isOut ? "rose" : isLow ? "amber" : "emerald"} className="mt-1" />
                        </div>
                      </td>
                      <td>
                        {p.status === "active" ? (
                          <span className="badge-active"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</span>
                        ) : (
                          <span className="badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn title="View details" icon="eye" onClick={() => { setActiveProduct(p); setShowViewModal(true); }} />
                          <IconBtn title="Edit product" icon="edit" tone="brand" onClick={() => openEdit(p)} />
                          <IconBtn title="Delete product" icon="trash" tone="rose" onClick={() => { setActiveProduct(p); setShowDeleteModal(true); }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={currentPage}
          pages={totalPages}
          total={sortedProducts.length}
          pageSize={pageSize}
          onPage={(pg) => setCurrentPage(Math.min(totalPages, Math.max(1, pg)))}
          noun="products"
          left={
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="input w-auto py-1 pr-7 text-[12px]"
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          }
        />
      </section>

      {/* ============================================================== */}
      {/* 6. MODALS (Add, Edit, View, Delete, Import)                    */}
      {/* ============================================================== */}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4 my-8">
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
                      previewFilter === "duplicate" ? "bg-purple-100/60 border-purple-500 shadow-xs" : "bg-purple-50/50 border-purple-200 hover:bg-purple-100/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-purple-700 uppercase">Duplicates</div>
                    <div className="text-lg font-bold text-purple-700">{previewResult.summary.duplicateCount}</div>
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
                        previewFilter === "duplicate" ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-slate-100"
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
                                  ? "bg-purple-50/30"
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
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[10px]">
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
