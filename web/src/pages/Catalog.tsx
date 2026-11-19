import { useEffect, useMemo, useState } from "react";
import { listProducts, createProduct, importProductsApi } from "../api/products";
import { listCategories } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import type { Category, Product } from "../types";

// Category Kind Icons matching screenshot
function CategoryIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("cable") || lower.includes("wire")) {
    return (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
        <path d="M2 20h20" />
      </svg>
    );
  }
  if (lower.includes("charger") || lower.includes("power")) {
    return (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (lower.includes("adapter")) {
    return (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    );
  }
  if (lower.includes("converter")) {
    return (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    );
  }
  if (lower.includes("accessori") || lower.includes("audio") || lower.includes("earbud")) {
    return (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const [sortBy, setSortBy] = useState<"latest" | "price-asc" | "price-desc" | "stock-desc">("latest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
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

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchBarcode = p.barcode?.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchBarcode) return false;
        }
        if (selectedCategory !== "All" && (p.category?.name || "Others") !== selectedCategory) {
          return false;
        }
        if (selectedBrand !== "All" && p.brand !== selectedBrand) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return Number(a.selling_price) - Number(b.selling_price);
        if (sortBy === "price-desc") return Number(b.selling_price) - Number(a.selling_price);
        if (sortBy === "stock-desc") {
          const stockA = Number(a.stocks?.[0]?.current_stock ?? 0);
          const stockB = Number(b.stocks?.[0]?.current_stock ?? 0);
          return stockB - stockA;
        }
        return b.id - a.id;
      });
  }, [products, search, selectedCategory, selectedBrand, sortBy]);

  // Add to Cart
  function handleAddToCart(p: Product) {
    addItemToCart(p, 1);
    setToastMsg(`✓ Added "${p.name}" to cart`);
  }

  // Handle Quick Add Product
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

  // Handle Barcode Search
  function handleBarcodeSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const target = products.find(
      (p) =>
        p.barcode?.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );
    if (target) {
      handleAddToCart(target);
      setShowScanModal(false);
      setBarcodeInput("");
    } else {
      alert(`No product found with barcode/SKU: ${barcodeInput}`);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
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

      {/* 1. Header Title & Top Actions matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-800">
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
            Browse products, filter by category, search by name or barcode, and add to cart.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* 2. Category Pills Horizontal Strip matching Image 1 */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory("All")}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition shrink-0 ${
            selectedCategory === "All"
              ? "bg-[#ECFDF5] border-[#059669] text-emerald-950 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300 text-gray-700"
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-100/70 flex items-center justify-center text-emerald-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-xs font-black">All Products</div>
            <div className="text-[11px] text-gray-500 font-semibold">({products.length})</div>
          </div>
        </button>

        {categories.map((cat) => {
          const count = categoryCounts[cat.name] || 0;
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition shrink-0 ${
                isSelected
                  ? "bg-[#ECFDF5] border-[#059669] text-emerald-950 shadow-xs"
                  : "bg-white border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100/70 flex items-center justify-center text-emerald-700">
                <CategoryIcon name={cat.name} />
              </div>
              <div className="text-left">
                <div className="text-xs font-black">{cat.name}</div>
                <div className="text-[11px] text-gray-500 font-semibold">({count})</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Bar matching Image 1 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name, SKU or barcode..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Dropdowns & View Mode */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="All">All Brands</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
          >
            <option value="latest">Sort: Latest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="stock-desc">Stock: High to Low</option>
          </select>

          <div className="flex items-center p-0.5 bg-gray-100 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition ${viewMode === "grid" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-400 hover:text-gray-600"}`}
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
              className={`p-1.5 rounded-lg transition ${viewMode === "list" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-400 hover:text-gray-600"}`}
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

      {/* 4. Products Presentation (Grid vs List) */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading catalog products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
            📦
          </div>
          <h3 className="text-sm font-bold text-gray-900">No products found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your search keywords, category filter, or add a new product.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* 5-Column Grid matching Image 1 */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredProducts.map((p) => {
            const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
            const coverImg = (p.images?.find((i) => i.is_primary) || p.images?.[0])?.url;
            const imgSrc = coverImg ? resolveAssetUrl(coverImg) : null;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition p-3.5 flex flex-col justify-between group"
              >
                <div>
                  {/* Image container */}
                  <div className="w-full h-32 bg-gray-50/70 rounded-xl mb-3 flex items-center justify-center overflow-hidden relative">
                    {imgSrc ? (
                      <img src={imgSrc} alt={p.name} className="h-full object-contain p-2 group-hover:scale-105 transition-transform" />
                    ) : (
                      <CategoryIcon name={p.category?.name || p.name} />
                    )}
                  </div>

                  {/* Product Details */}
                  <h3 className="font-bold text-xs text-gray-900 line-clamp-2 min-h-[32px] group-hover:text-emerald-800 transition">
                    {p.name}
                  </h3>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    SKU: {p.sku}
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div className="text-sm font-black text-gray-900">
                      ₹{Number(p.selling_price).toFixed(2)}
                    </div>
                    <div
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                        stock > 10
                          ? "bg-emerald-50 text-emerald-700"
                          : stock > 0
                          ? "bg-amber-50 text-amber-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      Stock: {stock}
                    </div>
                  </div>
                </div>

                {/* Add to Cart Action matching Image 1 */}
                <button
                  type="button"
                  onClick={() => handleAddToCart(p)}
                  className="mt-3.5 w-full py-2 bg-[#047857] hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                  </svg>
                  <span>Add to Cart</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-center">Stock</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((p) => {
                const stock = Number(p.stocks?.[0]?.current_stock ?? 0);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-3 font-bold text-gray-900">{p.name}</td>
                    <td className="p-3 font-mono text-gray-500">{p.sku}</td>
                    <td className="p-3 text-gray-600">{p.category?.name || "—"}</td>
                    <td className="p-3 text-right font-black text-gray-900">₹{Number(p.selling_price).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        stock > 10 ? "bg-emerald-50 text-emerald-700" : stock > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {stock} units
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        className="px-3 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                        </svg>
                        <span>Add</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-sm">Scan or Type Barcode / SKU</h3>
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
                  Find & Add to Cart
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
              <h3 className="font-black text-gray-900 text-sm">Add New Product to Catalog</h3>
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
                  placeholder="e.g. ERD UC-381 USB-C to C Data Cable"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">SKU (Code)</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Category</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
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
                    placeholder="e.g. 119.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdPurchasePrice}
                    onChange={(e) => setNewProdPurchasePrice(e.target.value)}
                    placeholder="e.g. 80.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProd}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {creatingProd ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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
