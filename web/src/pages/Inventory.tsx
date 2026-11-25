import { byRecentChange } from "../utils/productRecency";
import { useCallback, useEffect, useMemo, useState, memo, startTransition } from "react";
import { createPortal } from "react-dom";
import {
  getInventoryHistory,
  recordMovement,
  type DirectMovementType,
} from "../api/inventory";
import {
  listProducts,
  createProduct,
  updateProduct,
  uploadProductImages,
  deleteProduct,
  importProductsApi,
} from "../api/products";
import { listCategories } from "../api/categories";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePosStore } from "../store/posStore";
import { getCategoryAlias } from "../utils/categoryAlias";
import type { Category, InventoryTransaction, Product, ProductVisibility } from "../types";
import VisibilityBadge from "../components/VisibilityBadge";
import { VISIBILITY_META, effectiveVisibility, isPosVisible, visibilityPatch } from "../utils/productVisibility";

// Helper for formatting INR currency
function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null) return "₹0.00";
  return (
    "₹" +
    Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

interface InlineEditDraft {
  id: number;
  categoryId: number | null;
  purchasePrice: string;
  sellingPrice: string;
  livePrice: string;
  marginPercent: string;
  stockQuantity: string;
  minStock: string;
}

interface DirectStockInputProps {
  productId: number;
  initialStock: number;
  minStock: number;
  isSaving: boolean;
  onSave: (product: Product, newStock: number) => Promise<void>;
  product: Product;
}

// Dedicated isolated component to avoid re-rendering entire table on stock input keystrokes (prevents INP delays)
const DirectStockInput = memo(function DirectStockInput({
  initialStock,
  minStock,
  isSaving,
  onSave,
  product,
}: DirectStockInputProps) {
  const [val, setVal] = useState<string>(String(initialStock));
  const [isFocused, setIsFocused] = useState(false);

  // Sync if initialStock changes from server/props while not focused
  useEffect(() => {
    if (!isFocused) {
      setVal(String(initialStock));
    }
  }, [initialStock, isFocused]);

  const numVal = Number(val);
  const isValidNum = !isNaN(numVal) && val.trim() !== "";
  const isDirty = isValidNum && Math.max(0, Math.trunc(numVal)) !== initialStock;

  const displayStock = isValidNum ? Math.max(0, Math.trunc(numVal)) : initialStock;
  const isOut = displayStock <= 0;
  const isLow = displayStock > 0 && displayStock <= minStock;

  const handleCommit = () => {
    if (isSaving) return;
    if (!isValidNum) {
      setVal(String(initialStock));
      return;
    }
    const n = Math.max(0, Math.trunc(numVal));
    if (n !== initialStock) {
      onSave(product, n);
    } else {
      setVal(String(initialStock));
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min="0"
        step="1"
        disabled={isSaving}
        value={val}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          // Local isolated state: instantaneous input reaction, 0ms INP block!
          setVal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setVal(String(initialStock));
            e.currentTarget.blur();
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          handleCommit();
        }}
        className={`w-20 px-2 py-1 text-center font-black text-xs rounded-xl border transition outline-none shadow-2xs ${
          isOut
            ? "bg-rose-50/70 border-rose-300 text-rose-800 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
            : isLow
            ? "bg-amber-50/70 border-amber-300 text-amber-800 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            : "bg-slate-50/70 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        }`}
        title="Directly edit stock and press Enter or click outside to save"
      />
      {isDirty && !isSaving && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleCommit();
          }}
          className="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition shadow-2xs text-[11px] cursor-pointer"
          title="Save Stock"
        >
          ✓
        </button>
      )}
      {isSaving && (
        <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
      )}
    </div>
  );
});

export interface InventoryProps {
  showViewOption?: boolean;
  embedded?: boolean;
}

