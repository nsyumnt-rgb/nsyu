import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getPortalCategoriesApi, getPortalProductsApi, setCartItemApi, removeCartItemApi } from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  brand?: string | null;
  unit: string;
  category?: Category | null;
  images?: Array<{ id: number; url: string; is_primary: boolean }>;
  pricing: {
    unitPrice: number;
    gstPercent: number;
    sellingPriceInclTax: number;
  };
  inventory: {
    availableStock: number;
    isAvailable: boolean;
  };
}

export default function PortalCatalog() {
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Load categories
  useEffect(() => {
    getPortalCategoriesApi().then(setCategories).catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPortalProductsApi({
        search: search.trim() || undefined,
        categoryId: selectedCategory ?? undefined,
        page,
        limit: 12,
      });
      setProducts(res?.data || []);
      setTotalPages(res?.pagination?.pages || 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const getCartQuantity = (productId: number): number => {
    const item = cart?.items?.find((i) => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const handleUpdateQuantity = async (productId: number, newQty: number) => {
    setUpdatingId(productId);
    try {
      if (newQty <= 0) {
        const updated = await removeCartItemApi(productId);
        setCart(updated);
      } else {
        const updated = await setCartItemApi(productId, newQty);
        setCart(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update cart");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Product Catalog</h1>
            <p className="text-xs text-gray-500 mt-0.5">Explore available stock and order directly from the shop.</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product or SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === null
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <SearchIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No products found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or choosing a different category.
          </p>
          {(search || selectedCategory !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory(null);
              }}
              className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((prod) => {
            const inCartQty = getCartQuantity(prod.id);
            const isUpdating = updatingId === prod.id;
            const primaryImg = prod.images?.find((img) => img.is_primary)?.url || prod.images?.[0]?.url;

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Image container */}
                  <div className="relative w-full h-44 bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100">
                    {primaryImg ? (
                      <img
                        src={primaryImg}
                        alt={prod.name}
                        className="max-h-full max-w-full object-contain mix-blend-multiply"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center text-gray-300">
                        <BoxIcon className="w-12 h-12 mx-auto stroke-1" />
                        <span className="text-[10px] mt-1 block">No Image</span>
                      </div>
                    )}

                    {/* Stock Status Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      {prod.inventory.availableStock <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock
                        </span>
                      ) : prod.inventory.availableStock <= 5 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Only {prod.inventory.availableStock} left
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In Stock ({prod.inventory.availableStock})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                      <span>{prod.category?.name || "General"}</span>
                      {prod.brand && <span>{prod.brand}</span>}
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2" title={prod.name}>
                      {prod.name}
                    </h3>

                    <div className="text-[11px] text-gray-400 font-mono">SKU: {prod.sku}</div>

                    <div className="pt-2">
                      <div className="text-xs text-gray-500">Selling Price:</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-black text-gray-900">
                          ₹{Number(prod.pricing.sellingPriceInclTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          (Incl. {prod.pricing.gstPercent}% GST)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer / Add to Cart CTA */}
                <div className="p-4 pt-0">
                  {inCartQty > 0 ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateQuantity(prod.id, inCartQty - 1)}
                        className="w-8 h-8 rounded-lg bg-white text-emerald-800 font-bold hover:bg-emerald-100 flex items-center justify-center shadow-sm disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-emerald-900">
                        {isUpdating ? "..." : `${inCartQty} in cart`}
                      </span>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateQuantity(prod.id, inCartQty + 1)}
                        className="w-8 h-8 rounded-lg bg-white text-emerald-800 font-bold hover:bg-emerald-100 flex items-center justify-center shadow-sm disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateQuantity(prod.id, 1)}
                      className="w-full py-2 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CartPlusIcon className="w-3.5 h-3.5" />
                      <span>{isUpdating ? "Adding..." : "Add to Cart"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-xs font-semibold text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      )}

      {/* Floating View Cart bar on mobile when cart has items */}
      {cart && (cart.itemCount || cart.items?.length) > 0 && (
        <div className="md:hidden fixed bottom-16 left-4 right-4 z-30">
          <Link
            to="/portal/cart"
            className="w-full bg-[#047857] text-white py-3 px-5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {cart.itemCount} items
              </span>
              <span>View Cart</span>
            </div>
            <span>₹{Number(cart.estimatedTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })} &rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function CartPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

