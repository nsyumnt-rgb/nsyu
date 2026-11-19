import { useEffect, useMemo, useState } from "react";
import { listProducts, createProduct, importProductsApi } from "../api/products";
import { listCategories } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import type { Category, Product } from "../types";
import ProductCard3D from "../components/ProductCard3D";
import ProductDetailsModal from "../components/ProductDetailsModal";

// Category Kind Icons matching product types
function CategoryIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("cable") || lower.includes("wire") || lower.includes("cord")) {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
        <path d="M2 20h20" />
      </svg>
    );
  }
  if (lower.includes("charger") || lower.includes("power")) {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (lower.includes("adapter")) {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    );
  }
  if (lower.includes("converter")) {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    );
  }
  if (lower.includes("accessori") || lower.includes("audio") || lower.includes("earbud")) {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

export default function Catalog() {
  const activeShop = useAuthStore((s) => s.activeShop);
  const addItemToCart = usePosStore((s) => s.addItem);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [priceFilter, setPriceFilter] = useState<"all" | "under-200" | "200-500" | "500-1000" | "above-1000">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "low-stock" | "out-of-stock">("all");
  const [sortBy, setSortBy] = useState<"latest" | "price-asc" | "price-desc" | "name-asc" | "stock-desc">("latest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Modals & Drawers
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Add Product Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdPurchasePrice, setNewProdPurchasePrice] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdStock, setNewProdStock] = useState("10");
  const [creatingProd, setCreatingProd] = useState(false);

  // Load Data
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        listProducts(),
        listCategories(),
      ]);
      setProducts(prodRes.data?.data || []);
      setCategories(catRes.data?.data || []);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to load product catalog"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeShop?.id]);

  // Toast auto-hide
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Unique Brands
  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand?.trim()) set.add(p.brand.trim());
    });
    return Array.from(set);
  }, [products]);

  // Product Counts by Category
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const name = p.category?.name || "Others";
      map[name] = (map[name] || 0) + 1;
    });
    return map;
  }, [products]);

  // Category Representative Image Map (First product with image in that category)
  const categoryImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      const catName = p.category?.name;
      if (catName && !map[catName]) {
        const cover = p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url;
        if (cover) {
          map[catName] = cover;
        }
      }
    });
    return map;
  }, [products]);

  // Filter Categories in Sidebar if search query exists
  const visibleCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearchQuery]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchBarcode = p.barcode?.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchBarcode) return false;
        }

        // Category filter
        if (selectedCategory !== "All") {
          const catName = p.category?.name || "Others";
          if (catName.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }

        // Brand filter
        if (selectedBrand !== "All" && p.brand !== selectedBrand) {
          return false;
        }

        // Price Filter
        const price = Number(p.selling_price || 0);
        if (priceFilter === "under-200" && price >= 200) return false;
        if (priceFilter === "200-500" && (price < 200 || price > 500)) return false;
        if (priceFilter === "500-1000" && (price < 500 || price > 1000)) return false;
        if (priceFilter === "above-1000" && price <= 1000) return false;

        // Stock Filter
        const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
        const minStock = Number(p.min_stock ?? 5) || 5;
        if (stockFilter === "in-stock" && stock <= minStock) return false;
        if (stockFilter === "low-stock" && (stock <= 0 || stock > minStock)) return false;
        if (stockFilter === "out-of-stock" && stock > 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") {
          return Number(a.selling_price) - Number(b.selling_price);
        }
        if (sortBy === "price-desc") {
          return Number(b.selling_price) - Number(a.selling_price);
        }
        if (sortBy === "name-asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "stock-desc") {
          const stockA = Number(a.stocks?.[0]?.current_stock ?? 0);
          const stockB = Number(b.stocks?.[0]?.current_stock ?? 0);
          return stockB - stockA;
        }
        // latest (by id desc)
        return b.id - a.id;
      });
  }, [products, search, selectedCategory, selectedBrand, priceFilter, stockFilter, sortBy]);

  // Pagination slice
  const totalProductsCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProductsCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  // Check if any filter is active
  const hasActiveFilters =
    search.trim() !== "" ||
    selectedCategory !== "All" ||
    selectedBrand !== "All" ||
    priceFilter !== "all" ||
    stockFilter !== "all";

  function clearAllFilters() {
    setSearch("");
    setSelectedCategory("All");
    setSelectedBrand("All");
    setPriceFilter("all");
    setStockFilter("all");
    setCurrentPage(1);
  }

  // Handle Add to Cart
  function handleAddToCart(p: Product, qty = 1) {
    const availableStock = Number(p.stocks?.[0]?.current_stock ?? 0);
    if (availableStock <= 0) {
      alert(`"${p.name}" is currently out of stock.`);
      return;
    }
    addItemToCart(p, qty);
    setToastMsg(`✓ Added ${qty} × "${p.name}" to cart`);
  }

  // Quick Add Product Form Submit
  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    setCreatingProd(true);
    try {
      const catId = categories.find((c) => c.name === newProdCategory)?.id;
      await createProduct({
        name: newProdName.trim(),
        sku: newProdSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        selling_price: Number(newProdPrice) || 0,
        purchase_price: Number(newProdPurchasePrice) || Number(newProdPrice) * 0.8,
        category_id: catId,
        brand: newProdBrand.trim() || undefined,
        opening_stock: {
          shopId: activeShop?.id || 1,
          quantity: Number(newProdStock) || 0,
        },
      });
      setShowAddModal(false);
      setNewProdName("");
      setNewProdSku("");
      setNewProdPrice("");
      setNewProdPurchasePrice("");
      setToastMsg("✓ Product created successfully");
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to create product"));
    } finally {
      setCreatingProd(false);
    }
  }

  // Barcode / SKU quick lookup
  function handleBarcodeSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const target = products.find(
      (p) =>
        p.barcode?.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );
    if (target) {
      setDetailProduct(target);
      setShowScanModal(false);
      setBarcodeInput("");
    } else {
      alert(`No product found with barcode/SKU: ${barcodeInput}`);
    }
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

      {/* 1. Header Title & Top Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-800 shadow-xs">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 3h18v18H3z" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Product Catalog</h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                {activeShop?.code || "NSYU"}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Browse products, filter by category on the left, search by name or barcode, and add to cart.
          </p>
        </div>

        {/* Action Buttons: Scan Barcode, Import, + Add Product */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile Category Sidebar Trigger Button */}
          <button
            type="button"
            onClick={() => setMobileCategoryOpen(true)}
            className="lg:hidden px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-100 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Categories ({selectedCategory})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            <span>Scan Barcode</span>
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
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <span className="text-sm font-black">+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Quick Category Pills Bar */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => { setSelectedCategory("All"); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-2xs ${
            selectedCategory === "All"
              ? "bg-[#064E3B] text-white shadow-xs"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>All Products</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === "All" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            {products.length}
          </span>
        </button>
        {categories.map((c) => {
          const count = categoryCounts[c.name] || 0;
          const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { setSelectedCategory(c.name); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-2xs ${
                isSelected
                  ? "bg-[#064E3B] text-white shadow-xs"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN WORKSPACE: LEFT CATEGORY SIDEBAR + RIGHT PRODUCT GRID   */}
      {/* ============================================================== */}
      <div className="flex items-start gap-6 lg:gap-8">
        
        {/* ============================================================== */}
        {/* LEFT CATEGORY SIDEBAR (Permanent on Desktop)                   */}
        {/* ============================================================== */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-4 sticky top-20 max-h-[calc(100vh-6.5rem)] flex flex-col justify-between">
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              
              {/* Sidebar Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <h2 className="font-black text-gray-900 text-sm tracking-tight">Categories</h2>
                </div>
                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {categories.length} total
                </span>
              </div>

              {/* Quick Category Filter Input (if many categories) */}
              {categories.length > 6 && (
                <div className="relative">
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              )}

              {/* Categories Scrollable List */}
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 max-h-[calc(100vh-16rem)]">
                {/* 1. All Products Item */}
                <div
                  onClick={() => {
                    setSelectedCategory("All");
                    setCurrentPage(1);
                  }}
                  className={`w-full p-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    selectedCategory === "All"
                      ? "bg-[#064E3B] text-white shadow-md ring-1 ring-emerald-600"
                      : "bg-slate-50/70 hover:bg-emerald-50/60 text-gray-700 hover:text-emerald-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                        selectedCategory === "All"
                          ? "bg-emerald-700/80 text-white"
                          : "bg-emerald-100/70 text-emerald-800"
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs block truncate">All Products</span>
                      <span className={`text-[10px] block ${selectedCategory === "All" ? "text-emerald-200" : "text-gray-400"}`}>
                        Full inventory catalog
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                      selectedCategory === "All"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200"
                    }`}
                  >
                    {products.length}
                  </span>
                </div>

                {/* 2. Dynamic Categories */}
                {visibleCategories.map((c) => {
                  const count = categoryCounts[c.name] || 0;
                  const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
                  const catImage = categoryImageMap[c.name];

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCategory(c.name);
                        setCurrentPage(1);
                      }}
                      className={`w-full p-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "bg-[#064E3B] text-white shadow-md ring-1 ring-emerald-600"
                          : "bg-slate-50/70 hover:bg-emerald-50/60 text-gray-700 hover:text-emerald-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Category Thumbnail from DB or Fallback Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border ${
                            isSelected
                              ? "bg-emerald-700/80 border-emerald-500 text-white"
                              : "bg-white border-gray-200 text-emerald-700"
                          }`}
                        >
                          {catImage ? (
                            <img
                              src={resolveAssetUrl(catImage) || ""}
                              alt={c.name}
                              className="w-full h-full object-contain p-0.5"
                            />
                          ) : (
                            <CategoryIcon name={c.name} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate">{c.name}</span>
                          <span className={`text-[10px] block ${isSelected ? "text-emerald-200" : "text-gray-400"}`}>
                            {count} {count === 1 ? "product" : "products"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-gray-600 border border-gray-200"
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Sidebar Bottom Banner */}
            <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
              <span>Selected: <b className="text-emerald-700">{selectedCategory}</b></span>
              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className="text-[10.5px] font-bold text-gray-500 hover:text-emerald-800"
              >
                Reset
              </button>
            </div>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* RIGHT MAIN CONTENT AREA                                        */}
        {/* ============================================================== */}
        <main className="flex-1 min-w-0 space-y-4">
          
          {/* Search, Filters, Sorting & View Controls Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-gray-200/90 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              
              {/* Product Search Input (Name, SKU, Barcode) */}
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search product by name, SKU or barcode..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Dropdowns & View Toggles */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                
                {/* Brand Filter */}
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Brands</option>
                  {uniqueBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                {/* Stock Availability Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="in-stock">In Stock Only</option>
                  <option value="low-stock">Low Stock (Reorder)</option>
                  <option value="out-of-stock">Out of Stock</option>
                </select>

                {/* Price Range Filter */}
                <select
                  value={priceFilter}
                  onChange={(e) => {
                    setPriceFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Prices</option>
                  <option value="under-200">Under ₹200</option>
                  <option value="200-500">₹200 – ₹500</option>
                  <option value="500-1000">₹500 – ₹1,000</option>
                  <option value="above-1000">Above ₹1,000</option>
                </select>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="latest">Sort: Latest</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A – Z</option>
                  <option value="stock-desc">Stock: High to Low</option>
                </select>

                {/* Grid / List View Toggle */}
                <div className="flex items-center p-0.5 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === "grid"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    title="Grid View (3D Cards)"
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
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === "list"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    title="List View (Table)"
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

            {/* Results Counter & Active Filter Tags Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs flex-wrap">
              <div className="text-gray-500 font-medium">
                Showing <b className="text-gray-900">{totalProductsCount}</b> products in{" "}
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {selectedCategory}
                </span>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Filters active</span>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 transition underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* ============================================================== */}
          {/* PRODUCT CARDS DISPLAY (3D Grid or List)                        */}
          {/* ============================================================== */}
          {loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 animate-pulse">
                  <div className="w-full aspect-square rounded-xl bg-gray-100" />
                  <div className="h-3 bg-gray-100 rounded-md w-1/3" />
                  <div className="h-4 bg-gray-100 rounded-md w-4/5" />
                  <div className="h-5 bg-gray-100 rounded-md w-1/2" />
                  <div className="h-8 bg-gray-100 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : paginatedProducts.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 stroke-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="font-black text-gray-900 text-base">No products found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                We couldn't find any products matching your current category, search, or price filters.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* 3D Product Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5">
              {paginatedProducts.map((p, idx) => (
                <ProductCard3D
                  key={p.id}
                  product={p}
                  index={idx}
                  onAddToCart={handleAddToCart}
                  onViewDetails={(prod) => setDetailProduct(prod)}
                />
              ))}
            </div>
          ) : (
            /* List View (Table) */
            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Price</th>
                    <th className="p-3.5 text-center">Stock</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.map((p) => {
                    const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
                    const isOutOfStock = stock <= 0;
                    const isLowStock = stock > 0 && stock <= (Number(p.min_stock ?? 5) || 5);
                    const cover = p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden p-1">
                              {cover ? (
                                <img src={resolveAssetUrl(cover) || ""} alt="" className="max-h-full max-w-full object-contain" />
                              ) : (
                                <CategoryIcon name={p.category?.name || ""} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 truncate max-w-xs">{p.name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{p.brand || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-gray-500">{p.sku}</td>
                        <td className="p-3.5 text-gray-600">{p.category?.name || "—"}</td>
                        <td className="p-3.5 text-right font-black text-gray-900">
                          ₹{Number(p.selling_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            isOutOfStock ? "bg-rose-50 text-rose-700" : isLowStock ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {stock} units
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(p)}
                            className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-semibold"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleAddToCart(p, 1)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                          >
                            Add to Cart
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
              <div className="text-xs text-gray-500 font-medium">
                Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalProductsCount)} of {totalProductsCount} products
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-xl text-xs font-bold transition ${
                            currentPage === pageNum
                              ? "bg-emerald-700 text-white shadow-xs"
                              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-1 text-gray-400 text-xs">…</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
                >
                  Next
                </button>
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* ============================================================== */}
      {/* 3. MODALS & DRAWERS                                            */}
      {/* ============================================================== */}

      {/* Product Details Modal with Gallery & Zoom */}
      {detailProduct && (
        <ProductDetailsModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Mobile Category Sidebar Drawer */}
      {mobileCategoryOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex">
          <div className="w-72 bg-white h-full shadow-2xl p-5 flex flex-col justify-between text-gray-900 animate-fadeIn">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    📂
                  </div>
                  <h3 className="font-black text-sm">Select Category</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCategoryOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[70vh] pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setCurrentPage(1);
                    setMobileCategoryOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition ${
                    selectedCategory === "All" ? "bg-[#064E3B] text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>All Products</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedCategory === "All" ? "bg-emerald-600" : "bg-gray-200 text-gray-700"}`}>
                    {products.length}
                  </span>
                </button>

                {categories.map((c) => {
                  const count = categoryCounts[c.name] || 0;
                  const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.name);
                        setCurrentPage(1);
                        setMobileCategoryOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition ${
                        isSelected ? "bg-[#064E3B] text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CategoryIcon name={c.name} />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? "bg-emerald-600" : "bg-gray-200 text-gray-700"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMobileCategoryOpen(false)}
                className="w-full py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileCategoryOpen(false)} />
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Scan / Type Barcode or SKU</h3>
              <button onClick={() => setShowScanModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleBarcodeSearch} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">Enter Barcode or SKU:</label>
                <input
                  type="text"
                  autoFocus
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. UC-381 or 890123456789"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  Find & View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Quick Add Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. ERD Fast Charger 20W"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="e.g. ERD-20W"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Brand</label>
                  <input
                    type="text"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    placeholder="e.g. ERD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="499.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdPurchasePrice}
                    onChange={(e) => setNewProdPurchasePrice(e.target.value)}
                    placeholder="350.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Category</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Opening Stock</label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProd}
                  className="px-5 py-2 font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {creatingProd ? "Saving..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Import Products via CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <p className="text-xs text-gray-500">
              Upload a CSV file containing columns: Name, SKU, Category, Selling Price, Purchase Price, Stock.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importProductsApi({ file, shopId: activeShop?.id });
                  alert("Products imported successfully!");
                  setShowImportModal(false);
                  loadData();
                } catch (err: any) {
                  alert(apiErrorMessage(err, "CSV import failed"));
                }
              }}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
            />
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl text-xs"
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
