import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listProducts } from "../api/products";
import { listSales, downloadInvoicePdf } from "../api/sales";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { usePosStore } from "../store/posStore";
import { EmptyState, Icon, IconButton, SearchInput, Segmented } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import RequireModule from "../components/RequireModule";
import ProductItemIcon from "../components/ProductItemIcon";
import type { Product, Sale } from "../types";
import { ToastNotification, type ToastProps } from "../components/AnimatedFeedback";

function BillingInner() {
  const navigate = useNavigate();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);

  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // POS Store State
  const posItems = usePosStore((st) => st.items);
  const posCount = usePosStore((st) => st.count);
  const addItem = usePosStore((st) => st.addItem);
  const setItems = usePosStore((st) => st.setItems);

  const cartTotal = useMemo(
    () => posItems.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice || 0), 0),
    [posItems]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // Price Source: Selling Price (Counter) vs Live Price (Online)
  const [priceSource, setPriceSource] = useState<"selling" | "live">(() => {
    try {
      return (localStorage.getItem("nsyu_billing_price_source") as "selling" | "live") || "selling";
    } catch {
      return "selling";
    }
  });

  // Recent bills filter & search
  const [billListTab, setBillListTab] = useState<"all" | "paid" | "pending" | "cancelled">("all");
  const [billSearch, setBillSearch] = useState("");

  // Toast feedback
  const [toast, setToast] = useState<{
    type: ToastProps["type"];
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  function loadData() {
    setLoading(true);
    const targetShopId = shopId || activeShop?.id;
    Promise.all([
      listProducts({ shopId: targetShopId || undefined } as any),
      listSales({ limit: 15, shopId: targetShopId || undefined }),
    ])
      .then(([p, s]) => {
        setProducts(p.data.data ?? []);
        setRecentSales(s.data.data ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [shopId, activeShop?.id]);

  function handlePriceSourceChange(newMode: "selling" | "live") {
    setPriceSource(newMode);
    try {
      localStorage.setItem("nsyu_billing_price_source", newMode);
    } catch {}

    if (posItems.length > 0) {
      const updated = posItems.map((item) => {
        const targetRate =
          newMode === "live" && item.product.live_price && Number(item.product.live_price) > 0
            ? Number(item.product.live_price)
            : Number(item.product.selling_price || 0);
        return { ...item, unitPrice: targetRate };
      });
      setItems(updated);
      setToast({
        type: "info",
        title: `Billing Rate: ${newMode === "live" ? "Live Price (Online)" : "Selling Price (Counter)"}`,
        subtitle: `Updated cart item rates to ${newMode === "live" ? "online live prices" : "store counter selling prices"}.`,
      });
    }
  }

  function getStock(p: Product): number {
    if (!p) return 0;
    // 1. Direct current_stock from backend
    if (typeof (p as any).current_stock === "number") {
      return (p as any).current_stock;
    }
    // 2. Check stocks array matching current shop
    const stocks = p.stocks || [];
    if (stocks.length > 0) {
      const targetId = shopId || activeShop?.id;
      if (targetId) {
        const match = stocks.find((st: any) => Number(st.shop_id) === Number(targetId));
        if (match && match.current_stock !== undefined && match.current_stock !== null) {
          return Number(match.current_stock);
        }
      }
      return Number(stocks[0]?.current_stock || 0);
    }
    return 0;
  }

  function addToCart(p: Product) {
    const rate =
      priceSource === "live" && p.live_price && Number(p.live_price) > 0
        ? Number(p.live_price)
        : Number(p.selling_price || 0);

    addItem(p, 1, rate);
    setToast({
      type: "success",
      title: `Added "${p.name}" to Cart`,
      subtitle: `Rate: ₹${rate.toFixed(2)} (${priceSource === "live" && p.live_price ? "Live Online Price" : "Selling Price"})`,
      actionLabel: "View Cart & Bill",
      onAction: () => navigate("/app/cart"),
    });
  }

  async function downloadPdf(id: number, num: string) {
    try {
      const res = await downloadInvoicePdf(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${num}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast({
        type: "error",
        title: "Download Failed",
        subtitle: apiErrorMessage(err, "Could not generate invoice PDF."),
      });
    }
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category?.name).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const q = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (category !== "all" && p.category?.name !== category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      String(p.barcode || "").toLowerCase().includes(q)
    );
  });

  const qtyInCart = (id: number) => posItems.find((c) => c.product.id === id)?.quantity || 0;

  /** Barcode scanners type the code and press Enter: add the exact match straight to cart. */
  function handleSearchEnter() {
    const code = searchQuery.trim().toLowerCase();
    if (!code) return;
    const exact = products.find(
      (p) => String(p.barcode || "").toLowerCase() === code || p.sku.toLowerCase() === code
    );
    const pick = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (pick) {
      addToCart(pick);
      setSearchQuery("");
    } else {
      setToast({
        type: "warning",
        title: "No exact match",
        subtitle: `Nothing has barcode or SKU “${searchQuery.trim()}”.`,
      });
    }
  }

  // Filter recent bills by tab & search query
  const filteredRecentBills = recentSales.filter((s) => {
    if (billListTab === "paid" && s.status !== "paid") return false;
    if (billListTab === "pending" && s.status !== "partially_paid" && s.status !== "unpaid") return false;
    if (billListTab === "cancelled" && s.status !== "cancelled") return false;
    if (billSearch.trim()) {
      const bq = billSearch.toLowerCase();
      if (!s.invoice_number.toLowerCase().includes(bq) && !(s.customer?.name || "").toLowerCase().includes(bq)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-24 lg:pb-12 max-w-7xl mx-auto">
      {/* Top Banner: Staged Cart Notification & Quick Checkout */}
      {posCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-2xs">
              <Icon name="cart" className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-navy-900 flex items-center gap-2">
                <span>{posCount} {posCount === 1 ? "Unit" : "Units"} in Cart</span>
                <span className="text-emerald-800 font-mono">· ₹{cartTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-slate-500">
                Products staged and ready for bill creation, discount, payment & invoicing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/app/cart")}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
          >
            <span>Go to Cart & Create Bill</span>
            <Icon name="arrowRight" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar & Rate Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-700">Billing Rate Mode:</span>
          <div className="inline-flex items-center p-0.5 rounded-xl bg-white border border-slate-200">
            <button
              type="button"
              onClick={() => handlePriceSourceChange("selling")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                priceSource === "selling"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Selling Price (Counter)
            </button>
            <button
              type="button"
              onClick={() => handlePriceSourceChange("live")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                priceSource === "live"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Price (Online)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {priceSource === "live" ? (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-300">
              ⚡ Active: Billing using Online Live Prices
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500">
              Standard Shop Counter Rate
            </span>
          )}
          <Link
            to="/app/cart"
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
          >
            <Icon name="cart" className="w-3.5 h-3.5 text-slate-500" />
            <span>View Cart ({posCount})</span>
          </Link>
        </div>
      </div>

      {/* Search, Category & Add Product Toolbar */}
      <div className="card p-3 sm:p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Icon name="search" className="w-[18px] h-[18px]" />
          </span>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search product name, SKU or barcode (Press Enter to quick add)..."
            className="input h-12 pl-11 text-[14px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchEnter();
              }
            }}
          />
        </div>
        <div className="flex gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input h-12 flex-1 lg:w-64 lg:flex-none font-semibold text-navy-900"
            aria-label="Category"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Link to="/app/products?add=1" className="btn-primary h-12 px-5 text-[14px] shrink-0">
            <Icon name="plus" className="w-5 h-5" /> <span className="hidden sm:inline">Add Product</span>
          </Link>
        </div>
      </div>

      {/* Horizontal Scrollable Category Bar (Mobile-first app navigation) */}
      <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            category === "all"
              ? "bg-[#064E3B] text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          All Items ({products.length})
        </button>
        {categories.map((cat) => {
          const count = products.filter((p) => p.category?.name === cat).length;
          const isActive = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#064E3B] text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 font-semibold"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Product Grid (Full Width, 2-Column Mobile Grid) */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[180px] rounded-2xl bg-white border border-border animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="box"
            title={products.length === 0 ? "No products yet" : "No products match"}
            text={products.length === 0 ? "Add products to start billing." : "Try another name, SKU, barcode or category."}
            action={
              products.length === 0 ? (
                <Link to="/app/products?add=1" className="btn-primary btn-sm">
                  <Icon name="plus" className="w-3.5 h-3.5" /> Add Product
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCategory("all");
                  }}
                  className="btn-secondary btn-sm"
                >
                  Clear search
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((p) => {
            const stock = getStock(p);
            const inCart = qtyInCart(p.id);
            const img = resolveAssetUrl((p.images?.find((i) => i.is_primary) || p.images?.[0])?.url);
            return (
              <div
                key={p.id}
                className={`group min-w-0 bg-white rounded-2xl border p-2.5 sm:p-3.5 flex flex-col 2xl:flex-row gap-2 sm:gap-3 transition hover:shadow-lift ${
                  inCart ? "border-brand-300 ring-2 ring-brand-500/10" : "border-border hover:border-brand-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => addToCart(p)}
                  className="w-full h-28 2xl:w-[88px] 2xl:h-[88px] shrink-0 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-1"
                  aria-label={`Add ${p.name}`}
                >
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="w-full h-full object-contain" />
                  ) : (
                    <ProductItemIcon name={p.name} category={p.category?.name || p.brand} sku={p.sku} size="lg" />
                  )}
                </button>
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <button type="button" onClick={() => addToCart(p)} className="text-left w-full">
                      <div className="text-[12px] sm:text-[13.5px] font-bold text-navy-900 leading-snug line-clamp-2" title={p.name}>
                        {p.name}
                      </div>
                    </button>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">SKU: {p.sku}</div>
                    <div className="flex items-baseline gap-1 flex-wrap mt-1">
                      <div className="text-[13px] sm:text-[15px] font-bold text-navy-900 font-mono tabular">
                        ₹{Number(priceSource === "live" && p.live_price ? p.live_price : p.selling_price || 0).toFixed(2)}
                      </div>
                      {priceSource === "live" && p.live_price && (
                        <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-300">
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold tabular whitespace-nowrap border ${
                        stock > 0
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                      title={`Available Stock: ${stock}`}
                    >
                      Stock: <strong>{stock}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(p)}
                      className="relative shrink-0 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white flex items-center gap-0.5 shadow-sm active:scale-95 transition"
                      title="Add to cart"
                      aria-label={`Add ${p.name} to cart`}
                    >
                      <span className="text-xs sm:text-[13px] font-bold leading-none">+ Cart</span>
                      {inCart > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                          {inCart}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Bills (Full Width) */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="card-title text-[14.5px]">Recent bills</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Latest bills from {activeShop?.name || "this shop"}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={billListTab}
              onChange={setBillListTab}
              options={[
                { key: "all", label: "All" },
                { key: "paid", label: "Paid" },
                { key: "pending", label: "Pending" },
                { key: "cancelled", label: "Cancelled" },
              ]}
            />
            <SearchInput
              className="w-full sm:w-[200px]"
              value={billSearch}
              onChange={setBillSearch}
              placeholder="Bill or customer…"
            />
            <button type="button" onClick={loadData} className="btn-secondary btn-sm">
              <Icon name="refresh" className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        {filteredRecentBills.length === 0 ? (
          <EmptyState
            compact
            icon="receipt"
            title="No bills here"
            text="New bills show up here right after you save them from the Cart page."
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="!text-right">Amount</th>
                    <th>Status</th>
                    <th className="!text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentBills.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">
                        <div className="font-mono text-[12.5px] font-semibold text-brand-700">{s.invoice_number}</div>
                        <div className="text-[11.5px] text-slate-400">
                          {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="font-medium text-navy-900">{s.customer?.name || "Customer"}</td>
                      <td className="text-right font-bold text-navy-900 tabular whitespace-nowrap">
                        ₹{Number(s.total_amount).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={
                            s.status === "paid"
                              ? "badge-active"
                              : s.status === "partially_paid"
                              ? "badge-warn"
                              : s.status === "cancelled"
                              ? "badge-inactive"
                              : "badge-danger"
                          }
                        >
                          {s.status === "paid"
                            ? "Paid"
                            : s.status === "partially_paid"
                            ? "Partial"
                            : s.status === "cancelled"
                            ? "Cancelled"
                            : "Unpaid"}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          <IconButton title="View bill" icon="eye" to={`/app/sales/${s.id}`} />
                          <IconButton
                            title="Download PDF"
                            icon="download"
                            onClick={() => downloadPdf(s.id, s.invoice_number)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile App-like Card Feed */}
            <div className="md:hidden divide-y divide-slate-100 p-2 space-y-2">
              {filteredRecentBills.map((s) => (
                <div key={s.id} className="mobile-card p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[13px] font-bold text-brand-700">
                        {s.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(s.invoice_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-navy-900 text-[15px] tabular">
                        ₹{Number(s.total_amount).toFixed(2)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "partially_paid"
                            ? "bg-amber-100 text-amber-800"
                            : s.status === "cancelled"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {s.status === "paid"
                          ? "Paid"
                          : s.status === "partially_paid"
                          ? "Partial"
                          : s.status === "cancelled"
                          ? "Cancelled"
                          : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="font-medium text-navy-900 truncate">
                      {s.customer?.name || "Customer"}
                    </span>
                    <div className="inline-flex gap-1.5 shrink-0">
                      <IconButton title="View bill" icon="eye" to={`/app/sales/${s.id}`} />
                      <IconButton
                        title="Download PDF"
                        icon="download"
                        onClick={() => downloadPdf(s.id, s.invoice_number)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Mobile: Bottom Floating Bar to Go to Cart & Create Bill (elevated above bottom nav) */}
      {posCount > 0 && (
        <div className="lg:hidden fixed inset-x-3 bottom-[74px] z-30 pb-safe">
          <button
            type="button"
            onClick={() => navigate("/app/cart")}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-navy-900 text-white px-4 py-3 shadow-lift active:scale-[0.99] transition"
          >
            <span className="text-[13.5px] font-semibold">
              {posCount} item{posCount === 1 ? "" : "s"} · <span className="tabular">₹{cartTotal.toFixed(2)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
              Go to Cart & Create Bill <Icon name="arrowRight" className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <ToastNotification
          type={toast.type}
          title={toast.title}
          subtitle={toast.subtitle}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function Billing() {
  return (
    <RequireModule module="billing">
      <BillingInner />
    </RequireModule>
  );
}