export default function Inventory({
  showViewOption = true,
  embedded = false,
}: InventoryProps = {}) {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const addItemToPos = usePosStore((s) => s.addItem);

  const [products, setProducts] = useState<Product[]>([]);
  const effectiveShopId = shopId || activeShop?.id || (products[0]?.stocks?.[0]?.shop_id ?? undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters: All Products, Low Stock, Out of Stock, Stock Movement
  const [activeFilter, setActiveFilter] = useState<
    "All" | "Live" | "Offline" | "Low Stock" | "Out of Stock" | "Stock Movement"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Specific Column Filters (Category, SKU, Show, Stock, Purchase Price, Selling Price, Live Price, Margin %, Stock Value)
  const [skuFilter, setSkuFilter] = useState("");
  const [showFilter, setShowFilter] = useState<"all" | "both" | "marketplace" | "pos" | "hidden">("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [minStockFilter, setMinStockFilter] = useState("");
  const [maxStockFilter, setMaxStockFilter] = useState("");
  const [minPurchasePrice, setMinPurchasePrice] = useState("");
  const [maxPurchasePrice, setMaxPurchasePrice] = useState("");
  const [minSellingPrice, setMinSellingPrice] = useState("");
  const [maxSellingPrice, setMaxSellingPrice] = useState("");
  const [minLivePrice, setMinLivePrice] = useState("");
  const [maxLivePrice, setMaxLivePrice] = useState("");
  const [marginRangeFilter, setMarginRangeFilter] = useState<"all" | "high" | "medium" | "low" | "negative">("all");
  const [minMarginFilter, setMinMarginFilter] = useState("");
  const [maxMarginFilter, setMaxMarginFilter] = useState("");
  const [minStockValue, setMinStockValue] = useState("");
  const [maxStockValue, setMaxStockValue] = useState("");

  // Column Sorting State
  const [sortField, setSortField] = useState<
    | "recency"
    | "name"
    | "category"
    | "sku"
    | "show"
    | "stock"
    | "purchasePrice"
    | "sellingPrice"
    | "livePrice"
    | "margin"
    | "stockValue"
  >("recency");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Toggle for Advanced Filters bar
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // 1. View Detail & Full Edit Modal state (Requirement 1)
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [activeDetailImage, setActiveDetailImage] = useState<string | null>(null);
  const [isEditingView, setIsEditingView] = useState(false);
  const [viewEditForm, setViewEditForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    brand: "",
    category_id: null as number | null,
    purchase_price: "",
    selling_price: "",
    live_price: "",
    margin_percent: "",
    mrp: "",
    min_stock: "5",
    description: "",
    status: "active" as "active" | "inactive",
  });
  const [viewPhotoFile, setViewPhotoFile] = useState<File | null>(null);
  const [viewPhotoPreview, setViewPhotoPreview] = useState<string | null>(null);
  const [savingViewEdit, setSavingViewEdit] = useState(false);

  // 2. Live On/Off toggle loading state (Requirement 2)
  const [savingVisibilityId, setSavingVisibilityId] = useState<number | null>(null);
  const canEditProducts = useAuthStore((s) => s.can("products", "edit"));

  // 3. Inline Row Edit state (Requirement 3)
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [inlineDraft, setInlineDraft] = useState<InlineEditDraft | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);

  // Direct Stock Input state (saving state per product)
  const [savingStockId, setSavingStockId] = useState<number | null>(null);

  // Adjust Stock Form (Top Header "Stock Movement" button)
  const [adjustMode, setAdjustMode] = useState<"change" | "set">("change");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState<
    "count" | "damaged" | "return" | "other"
  >("count");
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
  const [addLivePrice, setAddLivePrice] = useState("");
  const [addMinStock, setAddMinStock] = useState("5");
  const [addOpeningStock, setAddOpeningStock] = useState("10");
  const [addingProduct, setAddingProduct] = useState(false);

  // Edit Product Form (Fallback modal edit)
  const [editName, setEditName] = useState("");
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editLivePrice, setEditLivePrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("5");
  const [editingProduct, setEditingProduct] = useState(false);

  // Helper to reliably read current stock for active shop
  const getProductStock = useCallback(
    (p: any) => {
      if (p?.current_stock !== undefined && p?.current_stock !== null) {
        return Number(p.current_stock);
      }
      if (!p?.stocks || p.stocks.length === 0) return 0;
      const targetShopId = effectiveShopId || shopId;
      if (targetShopId) {
        const match = p.stocks.find((s: any) => Number(s.shop_id) === Number(targetShopId));
        if (match) return Number(match.current_stock || 0);
      }
      return Number(p.stocks[0]?.current_stock || 0);
    },
    [effectiveShopId, shopId]
  );

  // Load centralized inventory data
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, histRes] = await Promise.all([
        listProducts({ shopId: effectiveShopId || undefined } as any),
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
  }, [effectiveShopId, shopId]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Real database-calculated summary metrics (memoized to eliminate redundant computations on input change)
  const summaryMetrics = useMemo(() => {
    let live = 0;
    let offline = 0;
    let stockSum = 0;
    let low = 0;
    let out = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.status === "active") live++;
      else offline++;

      const s = getProductStock(p);
      stockSum += s;
      const min = Number(p.min_stock ?? 5) || 5;
      if (s <= 0) out++;
      else if (s <= min) low++;
    }

    return {
      totalProducts: products.length,
      liveCount: live,
      offlineCount: offline,
      totalStock: stockSum,
      lowStockCount: low,
      outOfStockCount: out,
    };
  }, [products, getProductStock]);

  const {
    totalProducts,
    liveCount,
    offlineCount,
    totalStock,
    lowStockCount,
    outOfStockCount,
  } = summaryMetrics;

  // Category counts for quick category selector pills
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const cName = p.category?.name || "Uncategorized";
      map[cName] = (map[cName] || 0) + 1;
    }
    return map;
  }, [products]);

  // Active Filter Helpers
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== "All") count++;
    if (skuFilter.trim()) count++;
    if (showFilter !== "all") count++;
    if (stockStatusFilter !== "all") count++;
    if (minStockFilter !== "" || maxStockFilter !== "") count++;
    if (minPurchasePrice !== "" || maxPurchasePrice !== "") count++;
    if (minSellingPrice !== "" || maxSellingPrice !== "") count++;
    if (minLivePrice !== "" || maxLivePrice !== "") count++;
    if (marginRangeFilter !== "all" || minMarginFilter !== "" || maxMarginFilter !== "") count++;
    if (minStockValue !== "" || maxStockValue !== "") count++;
    return count;
  }, [
    categoryFilter,
    skuFilter,
    showFilter,
    stockStatusFilter,
    minStockFilter,
    maxStockFilter,
    minPurchasePrice,
    maxPurchasePrice,
    minSellingPrice,
    maxSellingPrice,
    minLivePrice,
    maxLivePrice,
    marginRangeFilter,
    minMarginFilter,
    maxMarginFilter,
    minStockValue,
    maxStockValue,
  ]);

  const hasActiveColumnFilters = activeFilterCount > 0;

  function handleClearAllFilters() {
    setCategoryFilter("All");
    setSkuFilter("");
    setShowFilter("all");
    setStockStatusFilter("all");
    setMinStockFilter("");
    setMaxStockFilter("");
    setMinPurchasePrice("");
    setMaxPurchasePrice("");
    setMinSellingPrice("");
    setMaxSellingPrice("");
    setMinLivePrice("");
    setMaxLivePrice("");
    setMarginRangeFilter("all");
    setMinMarginFilter("");
    setMaxMarginFilter("");
    setMinStockValue("");
    setMaxStockValue("");
    setSearchQuery("");
    setActiveFilter("All");
    setSortField("recency");
    setSortDirection("asc");
  }

  function handleSort(field: typeof sortField) {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField("recency");
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function renderSortIndicator(field: typeof sortField) {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-emerald-300/40 opacity-40 group-hover:opacity-100 transition-opacity">
          ↕
        </span>
      );
    }
    return (
      <span className="ml-1 text-amber-300 font-black">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  }

  // Filtered Products for Table
  // Applies column filters for Category, SKU, Show, Stock, Purchase Price, Selling Price, Live Price, Margin %, Stock Value
  // and sorts according to the user-selected column header.
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const stock = getProductStock(p);
        const min = Number(p.min_stock ?? 5) || 5;
        const pp = Number(p.purchase_price || 0);
        const sp = Number(p.selling_price || 0);
        const lp = Number(p.live_price ?? sp);
        const margin = sp > 0 ? ((sp - pp) / sp) * 100 : 0;
        const stockVal = Math.max(0, stock) * pp;
        const vis = effectiveVisibility(p);

        // Status Segment Filters
        if (activeFilter === "Live" && p.status !== "active") return false;
        if (activeFilter === "Offline" && p.status === "active") return false;
        if (activeFilter === "Low Stock" && (stock <= 0 || stock > min)) return false;
        if (activeFilter === "Out of Stock" && stock > 0) return false;

        // 1. Category Filter
        const catName = p.category?.name || "Uncategorized";
        if (categoryFilter !== "All" && catName !== categoryFilter) return false;

        // 2. SKU Filter
        if (skuFilter.trim()) {
          const q = skuFilter.toLowerCase().trim();
          if (!p.sku.toLowerCase().includes(q)) return false;
        }

        // 3. Show Filter (both, marketplace, pos, hidden)
        if (showFilter !== "all") {
          if (vis !== showFilter) return false;
        }

        // 4. Stock Filter
        if (stockStatusFilter === "in_stock" && stock <= 0) return false;
        if (stockStatusFilter === "low_stock" && (stock <= 0 || stock > min)) return false;
        if (stockStatusFilter === "out_of_stock" && stock > 0) return false;
        if (minStockFilter !== "" && stock < Number(minStockFilter)) return false;
        if (maxStockFilter !== "" && stock > Number(maxStockFilter)) return false;

        // 5. Purchase Price Filter
        if (minPurchasePrice !== "" && pp < Number(minPurchasePrice)) return false;
        if (maxPurchasePrice !== "" && pp > Number(maxPurchasePrice)) return false;

        // 6. Selling Price Filter
        if (minSellingPrice !== "" && sp < Number(minSellingPrice)) return false;
        if (maxSellingPrice !== "" && sp > Number(maxSellingPrice)) return false;

        // 7. Live Price Filter
        if (minLivePrice !== "" && lp < Number(minLivePrice)) return false;
        if (maxLivePrice !== "" && lp > Number(maxLivePrice)) return false;

        // 8. Margin (%) Filter
        if (marginRangeFilter === "negative" && margin >= 0) return false;
        if (marginRangeFilter === "low" && (margin < 0 || margin >= 10)) return false;
        if (marginRangeFilter === "medium" && (margin < 10 || margin >= 25)) return false;
        if (marginRangeFilter === "high" && margin < 25) return false;
        if (minMarginFilter !== "" && margin < Number(minMarginFilter)) return false;
        if (maxMarginFilter !== "" && margin > Number(maxMarginFilter)) return false;

        // 9. Stock Value Filter
        if (minStockValue !== "" && stockVal < Number(minStockValue)) return false;
        if (maxStockValue !== "" && stockVal > Number(maxStockValue)) return false;

        // General search box (name, SKU, barcode)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const mName = p.name.toLowerCase().includes(q);
          const mSku = p.sku.toLowerCase().includes(q);
          const mBarcode = p.barcode?.toLowerCase().includes(q);
          if (!mName && !mSku && !mBarcode) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === "recency") {
          return byRecentChange(a, b);
        }
        let cmp = 0;
        if (sortField === "name") {
          cmp = a.name.localeCompare(b.name);
        } else if (sortField === "category") {
          const catA = a.category?.name || "Uncategorized";
          const catB = b.category?.name || "Uncategorized";
          cmp = catA.localeCompare(catB);
        } else if (sortField === "sku") {
          cmp = (a.sku || "").localeCompare(b.sku || "");
        } else if (sortField === "show") {
          const visA = effectiveVisibility(a);
          const visB = effectiveVisibility(b);
          cmp = visA.localeCompare(visB);
        } else if (sortField === "stock") {
          const sA = getProductStock(a);
          const sB = getProductStock(b);
          cmp = sA - sB;
        } else if (sortField === "purchasePrice") {
          cmp = Number(a.purchase_price || 0) - Number(b.purchase_price || 0);
        } else if (sortField === "sellingPrice") {
          cmp = Number(a.selling_price || 0) - Number(b.selling_price || 0);
        } else if (sortField === "livePrice") {
          const lpA = Number(a.live_price ?? a.selling_price ?? 0);
          const lpB = Number(b.live_price ?? b.selling_price ?? 0);
          cmp = lpA - lpB;
        } else if (sortField === "margin") {
          const ppA = Number(a.purchase_price || 0);
          const spA = Number(a.selling_price || 0);
          const mA = spA > 0 ? ((spA - ppA) / spA) * 100 : 0;

          const ppB = Number(b.purchase_price || 0);
          const spB = Number(b.selling_price || 0);
          const mB = spB > 0 ? ((spB - ppB) / spB) * 100 : 0;

          cmp = mA - mB;
        } else if (sortField === "stockValue") {
          const svA = Math.max(0, getProductStock(a)) * Number(a.purchase_price || 0);
          const svB = Math.max(0, getProductStock(b)) * Number(b.purchase_price || 0);
          cmp = svA - svB;
        }

        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [
    products,
    activeFilter,
    categoryFilter,
    skuFilter,
    showFilter,
    stockStatusFilter,
    minStockFilter,
    maxStockFilter,
    minPurchasePrice,
    maxPurchasePrice,
    minSellingPrice,
    maxSellingPrice,
    minLivePrice,
    maxLivePrice,
    marginRangeFilter,
    minMarginFilter,
    maxMarginFilter,
    minStockValue,
    maxStockValue,
    searchQuery,
    sortField,
    sortDirection,
    getProductStock,
  ]);

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

  // -------------------------------------------------------------
  // SHOW column: change where a product is offered (BOTH / MKT / POS / HIDE)
  // -------------------------------------------------------------
  async function handleSetVisibility(product: Product, next: ProductVisibility) {
    if (!canEditProducts) return;
    const patch = visibilityPatch(product, next);
    setSavingVisibilityId(product.id);
    try {
      const res = await updateProduct(product.id, patch);
      const saved = res.data?.data;
      const merged = { ...patch, ...(saved ? { status: saved.status, visibility: saved.visibility ?? next, updated_at: saved.updated_at } : {}) };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...merged } : p)));
      setViewProduct((vp) => (vp && vp.id === product.id ? { ...vp, ...merged } : vp));
      setToastMsg(`✓ "${product.name}" — ${VISIBILITY_META[next].label}`);
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to update product visibility"));
    } finally {
      setSavingVisibilityId(null);
    }
  }

  // -------------------------------------------------------------
  // Requirement 3: Inline Edit Handlers (Margin, Qty, Categories, Prices)
  // -------------------------------------------------------------
  function handleStartInlineEdit(p: Product) {
    const pp = Number(p.purchase_price || 0);
    const sp = Number(p.selling_price || 0);
    const lp = p.live_price ? String(p.live_price) : "";
    const currentStock = getProductStock(p);
    const margin = sp > 0 ? (((sp - pp) / sp) * 100).toFixed(1) : "0.0";

    setEditingRowId(p.id);
    setInlineDraft({
      id: p.id,
      categoryId: p.category_id || p.category?.id || null,
      purchasePrice: String(pp),
      sellingPrice: String(sp),
      livePrice: lp,
      marginPercent: margin,
      stockQuantity: String(currentStock),
      minStock: String(p.min_stock ?? 5),
    });
  }

  function handleCancelInlineEdit() {
    setEditingRowId(null);
    setInlineDraft(null);
  }

  function handleDraftChange(
    field:
      | "purchasePrice"
      | "sellingPrice"
      | "livePrice"
      | "marginPercent"
      | "stockQuantity"
      | "categoryId"
      | "minStock",
    value: any
  ) {
    if (!inlineDraft) return;

    if (field === "purchasePrice") {
      const newPp = Math.max(0, Number(value) || 0);
      const sp = Math.max(0, Number(inlineDraft.sellingPrice) || 0);
      const newMargin = sp > 0 ? (((sp - newPp) / sp) * 100).toFixed(1) : "0.0";
      setInlineDraft({
        ...inlineDraft,
        purchasePrice: value,
        marginPercent: newMargin,
      });
    } else if (field === "sellingPrice") {
      const pp = Math.max(0, Number(inlineDraft.purchasePrice) || 0);
      const newSp = Math.max(0, Number(value) || 0);
      const newMargin = newSp > 0 ? (((newSp - pp) / newSp) * 100).toFixed(1) : "0.0";
      setInlineDraft({
        ...inlineDraft,
        sellingPrice: value,
        marginPercent: newMargin,
      });
    } else if (field === "marginPercent") {
      const pp = Math.max(0, Number(inlineDraft.purchasePrice) || 0);
      const targetMargin = Math.min(99.9, Math.max(-100, Number(value) || 0));
      // Formula: selling_price = purchase_price / (1 - margin / 100)
      const calculatedSp =
        targetMargin < 100 && pp > 0
          ? (pp / (1 - targetMargin / 100)).toFixed(2)
          : inlineDraft.sellingPrice;
      setInlineDraft({
        ...inlineDraft,
        marginPercent: value,
        sellingPrice: calculatedSp,
      });
    } else {
      setInlineDraft({
        ...inlineDraft,
        [field]: value,
      });
    }
  }

  async function handleSaveInlineEdit(product: Product) {
    if (!inlineDraft || inlineDraft.id !== product.id) return;
    setInlineSaving(true);
    try {
      const newPp = Math.max(0, Number(inlineDraft.purchasePrice) || 0);
      const newSp = Math.max(0, Number(inlineDraft.sellingPrice) || 0);
      const newLp = inlineDraft.livePrice ? Number(inlineDraft.livePrice) : null;
      const newMin = Math.max(0, Number(inlineDraft.minStock) || 5);
      const newCatId = inlineDraft.categoryId ? Number(inlineDraft.categoryId) : undefined;

      // 1. Update product master attributes
      await updateProduct(product.id, {
        purchase_price: newPp,
        selling_price: newSp,
        live_price: newLp,
        min_stock: newMin,
        category_id: newCatId,
      });

      // 2. Check if stock quantity was modified inline
      const oldStock = getProductStock(product);
      const newStock = Math.max(0, Math.trunc(Number(inlineDraft.stockQuantity) || 0));
      const delta = newStock - oldStock;

      if (delta !== 0) {
        const targetShopId = effectiveShopId || product.stocks?.[0]?.shop_id;
        await recordMovement({
          productId: product.id,
          shopId: targetShopId,
          type: "adjustment",
          quantity: delta,
          notes: `Inline inventory stock update (${oldStock} -> ${newStock})`,
        });
      }

      setToastMsg(`✓ "${product.name}" updated successfully`);
      setEditingRowId(null);
      setInlineDraft(null);
      await loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to save product changes"));
    } finally {
      setInlineSaving(false);
    }
  }

  // -------------------------------------------------------------
  // Quick Sync: Selling Price => Live Price (Row arrow & Header arrow)
  // -------------------------------------------------------------
  const [syncingLiveId, setSyncingLiveId] = useState<number | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  async function handleQuickSetLivePrice(p: Product) {
    // 1. If currently editing inline, sync draft fields directly
    if (editingRowId === p.id && inlineDraft) {
      handleDraftChange("livePrice", inlineDraft.sellingPrice);
      setToastMsg(`✓ Live Price draft set to ₹${inlineDraft.sellingPrice}`);
      return;
    }

    const sp = Number(p.selling_price || 0);
    if (sp <= 0) {
      alert(`Please set a valid Selling Price for "${p.name}" first.`);
      return;
    }

    setSyncingLiveId(p.id);

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, live_price: sp } : item))
    );
    if (viewProduct && viewProduct.id === p.id) {
      setViewProduct({ ...viewProduct, live_price: sp });
    }

    try {
      await updateProduct(p.id, { live_price: sp });
      setToastMsg(`✓ Live Price for "${p.name}" set to ${formatINR(sp)}`);
    } catch (err: any) {
      // Revert on error
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, live_price: p.live_price } : item))
      );
      if (viewProduct && viewProduct.id === p.id) {
        setViewProduct({ ...viewProduct, live_price: p.live_price });
      }
      alert(apiErrorMessage(err, "Failed to update Live Price"));
    } finally {
      setSyncingLiveId(null);
    }
  }

  async function handleSyncAllLivePrices() {
    const eligible = filteredProducts.filter((p) => Number(p.selling_price || 0) > 0);
    if (eligible.length === 0) {
      alert("No products with valid selling price to sync in current view.");
      return;
    }
    const confirmed = window.confirm(
      `Set Live Price = Selling Price for all ${eligible.length} product(s) shown in the list?`
    );
    if (!confirmed) return;

    setBulkSyncing(true);
    let updatedCount = 0;
    try {
      await Promise.all(
        eligible.map(async (p) => {
          const sp = Number(p.selling_price || 0);
          if (Number(p.live_price) !== sp) {
            await updateProduct(p.id, { live_price: sp });
            updatedCount++;
          }
        })
      );
      setProducts((prev) =>
        prev.map((item) => {
          const match = eligible.find((e) => e.id === item.id);
          return match ? { ...item, live_price: Number(match.selling_price || 0) } : item;
        })
      );
      setToastMsg(`✓ Live Price synced to Selling Price for ${eligible.length} product(s)`);
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to sync all live prices"));
    } finally {
      setBulkSyncing(false);
    }
  }

  // Direct Stock Input Save handler (triggered on Enter, blur, or checkmark click)
  const handleDirectStockSave = useCallback(
    async (product: Product, newStock: number) => {
      const oldStock = getProductStock(product);
      const delta = newStock - oldStock;
      if (delta === 0) return;

      setSavingStockId(product.id);
      try {
        const targetShopId = effectiveShopId || product.stocks?.[0]?.shop_id;
        const res = await recordMovement({
          productId: product.id,
          shopId: targetShopId,
          type: "adjustment",
          quantity: delta,
          expectedStock: oldStock,
          notes: `Direct inventory stock change (${oldStock} -> ${newStock})`,
        });
        // Trust the server's balance (it may differ if stock moved meanwhile).
        const d: any = res.data?.data;
        const saved = Number(d?.stock?.current_stock ?? d?.currentStock ?? d?.transaction?.balance_after ?? newStock);

        // Non-blocking UI update with startTransition so paint happens immediately (0ms INP block)
        startTransition(() => {
          setProducts((prev) =>
            prev.map((p) => {
              if (p.id !== product.id) return p;
              const currentStocks = p.stocks || [];
              const matchIdx = currentStocks.findIndex(
                (s) => !targetShopId || s.shop_id === targetShopId
              );
              let nextStocks;
              if (matchIdx >= 0) {
                nextStocks = currentStocks.map((s, idx) =>
                  idx === matchIdx ? { ...s, current_stock: saved } : s
                );
              } else {
                nextStocks = [
                  ...currentStocks,
                  { shop_id: targetShopId || 1, current_stock: saved } as any,
                ];
              }
              // current_stock is what the list displays — it must change too, or the
              // box snaps back to the old number and the next edit uses a stale base.
              return { ...p, current_stock: saved, stocks: nextStocks } as Product;
            })
          );
          setViewProduct((vp: any) => (vp && vp.id === product.id ? { ...vp, current_stock: saved } : vp));
          setToastMsg(`✓ Stock for "${product.name}" updated to ${saved}`);
        });
      } catch (err: any) {
        if (err?.response?.status === 409) {
          alert(apiErrorMessage(err, "Stock changed meanwhile.") + " The list has been refreshed.");
          loadData();
          return;
        }
        alert(apiErrorMessage(err, "Failed to update stock"));
      } finally {
        setSavingStockId(null);
      }
    },
    [effectiveShopId, getProductStock]
  );

  // Open Global Stock Movement Modal
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

  // Submit Stock Movement / Adjustment from Modal
  async function handleSaveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjustError(null);

    const curr = getProductStock(selectedProduct);
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
      const targetShopId = effectiveShopId || selectedProduct.stocks?.[0]?.shop_id;
      await recordMovement({
        productId: selectedProduct.id,
        shopId: targetShopId,
        type,
        quantity: quantityToRecord,
        // "Set counted stock" depends on the current number, so guard it against a stale screen.
        ...(adjustMode === "set" && type === "adjustment" ? { expectedStock: curr } : {}),
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
        live_price: addLivePrice ? Number(addLivePrice) : null,
        category_id: catId,
        min_stock: Number(addMinStock) || 5,
        opening_stock: (effectiveShopId || shopId)
          ? { shopId: Number(effectiveShopId || shopId), quantity: Number(addOpeningStock) || 0 }
          : undefined,
      });
      setShowAddModal(false);
      setAddName("");
      setAddSku("");
      setAddSellingPrice("");
      setAddPurchasePrice("");
      setAddLivePrice("");
      setToastMsg("✓ Product created successfully");
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to create product"));
    } finally {
      setAddingProduct(false);
    }
  }

  // Open Edit Product Modal
  function openEdit(p: Product) {
    setSelectedProduct(p);
    setEditName(p.name);
    setEditPurchasePrice(String(p.purchase_price || 0));
    setEditSellingPrice(String(p.selling_price || 0));
    setEditLivePrice(p.live_price ? String(p.live_price) : "");
    setEditMinStock(String(p.min_stock || 5));
    setShowEditModal(true);
  }
  void openAdjust;
  void openEdit;

  // Save Edit Product Modal
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setEditingProduct(true);
    try {
      await updateProduct(selectedProduct.id, {
        name: editName.trim(),
        purchase_price: Number(editPurchasePrice) || 0,
        selling_price: Number(editSellingPrice) || 0,
        live_price: editLivePrice ? Number(editLivePrice) : null,
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

  // View & Full Edit Modal Handlers
  function handleStartViewEdit(p: Product) {
    const pp = Number(p.purchase_price ?? 0);
    const sp = Number(p.selling_price ?? 0);
    const lp = p.live_price ? String(p.live_price) : "";
    const margin = sp > 0 ? (((sp - pp) / sp) * 100).toFixed(1) : "0.0";
    setViewEditForm({
      name: p.name || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      brand: p.brand || "",
      category_id: p.category_id ?? p.category?.id ?? null,
      purchase_price: String(pp),
      selling_price: String(sp),
      live_price: lp,
      margin_percent: margin,
      mrp: p.mrp ? String(p.mrp) : "",
      min_stock: String(p.min_stock ?? 5),
      description: p.description || "",
      status: p.status === "inactive" ? "inactive" : "active",
    });
    setViewPhotoFile(null);
    setViewPhotoPreview(null);
    setIsEditingView(true);
  }

  function handleViewEditFieldChange(
    field:
      | "name"
      | "sku"
      | "barcode"
      | "brand"
      | "category_id"
      | "purchase_price"
      | "selling_price"
      | "live_price"
      | "margin_percent"
      | "mrp"
      | "min_stock"
      | "description"
      | "status",
    value: any
  ) {
    if (field === "purchase_price") {
      const newPp = Math.max(0, Number(value) || 0);
      const sp = Math.max(0, Number(viewEditForm.selling_price) || 0);
      const newMargin = sp > 0 ? (((sp - newPp) / sp) * 100).toFixed(1) : "0.0";
      setViewEditForm((prev) => ({
        ...prev,
        purchase_price: value,
        margin_percent: newMargin,
      }));
    } else if (field === "selling_price") {
      const pp = Math.max(0, Number(viewEditForm.purchase_price) || 0);
      const newSp = Math.max(0, Number(value) || 0);
      const newMargin = newSp > 0 ? (((newSp - pp) / newSp) * 100).toFixed(1) : "0.0";
      setViewEditForm((prev) => ({
        ...prev,
        selling_price: value,
        margin_percent: newMargin,
      }));
    } else if (field === "margin_percent") {
      const pp = Math.max(0, Number(viewEditForm.purchase_price) || 0);
      const targetMargin = Math.min(99.9, Math.max(-100, Number(value) || 0));
      // Formula: selling_price = purchase_price / (1 - margin / 100)
      const calculatedSp =
        targetMargin < 100 && pp > 0
          ? (pp / (1 - targetMargin / 100)).toFixed(2)
          : viewEditForm.selling_price;
      setViewEditForm((prev) => ({
        ...prev,
        margin_percent: value,
        selling_price: calculatedSp,
      }));
    } else {
      setViewEditForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  }

  function handleViewPhotoSelect(file: File | null) {
    if (!file) {
      setViewPhotoFile(null);
      setViewPhotoPreview(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Please select an image smaller than 10MB");
      return;
    }
    setViewPhotoFile(file);
    const url = URL.createObjectURL(file);
    setViewPhotoPreview(url);
  }

  async function handleSaveViewEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!viewProduct) return;
    if (!viewEditForm.name.trim()) {
      alert("Product name is required");
      return;
    }
    setSavingViewEdit(true);
    try {
      let updatedImages = viewProduct.images;

      // 1. Upload photo if selected
      if (viewPhotoFile) {
        try {
          const uploadRes = await uploadProductImages(viewProduct.id, [viewPhotoFile]);
          if (uploadRes.data?.data && uploadRes.data.data.length > 0) {
            updatedImages = uploadRes.data.data;
          }
        } catch (uploadErr: any) {
          console.warn("Photo upload warning:", uploadErr);
        }
      }

      // 2. Update product attributes
      const payload: Partial<Product> = {
        name: viewEditForm.name.trim(),
        sku: viewEditForm.sku.trim(),
        barcode: viewEditForm.barcode.trim() || undefined,
        brand: viewEditForm.brand.trim() || undefined,
        category_id: viewEditForm.category_id || undefined,
        purchase_price: Number(viewEditForm.purchase_price) || 0,
        selling_price: Number(viewEditForm.selling_price) || 0,
        live_price: viewEditForm.live_price ? Number(viewEditForm.live_price) : null,
        mrp: viewEditForm.mrp ? Number(viewEditForm.mrp) : undefined,
        min_stock: Number(viewEditForm.min_stock) || 5,
        description: viewEditForm.description.trim() || undefined,
        status: viewEditForm.status,
      };

      const updateRes = await updateProduct(viewProduct.id, payload);
      const serverProduct = updateRes.data?.data;
      const finalProduct: Product = {
        ...viewProduct,
        ...(serverProduct || payload),
        images: updatedImages && updatedImages.length > 0 ? updatedImages : viewProduct.images,
      };
      if (viewEditForm.category_id) {
        const cat = categories.find((c) => c.id === viewEditForm.category_id);
        if (cat) finalProduct.category = cat;
      }

      setViewProduct(finalProduct);
      if (finalProduct.images && finalProduct.images.length > 0) {
        const primary =
          finalProduct.images.find((i) => i.is_primary)?.url || finalProduct.images[0]?.url;
        setActiveDetailImage(primary || null);
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === finalProduct.id ? { ...p, ...finalProduct } : p))
      );
      setIsEditingView(false);
      setViewPhotoFile(null);
      setViewPhotoPreview(null);
      setToastMsg("✓ Product details, photo & margin updated successfully");
      loadData();
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to update product details"));
    } finally {
      setSavingViewEdit(false);
    }
  }

  // Delete Product
  function handleDeleteProduct(p: Product) {
    setProductToDelete(p);
  }

  async function handleConfirmDelete(permanent: boolean) {
    if (!productToDelete) return;
    const target = productToDelete;
    setDeletingProduct(true);
    try {
      const res = await deleteProduct(target.id, permanent);
      const action = res.data?.data?.action || (permanent ? "deleted" : "deactivated");
      // Immediately remove from inventory table view
      setProducts((prev) => prev.filter((p) => p.id !== target.id));
      if (action === "deleted") {
        setToastMsg(`✓ Product "${target.name}" permanently deleted`);
      } else {
        setToastMsg(`✓ Product "${target.name}" deactivated & removed from inventory`);
      }
      setProductToDelete(null);
    } catch (err: any) {
      alert(apiErrorMessage(err, "Failed to delete product"));
    } finally {
      setDeletingProduct(false);
    }
  }

  // Export CSV
  function handleExportCSV() {
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Purchase Price",
      "Selling Price",
      "Margin %",
      "Stock",
      "Stock Value",
      "Status",
    ];
    const rows = filteredProducts.map((p) => {
      const s = getProductStock(p);
      const pp = Number(p.purchase_price || 0);
      const sp = Number(p.selling_price || 0);
      const margin = sp > 0 ? (((sp - pp) / sp) * 100).toFixed(1) : "0.0";
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.category?.name || "—",
        pp,
        sp,
        `${margin}%`,
        s,
        (s * pp).toFixed(2),
        p.status || "active",
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `NSYU_Inventory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-12"}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white px-4 py-2.5 rounded-xl shadow-pop ring-1 ring-white/10 text-xs font-bold flex items-center gap-2 animate-fade-in">
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
      {/* 1. HEADER TITLE & TOP ACTIONS                                   */}
      {/* ============================================================== */}
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-800">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h1 className="page-title">
                Inventory
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Track stock levels, monitor low stock items, and audit inventory movements.
            </p>
          </div>

          {/* Action Buttons: Import, Export, Add Product */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
              <svg
                className="w-4 h-4 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Live Product Catalog & Stock List
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {totalProducts} products listed • Click Eye icon to view details & upload photo
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-[#047857] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-xs font-black">+</span>
              <span>Add Product</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SUMMARY METRIC CARDS                                         */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Products */}
        <div
          onClick={() => setActiveFilter("All")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "All"
              ? "border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">Total Products</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">
                {totalProducts}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
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

        {/* Total Stock */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">Total Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">
                {totalStock.toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-slate-500">units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => setActiveFilter("Low Stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "Low Stock"
              ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-500"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">Low Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">
                {lowStockCount}
              </div>
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setActiveFilter("Out of Stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition shadow-xs hover:shadow-sm ${
            activeFilter === "Out of Stock"
              ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-500"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">Out of Stock</div>
              <div className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight tabular">
                {outOfStockCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CATEGORY QUICK FILTER CHIPS (Moved to Top/Left per reference)   */}
      {/* ============================================================== */}
      {activeFilter !== "Stock Movement" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              categoryFilter === "All"
                ? "bg-[#064E3B] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>All Categories</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                categoryFilter === "All"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {totalProducts}
            </span>
          </button>
          {categories.map((c) => {
            const count = categoryCounts[c.name] || 0;
            const isSelected = categoryFilter === c.name;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.name)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#064E3B] text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black font-mono border ${
                    isSelected
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-emerald-100 text-emerald-900 border-emerald-300"
                  }`}
                >
                  {getCategoryAlias(c.name, c.alias)}
                </span>
                <span>{c.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. FILTERS BAR (Category Moved Right-to-Left, before Search)   */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("All")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "All"
                ? "bg-white text-emerald-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Products ({totalProducts})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Live")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === "Live"
                ? "bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Live ({liveCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Offline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === "Offline"
                ? "bg-white text-slate-800 shadow-xs ring-1 ring-slate-400/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Offline ({offlineCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Low Stock")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Low Stock"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Low Stock ({lowStockCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Out of Stock")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Out of Stock"
                ? "bg-white text-rose-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("Stock Movement")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeFilter === "Stock Movement"
                ? "bg-white text-emerald-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Stock Movement
          </button>
        </div>

        {/* Requirement 4: Category Dropdown MOVED RIGHT TO LEFT (placed BEFORE search bar) */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 max-w-md">
          {activeFilter !== "Stock Movement" && (
            <div className="relative shrink-0">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 outline-none hover:bg-emerald-100/60 transition cursor-pointer appearance-none shadow-xs"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <svg
                className="w-3.5 h-3.5 text-emerald-700 absolute left-2.5 top-2.5 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <svg
                className="w-3 h-3 text-emerald-700 absolute right-2.5 top-2.5 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}

          {/* Search Input on the right of category */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name, SKU or barcode..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Advanced / Column Filters Toggle Button */}
          {activeFilter !== "Stock Movement" && (
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                showAdvancedFilters || hasActiveColumnFilters
                  ? "bg-[#064E3B] text-white border-emerald-700 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
              title="Filter by Category, SKU, Show, Stock, Purchase Price, Selling Price, Live Price, Margin %, Stock Value"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters</span>
              {hasActiveColumnFilters && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-emerald-950 text-[10px] font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips & Clear All */}
      {hasActiveColumnFilters && activeFilter !== "Stock Movement" && (
        <div className="flex flex-wrap items-center gap-1.5 bg-emerald-50/70 border border-emerald-200/90 p-2.5 rounded-2xl shadow-2xs">
          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1 mr-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Active Filters ({activeFilterCount}):
          </span>

          {categoryFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Category: {categoryFilter}
              <button
                type="button"
                onClick={() => setCategoryFilter("All")}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove category filter"
              >
                ✕
              </button>
            </span>
          )}

          {skuFilter.trim() && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs font-mono">
              SKU: "{skuFilter}"
              <button
                type="button"
                onClick={() => setSkuFilter("")}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove SKU filter"
              >
                ✕
              </button>
            </span>
          )}

          {showFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs uppercase">
              Show: {showFilter}
              <button
                type="button"
                onClick={() => setShowFilter("all")}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove show filter"
              >
                ✕
              </button>
            </span>
          )}

          {stockStatusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Stock: {stockStatusFilter === "in_stock" ? "In Stock (>0)" : stockStatusFilter === "low_stock" ? "Low Stock (≤min)" : "Out of Stock (0)"}
              <button
                type="button"
                onClick={() => setStockStatusFilter("all")}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove stock status filter"
              >
                ✕
              </button>
            </span>
          )}

          {(minStockFilter !== "" || maxStockFilter !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Stock Qty: {minStockFilter || "0"} - {maxStockFilter || "∞"}
              <button
                type="button"
                onClick={() => {
                  setMinStockFilter("");
                  setMaxStockFilter("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove stock quantity filter"
              >
                ✕
              </button>
            </span>
          )}

          {(minPurchasePrice !== "" || maxPurchasePrice !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Purchase: ₹{minPurchasePrice || "0"} - ₹{maxPurchasePrice || "∞"}
              <button
                type="button"
                onClick={() => {
                  setMinPurchasePrice("");
                  setMaxPurchasePrice("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove purchase price filter"
              >
                ✕
              </button>
            </span>
          )}

          {(minSellingPrice !== "" || maxSellingPrice !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Selling: ₹{minSellingPrice || "0"} - ₹{maxSellingPrice || "∞"}
              <button
                type="button"
                onClick={() => {
                  setMinSellingPrice("");
                  setMaxSellingPrice("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove selling price filter"
              >
                ✕
              </button>
            </span>
          )}

          {(minLivePrice !== "" || maxLivePrice !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Live: ₹{minLivePrice || "0"} - ₹{maxLivePrice || "∞"}
              <button
                type="button"
                onClick={() => {
                  setMinLivePrice("");
                  setMaxLivePrice("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove live price filter"
              >
                ✕
              </button>
            </span>
          )}

          {(marginRangeFilter !== "all" || minMarginFilter !== "" || maxMarginFilter !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Margin: {marginRangeFilter === "high" ? ">25%" : marginRangeFilter === "medium" ? "10-25%" : marginRangeFilter === "low" ? "0-10%" : marginRangeFilter === "negative" ? "<0% (Loss)" : `${minMarginFilter || "0"}% - ${maxMarginFilter || "100"}%`}
              <button
                type="button"
                onClick={() => {
                  setMarginRangeFilter("all");
                  setMinMarginFilter("");
                  setMaxMarginFilter("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove margin filter"
              >
                ✕
              </button>
            </span>
          )}

          {(minStockValue !== "" || maxStockValue !== "") && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              Stock Value: ₹{minStockValue || "0"} - ₹{maxStockValue || "∞"}
              <button
                type="button"
                onClick={() => {
                  setMinStockValue("");
                  setMaxStockValue("");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Remove stock value filter"
              >
                ✕
              </button>
            </span>
          )}

          {sortField !== "recency" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-950 text-xs font-bold shadow-2xs">
              Sorted: {sortField} ({sortDirection === "asc" ? "Asc" : "Desc"})
              <button
                type="button"
                onClick={() => {
                  setSortField("recency");
                  setSortDirection("asc");
                }}
                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                title="Reset sort"
              >
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleClearAllFilters}
            className="text-xs text-rose-600 hover:text-rose-800 font-black underline ml-auto px-2 py-0.5 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Expandable Advanced Filter Panel (Category, SKU, Show, Stock, Purchase, Selling, Live, Margin, Stock Value) */}
      {showAdvancedFilters && activeFilter !== "Stock Movement" && (
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Filter by All 9 Inventory Dimensions
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(false)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* 1. Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">1. Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. SKU */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">2. SKU Code</label>
              <input
                type="text"
                placeholder="Search SKU..."
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 3. Show (Visibility) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">3. Show (Visibility)</label>
              <select
                value={showFilter}
                onChange={(e) => setShowFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Channels</option>
                <option value="both">BOTH (Marketplace + POS)</option>
                <option value="marketplace">MKT (Marketplace Only)</option>
                <option value="pos">POS (POS Billing Only)</option>
                <option value="hidden">HIDE (Hidden)</option>
              </select>
            </div>

            {/* 4. Stock Level */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">4. Stock</label>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Levels</option>
                <option value="in_stock">In Stock (&gt; 0)</option>
                <option value="low_stock">Low Stock (≤ Min Stock)</option>
                <option value="out_of_stock">Out of Stock (0)</option>
              </select>
            </div>

            {/* 5. Purchase Price Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">5. Purchase Price (₹)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  value={minPurchasePrice}
                  onChange={(e) => setMinPurchasePrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  value={maxPurchasePrice}
                  onChange={(e) => setMaxPurchasePrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 6. Selling Price Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">6. Selling Price (₹)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  value={minSellingPrice}
                  onChange={(e) => setMinSellingPrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  value={maxSellingPrice}
                  onChange={(e) => setMaxSellingPrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 7. Live Price Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">7. Live Price (₹)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  value={minLivePrice}
                  onChange={(e) => setMinLivePrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  value={maxLivePrice}
                  onChange={(e) => setMaxLivePrice(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 8. Margin (%) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">8. Margin (%)</label>
              <select
                value={marginRangeFilter}
                onChange={(e) => setMarginRangeFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Margins</option>
                <option value="high">&gt; 25% (High Margin)</option>
                <option value="medium">10% - 25% (Medium Margin)</option>
                <option value="low">0% - 10% (Low Margin)</option>
                <option value="negative">&lt; 0% (Loss Making)</option>
              </select>
            </div>

            {/* 9. Stock Value Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">9. Stock Value (₹)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  value={minStockValue}
                  onChange={(e) => setMinStockValue(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  value={maxStockValue}
                  onChange={(e) => setMaxStockValue(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. INVENTORY TABLE                                              */}
      {/* Columns: Image/Name | Category (Moved Left) | SKU | Live (Toggle) */}
      {/*          Stock (Editable) | Purchase Price | Selling Price     */}
      {/*          Margin % (Editable) | Stock Value | Action Icons      */}
      {/* ============================================================== */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 mt-2 font-medium">Loading inventory...</p>
        </div>
      ) : activeFilter === "Stock Movement" ? (
        /* Stock Movement Audit Table */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Inventory Movement History
            </h3>
            <span className="text-xs text-slate-500">
              {filteredMovements.length} logged transaction(s)
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Product Name & SKU</th>
                <th className="p-3">Movement Type</th>
                <th className="p-3 text-center">Quantity</th>
                <th className="p-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No movement records found.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m: any) => {
                  const qty = Number(m.quantity || 0);
                  const isInc = [
                    "opening",
                    "purchase",
                    "customer_return",
                    "transfer_in",
                  ].includes((m.type || m.movement_type || "").toLowerCase());
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {new Date(m.created_at || m.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate" title={m.product?.name}>
                          {m.product?.name || `Product #${m.product_id}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {m.product?.sku || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {m.type || m.movement_type}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-center font-black ${
                          isInc ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {isInc ? `+${qty}` : `-${qty}`}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">
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
        <>
        {/* Main Inventory Table with All 5 Requested Features (Desktop) */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead className="bg-[#064E3B] text-white font-bold uppercase text-[10px] tracking-wider select-none">
              {/* Row 1: Sortable Column Headers */}
              <tr>
                <th className="p-3 w-52 max-w-[210px]">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="group inline-flex items-center gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer"
                    title="Click to sort by Product Name"
                  >
                    <span>Product</span>
                    {renderSortIndicator("name")}
                  </button>
                </th>
                <th className="p-2 text-center w-28">
                  <button
                    type="button"
                    onClick={() => handleSort("category")}
                    className="group inline-flex items-center justify-center gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer"
                    title="Click to sort by Category"
                  >
                    <span>Category</span>
                    {renderSortIndicator("category")}
                  </button>
                </th>
                <th className="p-2 w-24">
                  <button
                    type="button"
                    onClick={() => handleSort("sku")}
                    className="group inline-flex items-center gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer"
                    title="Click to sort by SKU"
                  >
                    <span>SKU</span>
                    {renderSortIndicator("sku")}
                  </button>
                </th>
                <th className="p-2 text-center w-20" title="BOTH = Marketplace + POS · MKT = Marketplace only · POS = POS billing only · HIDE = hidden">
                  <button
                    type="button"
                    onClick={() => handleSort("show")}
                    className="group inline-flex items-center justify-center gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer"
                    title="Click to sort by Channel Visibility"
                  >
                    <span>Show</span>
                    {renderSortIndicator("show")}
                  </button>
                </th>
                <th className="p-2 text-center w-24">
                  <button
                    type="button"
                    onClick={() => handleSort("stock")}
                    className="group inline-flex items-center justify-center gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer"
                    title="Click to sort by Stock quantity"
                  >
                    <span>Stock</span>
                    {renderSortIndicator("stock")}
                  </button>
                </th>
                <th className="p-2 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleSort("purchasePrice")}
                    className="group inline-flex items-center justify-end gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer w-full"
                    title="Click to sort by Purchase Price"
                  >
                    <span>Purchase Price</span>
                    {renderSortIndicator("purchasePrice")}
                  </button>
                </th>
                <th className="p-2 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleSort("sellingPrice")}
                    className="group inline-flex items-center justify-end gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer w-full"
                    title="Click to sort by Selling Price"
                  >
                    <span>Selling Price</span>
                    {renderSortIndicator("sellingPrice")}
                  </button>
                </th>
                {/* Arrow Header: Copy Selling Price to Live Price */}
                <th className="p-2 text-center w-9">
                  <button
                    type="button"
                    disabled={bulkSyncing}
                    onClick={handleSyncAllLivePrices}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-800/80 hover:bg-emerald-600 border border-emerald-500/50 text-white transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                    title="Bulk Sync: Click to copy Selling Price → Live Price for all filtered products"
                    aria-label="Bulk sync Selling Price to Live Price"
                  >
                    {bulkSyncing ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="p-2 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleSort("livePrice")}
                    className="group inline-flex items-center justify-end gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer w-full"
                    title="Click to sort by Live Price"
                  >
                    <span>Live Price</span>
                    {renderSortIndicator("livePrice")}
                  </button>
                </th>
                <th className="p-2 text-right w-24">
                  <button
                    type="button"
                    onClick={() => handleSort("margin")}
                    className="group inline-flex items-center justify-end gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer w-full"
                    title="Click to sort by Margin %"
                  >
                    <span>Margin (%)</span>
                    {renderSortIndicator("margin")}
                  </button>
                </th>
                <th className="p-2 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleSort("stockValue")}
                    className="group inline-flex items-center justify-end gap-1 font-bold text-white hover:text-emerald-200 transition cursor-pointer w-full"
                    title="Click to sort by Stock Value"
                  >
                    <span>Stock Value</span>
                    {renderSortIndicator("stockValue")}
                  </button>
                </th>
                <th className="p-2 text-center w-20">Actions</th>
              </tr>

              {/* Row 2: In-Table Column Filters for All 9 Requested Columns */}
              <tr className="bg-[#033b2c] border-t border-emerald-700/60 font-normal lowercase tracking-normal">
                {/* Product Column Info */}
                <th className="p-2 w-52 max-w-[210px]">
                  <div className="flex items-center justify-between text-[10px] text-emerald-200/90 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                      Filters:
                    </span>
                    {hasActiveColumnFilters && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="text-amber-300 hover:text-white underline lowercase font-bold text-[10px] cursor-pointer"
                      >
                        clear
                      </button>
                    )}
                  </div>
                </th>

                {/* 1. Category Filter */}
                <th className="p-1.5 w-28 text-center">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-1.5 py-1 text-[10px] font-semibold bg-emerald-950/80 text-emerald-100 border border-emerald-600/70 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    title="Filter by Category"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </th>

                {/* 2. SKU Filter */}
                <th className="p-1.5 w-24">
                  <input
                    type="text"
                    value={skuFilter}
                    onChange={(e) => setSkuFilter(e.target.value)}
                    placeholder="SKU..."
                    className="w-full px-1.5 py-1 text-[10px] bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    title="Filter by SKU"
                  />
                </th>

                {/* 3. Show Filter */}
                <th className="p-1.5 w-20 text-center">
                  <select
                    value={showFilter}
                    onChange={(e) => setShowFilter(e.target.value as any)}
                    className="w-full px-1 py-1 text-[10px] font-semibold bg-emerald-950/80 text-emerald-100 border border-emerald-600/70 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer uppercase"
                    title="Filter by Show (Visibility)"
                  >
                    <option value="all">All</option>
                    <option value="both">BOTH</option>
                    <option value="marketplace">MKT</option>
                    <option value="pos">POS</option>
                    <option value="hidden">HIDE</option>
                  </select>
                </th>

                {/* 4. Stock Filter */}
                <th className="p-1.5 w-24 text-center">
                  <select
                    value={stockStatusFilter}
                    onChange={(e) => setStockStatusFilter(e.target.value as any)}
                    className="w-full px-1.5 py-1 text-[10px] font-semibold bg-emerald-950/80 text-emerald-100 border border-emerald-600/70 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    title="Filter by Stock level"
                  >
                    <option value="all">All Stock</option>
                    <option value="in_stock">In Stock (&gt;0)</option>
                    <option value="low_stock">Low (≤min)</option>
                    <option value="out_of_stock">Out (0)</option>
                  </select>
                </th>

                {/* 5. Purchase Price Filter */}
                <th className="p-1.5 w-28 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={minPurchasePrice}
                      onChange={(e) => setMinPurchasePrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Min Purchase Price"
                    />
                    <span className="text-emerald-400/60">-</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={maxPurchasePrice}
                      onChange={(e) => setMaxPurchasePrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Max Purchase Price"
                    />
                  </div>
                </th>

                {/* 6. Selling Price Filter */}
                <th className="p-1.5 w-28 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={minSellingPrice}
                      onChange={(e) => setMinSellingPrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Min Selling Price"
                    />
                    <span className="text-emerald-400/60">-</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={maxSellingPrice}
                      onChange={(e) => setMaxSellingPrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Max Selling Price"
                    />
                  </div>
                </th>

                {/* Bulk Sync Column Spacer */}
                <th className="p-1 w-9 text-center">
                  <span className="text-emerald-400/30 text-[10px]">—</span>
                </th>

                {/* 7. Live Price Filter */}
                <th className="p-1.5 w-28 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={minLivePrice}
                      onChange={(e) => setMinLivePrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Min Live Price"
                    />
                    <span className="text-emerald-400/60">-</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={maxLivePrice}
                      onChange={(e) => setMaxLivePrice(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Max Live Price"
                    />
                  </div>
                </th>

                {/* 8. Margin (%) Filter */}
                <th className="p-1.5 w-24 text-right">
                  <select
                    value={marginRangeFilter}
                    onChange={(e) => setMarginRangeFilter(e.target.value as any)}
                    className="w-full px-1.5 py-1 text-[10px] font-semibold bg-emerald-950/80 text-emerald-100 border border-emerald-600/70 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    title="Filter by Margin %"
                  >
                    <option value="all">All</option>
                    <option value="high">&gt; 25%</option>
                    <option value="medium">10-25%</option>
                    <option value="low">0-10%</option>
                    <option value="negative">&lt; 0%</option>
                  </select>
                </th>

                {/* 9. Stock Value Filter */}
                <th className="p-1.5 w-28 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={minStockValue}
                      onChange={(e) => setMinStockValue(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Min Stock Value (₹)"
                    />
                    <span className="text-emerald-400/60">-</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={maxStockValue}
                      onChange={(e) => setMaxStockValue(e.target.value)}
                      className="w-12 px-1 py-1 text-[10px] text-right bg-emerald-950/80 text-emerald-100 placeholder-emerald-400/50 border border-emerald-600/70 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                      title="Max Stock Value (₹)"
                    />
                  </div>
                </th>

                {/* Action Reset Button */}
                <th className="p-1.5 w-20 text-center">
                  {hasActiveColumnFilters ? (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px] uppercase tracking-wider transition shadow-2xs cursor-pointer"
                      title="Reset all filters"
                    >
                      Reset
                    </button>
                  ) : (
                    <span className="text-emerald-400/40 text-[9px] uppercase font-bold tracking-wider">
                      Filters
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-600">No products match the selected inventory filter.</p>
                    {hasActiveColumnFilters && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isEditing = editingRowId === p.id && inlineDraft !== null;
                  const stock = getProductStock(p);
                  const purchasePrice = Number(p.purchase_price || 0);
                  const sellingPrice = Number(p.selling_price || 0);
                  const stockValue = Math.max(0, stock) * purchasePrice;
                  const coverImg = (
                    p.images?.find((i) => i.is_primary) || p.images?.[0]
                  )?.url;
                  const imgSrc = coverImg ? resolveAssetUrl(coverImg) : null;

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        isEditing
                          ? "bg-emerald-50/40 ring-1 ring-emerald-500/50"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Product Image & Name */}
                      <td className="p-2.5 w-52 max-w-[210px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            onClick={() => {
                              setViewProduct(p);
                              setActiveDetailImage(coverImg || null);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-emerald-500 transition"
                            title="Click to view full details"
                          >
                            {imgSrc ? (
                              <img
                                src={imgSrc || undefined}
                                alt=""
                                className="w-full h-full object-contain p-0.5 hover:scale-110 transition-transform duration-200"
                              />
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">
                                {p.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                setViewProduct(p);
                                setActiveDetailImage(coverImg || null);
                              }}
                              className="font-bold text-slate-900 truncate block w-full hover:text-emerald-700 transition text-left text-xs leading-snug"
                              title={p.name}
                            >
                              {p.name}
                            </button>
                            <div
                              className="text-[10px] text-slate-400 font-medium truncate block w-full"
                              title={p.brand || undefined}
                            >
                              {p.brand || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requirement 4: Category column on the LEFT */}
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <select
                            value={inlineDraft.categoryId || ""}
                            onChange={(e) =>
                              handleDraftChange(
                                "categoryId",
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none w-full max-w-[130px]"
                          >
                            <option value="">No Category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {getCategoryAlias(c.name, c.alias)} - {c.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            title={p.category?.name ? `Category: ${p.category.name}` : "General"}
                            className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-black text-xs font-mono tracking-wider border border-emerald-300 whitespace-nowrap shadow-2xs"
                          >
                            {getCategoryAlias(p.category?.name, (p.category as any)?.alias)}
                          </span>
                        )}
                      </td>

                      {/* SKU */}
                      <td className="p-2.5 font-mono text-slate-600 font-semibold max-w-[90px] truncate" title={p.sku}>
                        {p.sku}
                      </td>

                      {/* SHOW: where the product is offered (BOTH / MKT / POS / HIDE) */}
                      <td className="p-2.5 text-center">
                        <VisibilityBadge
                          value={effectiveVisibility(p)}
                          editable={canEditProducts}
                          saving={savingVisibilityId === p.id}
                          onChange={(v) => handleSetVisibility(p, v)}
                        />
                      </td>

                      {/* Quantity (Stock) - Direct Input */}
                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={inlineDraft.stockQuantity}
                              onChange={(e) =>
                                handleDraftChange("stockQuantity", e.target.value)
                              }
                              className="w-20 px-2 py-1 text-center font-black text-xs bg-white border border-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                              title="Adjust Stock Quantity"
                            />
                          </div>
                        ) : (
                          <DirectStockInput
                            productId={p.id}
                            initialStock={stock}
                            minStock={Number(p.min_stock ?? 5) || 5}
                            isSaving={savingStockId === p.id}
                            onSave={handleDirectStockSave}
                            product={p}
                          />
                        )}
                      </td>

                      {/* Requirement 3: Purchase Price - Editable Inline */}
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 text-xs mr-0.5 font-bold">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={inlineDraft.purchasePrice}
                              onChange={(e) =>
                                handleDraftChange("purchasePrice", e.target.value)
                              }
                              className="w-20 px-1.5 py-1 text-right font-bold text-xs bg-white border border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700">
                            {formatINR(purchasePrice)}
                          </span>
                        )}
                      </td>

                      {/* Requirement 3: Selling Price - Editable Inline */}
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 text-xs mr-0.5 font-bold">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={inlineDraft.sellingPrice}
                              onChange={(e) =>
                                handleDraftChange("sellingPrice", e.target.value)
                              }
                              className="w-20 px-1.5 py-1 text-right font-black text-xs bg-white border border-emerald-400 text-emerald-900 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {formatINR(sellingPrice)}
                          </span>
                        )}
                      </td>

                      {/* Arrow Icon Button: Selling Price => Live Price */}
                      <td className="p-2 text-center w-10 align-middle">
                        <button
                          type="button"
                          disabled={syncingLiveId === p.id}
                          onClick={() => handleQuickSetLivePrice(p)}
                          className="w-7 h-7 mx-auto rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 flex items-center justify-center transition shadow-2xs hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer group"
                          title={
                            isEditing
                              ? "Copy Selling Price to Live Price (Draft)"
                              : `Set Live Price = Selling Price (${formatINR(p.selling_price)})`
                          }
                          aria-label={`Set Live Price from Selling Price for ${p.name}`}
                        >
                          {syncingLiveId === p.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg
                              className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          )}
                        </button>
                      </td>

                      {/* Live Price - Online Customer Rate */}
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 text-xs mr-0.5 font-bold">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Live ₹"
                              value={inlineDraft.livePrice}
                              onChange={(e) =>
                                handleDraftChange("livePrice", e.target.value)
                              }
                              className="w-20 px-1.5 py-1 text-right font-black text-xs bg-white border border-emerald-400 text-emerald-900 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-bold tabular ${
                                p.live_price ? "text-emerald-700" : "text-slate-400"
                              }`}
                            >
                              {p.live_price ? formatINR(p.live_price) : "—"}
                            </span>
                            {Boolean(p.live_price) && (
                              <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">
                                Online
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Requirement 3: Margin (%) - Editable Inline with Real-Time Auto Calculation */}
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center justify-end">
                              <input
                                type="number"
                                step="0.1"
                                value={inlineDraft.marginPercent}
                                onChange={(e) =>
                                  handleDraftChange("marginPercent", e.target.value)
                                }
                                className="w-16 px-1.5 py-1 text-right font-black text-xs bg-emerald-50 border border-emerald-400 text-emerald-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                title="Edit margin % to auto-calculate selling price"
                              />
                              <span className="text-xs font-bold text-emerald-700 ml-0.5">
                                %
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ₹
                              {(
                                Number(inlineDraft.sellingPrice || 0) -
                                Number(inlineDraft.purchasePrice || 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          (() => {
                            const profit = sellingPrice - purchasePrice;
                            const marginPct =
                              sellingPrice > 0
                                ? ((profit / sellingPrice) * 100).toFixed(1)
                                : "0.0";
                            const isGood = Number(marginPct) >= 20;
                            const isWarn =
                              Number(marginPct) > 0 && Number(marginPct) < 20;
                            return (
                              <div className="text-right">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                                    isGood
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                                      : isWarn
                                      ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                                      : "bg-rose-50 text-rose-700 border border-rose-200/60"
                                  }`}
                                >
                                  {marginPct}%
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {formatINR(profit)}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </td>

                      {/* Stock Value */}
                      <td className="p-3 text-right font-black text-emerald-800">
                        {isEditing
                          ? formatINR(
                              Math.max(0, Number(inlineDraft.stockQuantity || 0)) *
                                Number(inlineDraft.purchasePrice || 0)
                            )
                          : formatINR(stockValue)}
                      </td>

                      {/* Requirement 1 & 5: Action Icons (Removed Adjust Button, Added View Details with Image, Edit, Delete) */}
                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Save Checkmark Icon */}
                            <button
                              type="button"
                              disabled={inlineSaving}
                              onClick={() => handleSaveInlineEdit(p)}
                              className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95 disabled:opacity-50"
                              title="Save Changes"
                              aria-label="Save Changes"
                            >
                              {inlineSaving ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                            {/* Cancel Cross Icon */}
                            <button
                              type="button"
                              disabled={inlineSaving}
                              onClick={handleCancelInlineEdit}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95"
                              title="Cancel"
                              aria-label="Cancel"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            {/* View Full Product Details (Eye) */}
                            {showViewOption && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewProduct(p);
                                  setIsEditingView(false);
                                  setViewPhotoFile(null);
                                  setViewPhotoPreview(null);
                                  const primary =
                                    p.images?.find((i) => i.is_primary)?.url ||
                                    p.images?.[0]?.url;
                                  setActiveDetailImage(primary || null);
                                }}
                                className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                                title="View Full Product Details & Photo"
                                aria-label="View Full Product Details"
                              >
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            )}

                            {/* Inline Edit Action Icon (Pencil) */}
                            <button
                              type="button"
                              onClick={() => handleStartInlineEdit(p)}
                              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95"
                              title="Quick Inline Edit (Margin, Stock, Category, Prices)"
                              aria-label="Quick Inline Edit"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            {/* Delete Action Icon (Trash) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p)}
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition shadow-xs hover:scale-105 active:scale-95"
                              title="Delete / Deactivate Product"
                              aria-label="Delete Product"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile App-Style Card Feed */}
        <div className="md:hidden space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">No products match the selected inventory filter.</p>
              {hasActiveColumnFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            filteredProducts.map((p) => {
              const stock = getProductStock(p);
              const pp = Number(p.purchase_price || 0);
              const sp = Number(p.selling_price || 0);
              const lp = Number(p.live_price || sp);
              const margin = sp > 0 ? (((sp - pp) / sp) * 100).toFixed(1) : "0.0";
              const coverImg = (p.images?.find((i) => i.is_primary) || p.images?.[0])?.url;
              const imgSrc = coverImg ? resolveAssetUrl(coverImg) : null;
              const catName = p.category?.name || "General";

              return (
                <div key={p.id} className="mobile-card flex flex-col gap-3">
                  {/* Top Row: Thumbnail + Title + SKU + Category + Live Toggle */}
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => {
                        setViewProduct(p);
                        setActiveDetailImage(coverImg || null);
                      }}
                      className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                      ) : (
                        <span className="text-slate-400 font-bold text-base">{p.name.charAt(0)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 uppercase">
                          {catName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {p.sku || p.barcode || "—"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setViewProduct(p);
                          setActiveDetailImage(coverImg || null);
                        }}
                        className="max-w-full text-[13.5px] font-bold text-navy-900 leading-snug text-left line-clamp-2 [overflow-wrap:anywhere] hover:text-emerald-700"
                      >
                        {p.name}
                      </button>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-medium">{p.brand || "—"}</div>
                    </div>

                    {/* SHOW badge */}
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Show</span>
                      <VisibilityBadge
                        value={effectiveVisibility(p)}
                        editable={canEditProducts}
                        saving={savingVisibilityId === p.id}
                        onChange={(v) => handleSetVisibility(p, v)}
                        size="md"
                      />
                    </div>
                  </div>

                  {/* Middle Row: Stock Stepper & Status */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Stock Quantity</div>
                      <div className="text-[11px] text-slate-400">
                        Value: <strong className="text-slate-700">{formatINR(Math.max(0, stock) * pp)}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DirectStockInput
                        productId={p.id}
                        initialStock={stock}
                        minStock={Number(p.min_stock ?? 5) || 5}
                        isSaving={savingStockId === p.id}
                        onSave={handleDirectStockSave}
                        product={p}
                      />
                    </div>
                  </div>

                  {/* Pricing Row: Purchase, Selling, Live Price, Margin */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Purchase</div>
                      <div className="text-xs font-bold text-slate-700 tabular">{formatINR(pp)}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100/80">
                      <div className="text-[10px] text-emerald-800 font-semibold uppercase">Selling</div>
                      <div className="text-xs font-bold text-emerald-900 tabular">{formatINR(sp)}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-50/70 border border-amber-100/80">
                      <div className="text-[10px] text-amber-800 font-semibold uppercase">Margin</div>
                      <div className="text-xs font-bold text-amber-900 tabular">{margin}%</div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickSetLivePrice(p)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 active:scale-95"
                    >
                      <span>Live: {formatINR(lp)}</span>
                      <span className="text-slate-400">→ Sync</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartInlineEdit(p)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] hover:bg-blue-100 active:scale-95"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewProduct(p);
                          setActiveDetailImage(coverImg || null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 active:scale-95"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
      )}

      {/* ============================================================== */}
      {/* 5. VIEW & FULL EDIT PRODUCT DETAIL MODAL (With Photo & Margin)  */}
      {/* ============================================================== */}
      {viewProduct &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-pop animate-scale-in border border-border space-y-5 max-h-[92dvh] overflow-y-auto">
              {!isEditingView ? (
                /* =================== VIEW MODE =================== */
                <>
                  {/* Modal Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                          {viewProduct.category?.name || "General Category"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            viewProduct.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {viewProduct.status === "active" ? "● Live Product" : "○ Offline"}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                        {viewProduct.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span>SKU: {viewProduct.sku}</span>
                        {viewProduct.barcode && (
                          <span>• Barcode: {viewProduct.barcode}</span>
                        )}
                        {viewProduct.brand && <span>• Brand: {viewProduct.brand}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartViewEdit(viewProduct)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Edit all product details, photo & margin"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewProduct(null)}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Product Image and Pricing / Stock Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Product Image / Icon Frame */}
                    <div className="space-y-2">
                      <div className="w-full h-60 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-4 relative overflow-hidden group">
                        {activeDetailImage ? (
                          <img
                            src={resolveAssetUrl(activeDetailImage) || undefined}
                            alt={viewProduct.name}
                            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 text-center p-4">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                              <svg className="w-8 h-8 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              No Photo Uploaded
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              Click "Edit Details" to upload a photo / icon
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Thumbnail Strip (if multiple images exist) */}
                      {viewProduct.images && viewProduct.images.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {viewProduct.images.map((img) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setActiveDetailImage(img.url)}
                              className={`w-12 h-12 rounded-xl border p-1 bg-white shrink-0 transition overflow-hidden cursor-pointer ${
                                activeDetailImage === img.url
                                  ? "border-emerald-600 ring-2 ring-emerald-500/30"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <img
                                src={resolveAssetUrl(img.url) || undefined}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pricing, Margin & Stock Details */}
                    <div className="space-y-3 text-xs">
                      {/* Stock on Hand Card */}
                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">Stock Availability:</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                              getProductStock(viewProduct) <= 0
                                ? "bg-rose-100 text-rose-700"
                                : getProductStock(viewProduct) <= Number(viewProduct.min_stock || 5)
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {getProductStock(viewProduct) <= 0
                              ? "Out of Stock"
                              : getProductStock(viewProduct) <= Number(viewProduct.min_stock || 5)
                              ? "Low Stock"
                              : "In Stock"}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold tracking-tight text-navy-900 tabular">
                            {getProductStock(viewProduct)}{" "}
                            <span className="text-xs font-normal text-slate-500">units on hand</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Min Alert: {viewProduct.min_stock ?? 5} units
                          </span>
                        </div>
                      </div>

                      {/* Pricing & Margin Breakdown */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Purchase Price (Cost):</span>
                          <span className="font-bold text-slate-800">
                            {formatINR(viewProduct.purchase_price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Selling Price (Retail):</span>
                          <span className="font-black text-emerald-800 text-sm">
                            {formatINR(viewProduct.selling_price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Live Price (Online):</span>
                          <span className="font-bold text-emerald-700">
                            {viewProduct.live_price ? formatINR(viewProduct.live_price) : "(Same as Selling Price)"}
                          </span>
                        </div>
                        {viewProduct.mrp && viewProduct.mrp > viewProduct.selling_price && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>MRP:</span>
                            <span className="line-through">{formatINR(viewProduct.mrp)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-slate-700">Gross Margin:</span>
                          <div className="text-right">
                            {(() => {
                              const pp = Number(viewProduct.purchase_price || 0);
                              const sp = Number(viewProduct.selling_price || 0);
                              const profit = sp - pp;
                              const pct = sp > 0 ? ((profit / sp) * 100).toFixed(1) : "0.0";
                              return (
                                <div>
                                  <span className="font-black text-emerald-700 text-sm">{pct}%</span>
                                  <span className="text-[11px] text-slate-500 ml-1">
                                    ({formatINR(profit)}/unit)
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold">Total Stock Value:</span>
                          <span className="font-black text-slate-900">
                            {formatINR(
                              Math.max(0, getProductStock(viewProduct)) *
                                Number(viewProduct.purchase_price || 0)
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Catalog Visibility Toggle in Modal */}
                      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800">Show in</div>
                          <div className="text-[10px] text-slate-500">
                            {VISIBILITY_META[effectiveVisibility(viewProduct)].hint}
                          </div>
                        </div>
                        <VisibilityBadge
                          value={effectiveVisibility(viewProduct)}
                          editable={canEditProducts}
                          saving={savingVisibilityId === viewProduct.id}
                          onChange={(v) => handleSetVisibility(viewProduct, v)}
                          size="md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description (if available) */}
                  {viewProduct.description && (
                    <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-600">
                      <span className="font-bold text-slate-800 block mb-1">Product Description:</span>
                      <p className="leading-relaxed">{viewProduct.description}</p>
                    </div>
                  )}

                  {/* Product Movement Audit History */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Recent Stock Movements for this Product
                    </h4>
                    {(() => {
                      const prodMovements = history.filter(
                        (m: any) => m.product_id === viewProduct.id
                      );
                      if (prodMovements.length === 0) {
                        return (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                            No recent inventory movements recorded for this item.
                          </div>
                        );
                      }
                      return (
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                              <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Type</th>
                                <th className="p-2 text-center">Change</th>
                                <th className="p-2">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {prodMovements.slice(0, 10).map((m: any) => {
                                const qty = Number(m.quantity || 0);
                                const isInc = [
                                  "opening",
                                  "purchase",
                                  "customer_return",
                                  "transfer_in",
                                ].includes((m.type || m.movement_type || "").toLowerCase());
                                return (
                                  <tr key={m.id} className="hover:bg-slate-50/80">
                                    <td className="p-2 text-slate-500 font-mono">
                                      {new Date(m.created_at || m.createdAt).toLocaleDateString(
                                        "en-IN"
                                      )}
                                    </td>
                                    <td className="p-2 font-bold capitalize text-slate-700">
                                      {m.type || m.movement_type}
                                    </td>
                                    <td
                                      className={`p-2 text-center font-black ${
                                        isInc ? "text-emerald-700" : "text-rose-600"
                                      }`}
                                    >
                                      {isInc ? `+${qty}` : `-${qty}`}
                                    </td>
                                    <td className="p-2 text-slate-500 truncate max-w-xs">
                                      {m.notes || m.reference_code || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!isPosVisible(viewProduct)}
                        onClick={() => {
                          addItemToPos(viewProduct, 1);
                          setToastMsg(`✓ Added "${viewProduct.name}" to POS cart`);
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                        title={isPosVisible(viewProduct) ? "Add this product to Current POS Bill" : "Not available in POS billing — change SHOW to BOTH or POS"}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                        </svg>
                        <span>Add to Cart</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartViewEdit(viewProduct)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>✏️ Edit Details</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewProduct(null)}
                      className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                /* =================== EDIT MODE =================== */
                <form onSubmit={handleSaveViewEdit} className="space-y-4">
                  {/* Modal Header for Edit */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span>✏️</span>
                        <span>Edit Product Details & Photo</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Product: {viewProduct.name} ({viewProduct.sku})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingView(false);
                          setViewPhotoFile(null);
                          setViewPhotoPreview(null);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewProduct(null);
                          setIsEditingView(false);
                          setViewPhotoFile(null);
                          setViewPhotoPreview(null);
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Photo / Icon Upload Card */}
                  <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                      {viewPhotoPreview ? (
                        <img src={viewPhotoPreview} alt="Preview" className="w-full h-full object-contain" />
                      ) : activeDetailImage || viewProduct.images?.[0]?.url ? (
                        <img
                          src={resolveAssetUrl(activeDetailImage || viewProduct.images?.[0]?.url || "") || undefined}
                          alt="Current"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl text-emerald-600">📦</span>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#047857] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>{viewPhotoFile ? "Change Selected Photo" : "Upload Photo / Icon"}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={(e) => handleViewPhotoSelect(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {viewPhotoFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setViewPhotoFile(null);
                              setViewPhotoPreview(null);
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {viewPhotoFile ? (
                          <span className="font-bold text-emerald-800">
                            Ready to upload: {viewPhotoFile.name} ({(viewPhotoFile.size / 1024).toFixed(0)} KB)
                          </span>
                        ) : (
                          "Upload clear product image or PNG icon (PNG, JPG, WebP up to 10MB). Saved to Supabase storage."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Basic Details: Name, Category, Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={viewEditForm.name}
                        onChange={(e) => handleViewEditFieldChange("name", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. Amul Butter 500g"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Category</label>
                      <select
                        value={viewEditForm.category_id || ""}
                        onChange={(e) =>
                          handleViewEditFieldChange(
                            "category_id",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                      >
                        <option value="">General / None</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* SKU, Barcode, Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">SKU</label>
                      <input
                        type="text"
                        value={viewEditForm.sku}
                        onChange={(e) => handleViewEditFieldChange("sku", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="SKU-1001"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Barcode</label>
                      <input
                        type="text"
                        value={viewEditForm.barcode}
                        onChange={(e) => handleViewEditFieldChange("barcode", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="8901030383741"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Brand</label>
                      <input
                        type="text"
                        value={viewEditForm.brand}
                        onChange={(e) => handleViewEditFieldChange("brand", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. Amul"
                      />
                    </div>
                  </div>

                  {/* Pricing & Real-Time Margin Auto-Calculator */}
                  <div className="p-4 bg-emerald-50/30 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-xs text-emerald-900">
                        <span>💰</span>
                        <span>Pricing & Margin Calculator</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        Change margin % or selling price to auto-calculate
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Purchase Price (Cost ₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={viewEditForm.purchase_price}
                          onChange={(e) => handleViewEditFieldChange("purchase_price", e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-800 block mb-1">
                          Selling Price (Retail ₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={viewEditForm.selling_price}
                          onChange={(e) => handleViewEditFieldChange("selling_price", e.target.value)}
                          className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-xl font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-800 block mb-1">
                          Gross Margin (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={viewEditForm.margin_percent}
                            onChange={(e) => handleViewEditFieldChange("margin_percent", e.target.value)}
                            className="w-full px-3 py-2 pr-7 border border-emerald-300 bg-white rounded-xl font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <span className="absolute right-2.5 top-2 font-black text-xs text-emerald-700 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-emerald-800 block mb-1 flex items-center justify-between">
                        <span>Live Price (Online Rate ₹)</span>
                        {viewEditForm.selling_price && (
                          <button
                            type="button"
                            onClick={() =>
                              handleViewEditFieldChange("live_price", viewEditForm.selling_price)
                            }
                            className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-300"
                            title="Copy Selling Price into Live Price"
                          >
                            <span>Copy Selling Price</span>
                            <span>→</span>
                          </button>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Leave blank to use Selling Price"
                        value={viewEditForm.live_price}
                        onChange={(e) => handleViewEditFieldChange("live_price", e.target.value)}
                        className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-xl font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    {/* Dynamic Calculation Callout */}
                    <div className="flex items-center justify-between p-2.5 bg-white border border-emerald-200/80 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Profit per unit:</span>
                        <span className="font-black text-emerald-700 text-sm">
                          ₹
                          {(
                            Math.max(
                              0,
                              Number(viewEditForm.selling_price || 0) -
                                Number(viewEditForm.purchase_price || 0)
                            )
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px]">Margin Health:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            Number(viewEditForm.margin_percent || 0) >= 20
                              ? "bg-emerald-100 text-emerald-800"
                              : Number(viewEditForm.margin_percent || 0) > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {Number(viewEditForm.margin_percent || 0) >= 20
                            ? "Healthy Margin"
                            : Number(viewEditForm.margin_percent || 0) > 0
                            ? "Low Margin"
                            : "No / Negative Margin"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MRP, Min Stock Alert & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">MRP (Optional ₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={viewEditForm.mrp}
                        onChange={(e) => handleViewEditFieldChange("mrp", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Min Stock Alert</label>
                      <input
                        type="number"
                        min="0"
                        value={viewEditForm.min_stock}
                        onChange={(e) => handleViewEditFieldChange("min_stock", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Catalog Status</label>
                      <select
                        value={viewEditForm.status}
                        onChange={(e) => handleViewEditFieldChange("status", e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                      >
                        <option value="active">Active (Live in Shop)</option>
                        <option value="inactive">Inactive (Offline)</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="text-xs">
                    <label className="font-bold text-slate-700 block mb-1">Product Description</label>
                    <textarea
                      rows={2}
                      value={viewEditForm.description}
                      onChange={(e) => handleViewEditFieldChange("description", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Add details, size, weight, packaging notes..."
                    />
                  </div>

                  {/* Actions (Footer) */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={savingViewEdit}
                      onClick={() => {
                        setIsEditingView(false);
                        setViewPhotoFile(null);
                        setViewPhotoPreview(null);
                      }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingViewEdit}
                      className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      {savingViewEdit ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Save Product Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ============================================================== */}
      {/* 6. OTHER MODALS: Stock Movement, Add Product, Edit Product, CSV */}
      {/* ============================================================== */}

      {/* Stock Movement / Adjustment Modal */}
      {showAdjustModal && selectedProduct &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop animate-scale-in max-h-[92dvh] overflow-y-auto border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  Stock Movement & Adjustment
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {selectedProduct.name} ({selectedProduct.sku})
                </p>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {adjustError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleSaveAdjustment} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <span className="font-semibold text-slate-600">
                  Current Stock on Hand:
                </span>
                <span className="font-black text-sm text-slate-900">
                  {getProductStock(selectedProduct)} units
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Adjustment Reason:
                </label>
                <select
                  value={adjustReason}
                  onChange={(e: any) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="count">
                    Count Correction (Physical count differs)
                  </option>
                  <option value="damaged">
                    Damaged / Expired (Removes stock)
                  </option>
                  <option value="return">
                    Customer Return (Adds stock back)
                  </option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              {adjustReason === "count" && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdjustMode("change")}
                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition ${
                      adjustMode === "change"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    Adjust by Delta (+ / -)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("set")}
                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition ${
                      adjustMode === "set"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    Set Counted Total
                  </button>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {adjustMode === "set"
                    ? "New Total Counted Quantity:"
                    : "Quantity to Adjust:"}
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder={
                    adjustMode === "set" ? "e.g. 50" : "e.g. 5 or -2"
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Audit Notes / Explanation:
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Annual stock audit verification or damaged box..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
        </div>,
        document.body
      )}

      {/* Add Product Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop animate-scale-in border border-border space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                Add New Product to Inventory
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Wireless Mouse X1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={addSku}
                    onChange={(e) => setAddSku(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={addPurchasePrice}
                    onChange={(e) => setAddPurchasePrice(e.target.value)}
                    placeholder="e.g. 400.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addSellingPrice}
                    onChange={(e) => setAddSellingPrice(e.target.value)}
                    placeholder="e.g. 599.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Live Price (Online Rate ₹)</span>
                  {addSellingPrice && (
                    <button
                      type="button"
                      onClick={() => setAddLivePrice(addSellingPrice)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-200"
                      title="Copy Selling Price into Live Price"
                    >
                      <span>Copy Selling Price</span>
                      <span>→</span>
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addLivePrice}
                  onChange={(e) => setAddLivePrice(e.target.value)}
                  placeholder="Leave empty to use Selling Price"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Min Stock (Reorder)
                  </label>
                  <input
                    type="number"
                    value={addMinStock}
                    onChange={(e) => setAddMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    value={addOpeningStock}
                    onChange={(e) => setAddOpeningStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
        </div>,
        document.body
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop animate-scale-in max-h-[92dvh] overflow-y-auto border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                Edit Product Information
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reorder Level (Min Stock)
                </label>
                <input
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
        </div>,
        document.body
      )}

      {/* Import CSV Modal */}
      {showImportModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop animate-scale-in max-h-[92dvh] overflow-y-auto border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                Bulk Import Inventory CSV
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Upload your CSV file containing columns: Name, SKU, Category, Selling
              Price, Purchase Price, Stock.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importProductsApi({ file, shopId: effectiveShopId || undefined });
                  alert("Inventory CSV imported successfully!");
                  setShowImportModal(false);
                  loadData();
                } catch (err: any) {
                  alert(apiErrorMessage(err, "Import failed"));
                }
              }}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
            />
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Delete Confirmation Modal */}
      {productToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-pop max-h-[92dvh] overflow-y-auto border border-border space-y-4 animate-scale-up">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete / Deactivate Product
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose how you want to handle <strong className="text-slate-800">{productToDelete.name}</strong> ({productToDelete.sku}).
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span className="font-bold text-slate-900">{getProductStock(productToDelete)} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Selling Price:</span>
                  <span className="font-bold text-emerald-700">{formatINR(productToDelete.selling_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Status:</span>
                  <span className="font-bold capitalize">{productToDelete.status}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={deletingProduct}
                  onClick={() => handleConfirmDelete(true)}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <span>🗑️ Permanently Delete Product</span>
                </button>

                <button
                  type="button"
                  disabled={deletingProduct}
                  onClick={() => handleConfirmDelete(false)}
                  className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-amber-200 disabled:opacity-50"
                >
                  <span>⏸️ Deactivate / Set Offline (Retain Ledger)</span>
                </button>

                <button
                  type="button"
                  disabled={deletingProduct}
                  onClick={() => setProductToDelete(null)}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
