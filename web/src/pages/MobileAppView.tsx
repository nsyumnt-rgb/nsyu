import { useState } from "react";
import { Link } from "react-router-dom";
import DemoBar from "../components/DemoBar";
import HinglishToggle from "../components/HinglishToggle";

interface Product {
  id: string;
  name: string;
  brand: string;
  shop: string;
  price: number;
  mrp: number;
  qty: number;
  category: string;
}

const SAMPLE_PRODUCTS: Product[] = [
  { id: "p1", name: "Redmi 13C 5G (6GB/128GB)", brand: "Xiaomi", shop: "Sharma Mobile Hub", price: 10499, mrp: 11999, qty: 14, category: "Phones" },
  { id: "p2", name: "Samsung Galaxy M15 5G", brand: "Samsung", shop: "Sharma Mobile Hub", price: 13499, mrp: 14999, qty: 3, category: "Phones" },
  { id: "p3", name: "Anker 20W USB-C Fast Charger", brand: "Anker", shop: "Sharma Mobile Hub", price: 1099, mrp: 1499, qty: 40, category: "Chargers" },
  { id: "p4", name: "boAt Type-C Braided Cable 1.5m", brand: "boAt", shop: "Sharma Mobile Hub", price: 299, mrp: 599, qty: 120, category: "Cables" },
  { id: "p5", name: "boAt Rockerz 255 Pro+ Neckband", brand: "boAt", shop: "Sharma Mobile Hub", price: 1299, mrp: 2999, qty: 25, category: "Audio" },
  { id: "p6", name: "boAt Airdopes 141 Earbuds", brand: "boAt", shop: "Sharma Mobile Hub", price: 1399, mrp: 4490, qty: 30, category: "Audio" },
  { id: "p7", name: "Sony Bravia 43\" Full HD Smart TV", brand: "Sony", shop: "Gupta Electronics", price: 31990, mrp: 42900, qty: 5, category: "TV" },
  { id: "p8", name: "LG 7kg Top Load Washing Machine", brand: "LG", shop: "Sharma Home Appliances", price: 17990, mrp: 21990, qty: 6, category: "Appliances" },
];

const CATEGORIES = [
  { id: "c1", name: "Mobile Phones", icon: "📱" },
  { id: "c2", name: "Chargers", icon: "🔌" },
  { id: "c3", name: "Data Cables", icon: "⚡" },
  { id: "c4", name: "Earphones", icon: "🎧" },
  { id: "c5", name: "Smart Watches", icon: "⌚" },
  { id: "c6", name: "Televisions", icon: "📺" },
  { id: "c7", name: "Appliances", icon: "🏠" },
];

export default function MobileAppView() {
  const [appMode, setAppMode] = useState<"customer" | "owner">("customer");
  const [custTab, setCustTab] = useState<"home" | "search" | "cart" | "orders" | "account">("home");
  const [ownerTab, setOwnerTab] = useState<"dashboard" | "inventory" | "pos" | "orders" | "more">("dashboard");
  const [activeShop, setActiveShop] = useState("Sharma Mobile Hub");
  const [cart, setCart] = useState<{ [id: string]: number }>({ p4: 2, p6: 1 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const cartTotalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = (prev[productId] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const filteredProducts = SAMPLE_PRODUCTS.filter((p) => {
    const matchQ = !searchQuery || (p.name + p.brand + p.shop).toLowerCase().includes(searchQuery.toLowerCase());
    const matchC = !selectedCat || p.category.toLowerCase().includes(selectedCat.toLowerCase());
    return matchQ && matchC;
  });

  return (
    <div className="min-h-screen bg-white text-navy-900 flex flex-col">
      <DemoBar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Documentation & App Switcher */}
          <div className="lg:col-span-5 space-y-6 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <span>📱</span>
              <span>Flutter Mobile Companion</span>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                One business logic, two mobile surfaces.
              </h1>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                The mobile companion app runs the exact same stock levels, ledger entries, and credit approval rules as the web platform. Place an order here as a customer, then accept it in the owner view in real-time.
              </p>
            </div>

            {/* App Mode Switcher */}
            <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setAppMode("customer")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  appMode === "customer"
                    ? "bg-[#047857] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Customer app
              </button>
              <button
                type="button"
                onClick={() => setAppMode("owner")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  appMode === "owner"
                    ? "bg-[#047857] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Owner app
              </button>
            </div>

            {/* Key Features List */}
            <ul className="space-y-2 text-xs text-gray-600 list-disc list-inside">
              <li>Bottom navigation rail optimized for thumb touch targets</li>
              <li>Swipeable category ribbons and one-tap checkout with Pay Later</li>
              <li>Pull down inside the viewport or tap refresh to update data</li>
              <li>Multi-shop switcher in the owner header for isolated accounting</li>
            </ul>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <b>Production Architecture:</b> In production, Flutter interacts with the same Supabase/Postgres backend as the Next.js/Vite frontend. RBAC permissions and tenant isolation are enforced at the API gateway layer.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/"
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition"
              >
                ← Back to Web Marketplace
              </Link>
            </div>
          </div>

          {/* Right Column: Smartphone Mockup Frame */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-[370px] h-[740px] bg-white rounded-[44px] border-[9px] border-gray-800 shadow-2xl flex flex-col overflow-hidden relative ring-1 ring-gray-900/10">
              
              {/* Smartphone Status Bar */}
              <div className="h-8 bg-gray-50 border-b border-gray-100 px-6 flex items-center justify-between text-[11px] font-bold text-gray-800 shrink-0">
                <span>9:41</span>
                <div className="w-16 h-3.5 bg-gray-800 rounded-full mx-auto" />
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <span>▮▮▮</span>
                </div>
              </div>

              {/* Pull-to-refresh Indicator */}
              {isRefreshing && (
                <div className="bg-emerald-50 text-emerald-800 text-[10px] font-bold py-1 text-center border-b border-emerald-100 animate-pulse">
                  ⟳ Syncing latest shop data...
                </div>
              )}

              {/* Smartphone Scrollable Body */}
              <div className="flex-1 overflow-y-auto bg-gray-50/50 p-3 text-xs">
                {appMode === "customer" ? (
                  // ================= CUSTOMER APP SCREENS =================
                  custTab === "home" ? (
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-black text-emerald-800 text-sm">
                          <span className="w-5 h-5 rounded-md bg-[#047857] text-white flex items-center justify-center text-[10px]">N</span>
                          <span>NSYU Market</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRefresh}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                        >
                          ⟳
                        </button>
                      </div>

                      {/* Search Bar Button */}
                      <button
                        type="button"
                        onClick={() => setCustTab("search")}
                        className="w-full h-9 rounded-full bg-white border border-gray-200 px-3.5 flex items-center gap-2 text-gray-400 text-xs shadow-2xs"
                      >
                        <span>🔍</span>
                        <span>Search products, shops...</span>
                      </button>

                      {/* Mini Hero Banner */}
                      <div className="rounded-2xl bg-gradient-to-br from-emerald-100/80 to-teal-50 p-3.5 border border-emerald-200/60 shadow-2xs">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                          Pay Later with Credit
                        </span>
                        <h2 className="text-sm font-black text-emerald-950 mt-1.5 leading-tight">
                          Every local shop in your neighbourhood.
                        </h2>
                        <p className="text-[11px] text-emerald-800 mt-1">
                          Pay now, split payment, or ask for shop credit.
                        </p>
                      </div>

                      {/* Category Carousel */}
                      <div>
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Categories
                        </div>
                        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCat(c.name);
                                setCustTab("search");
                              }}
                              className="shrink-0 w-20 p-2 bg-white rounded-xl border border-gray-200 text-center hover:border-emerald-500 shadow-2xs transition"
                            >
                              <div className="text-xl mb-1">{c.icon}</div>
                              <div className="text-[10px] font-bold text-gray-800 truncate leading-none">
                                {c.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Trending Products Grid */}
                      <div>
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Trending in Delhi
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {SAMPLE_PRODUCTS.slice(0, 4).map((p) => (
                            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-2 flex flex-col justify-between shadow-2xs">
                              <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-300 mb-1.5">
                                📦
                              </div>
                              <div className="text-[10px] text-emerald-700 font-semibold truncate">{p.shop}</div>
                              <h4 className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2 min-h-[28px] mt-0.5">
                                {p.name}
                              </h4>
                              <div className="flex items-center justify-between mt-2">
                                <span className="font-extrabold text-xs text-gray-900">₹{p.price.toLocaleString("en-IN")}</span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(p.id)}
                                  className="px-2 py-1 rounded-md bg-[#047857] text-white text-[10px] font-bold shadow-xs active:scale-95"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : custTab === "search" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search products or brands..."
                          className="flex-1 h-9 bg-white border border-gray-200 rounded-full px-3.5 text-xs outline-none focus:border-emerald-600"
                        />
                        {selectedCat && (
                          <button
                            type="button"
                            onClick={() => setSelectedCat(null)}
                            className="px-2 py-1 rounded-full bg-gray-200 text-[10px] font-bold"
                          >
                            ✕ {selectedCat}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {filteredProducts.map((p) => (
                          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-2 flex flex-col justify-between shadow-2xs">
                            <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-300 mb-1.5">
                              📦
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold truncate">{p.shop}</div>
                            <h4 className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2 min-h-[28px] mt-0.5">
                              {p.name}
                            </h4>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-extrabold text-xs text-gray-900">₹{p.price.toLocaleString("en-IN")}</span>
                              <button
                                type="button"
                                onClick={() => addToCart(p.id)}
                                className="px-2 py-1 rounded-md bg-[#047857] text-white text-[10px] font-bold"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : custTab === "cart" ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-gray-900">Your Cart</h3>
                      {Object.keys(cart).length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Cart is empty</div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(cart).map(([pid, qty]) => {
                            const p = SAMPLE_PRODUCTS.find((x) => x.id === pid);
                            if (!p) return null;
                            return (
                              <div key={pid} className="p-2.5 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-[11px] text-gray-900 truncate">{p.name}</div>
                                  <div className="text-[10px] text-emerald-700">{p.shop} · ₹{p.price}</div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1">
                                  <button type="button" onClick={() => updateCartQty(pid, -1)} className="font-bold text-xs text-gray-600">-</button>
                                  <span className="font-bold text-xs">{qty}</span>
                                  <button type="button" onClick={() => updateCartQty(pid, 1)} className="font-bold text-xs text-gray-600">+</button>
                                </div>
                              </div>
                            );
                          })}
                          <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
                            <div className="flex justify-between font-bold text-xs">
                              <span>Total</span>
                              <span className="text-emerald-800">
                                ₹{Object.entries(cart).reduce((sum, [pid, qty]) => {
                                  const p = SAMPLE_PRODUCTS.find((x) => x.id === pid);
                                  return sum + (p ? p.price * qty : 0);
                                }, 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert("Demo order placed with Pay Later option!")}
                            className="w-full py-2.5 rounded-xl bg-[#047857] hover:bg-[#064E3B] text-white font-bold text-xs shadow-md"
                          >
                            Checkout with Pay Later →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : custTab === "orders" ? (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-black text-gray-900">Your Orders</h3>
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                        <div className="flex justify-between text-xs font-bold">
                          <span>Order #O-2065</span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">Dispatched</span>
                        </div>
                        <div className="text-[11px] text-gray-500">Sharma Mobile Hub · 2 items</div>
                        <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-gray-100">
                          <span>Total: ₹2,799</span>
                          <span className="text-emerald-700">Track 🚚</span>
                        </div>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                        <div className="flex justify-between text-xs font-bold">
                          <span>Order #O-2041</span>
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">Completed</span>
                        </div>
                        <div className="text-[11px] text-gray-500">Sharma Mobile Hub · 4 items</div>
                        <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-gray-100">
                          <span>Total: ₹5,000 (₹4,000 credit)</span>
                          <span className="text-gray-500">Invoice 🧾</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex items-center gap-3 shadow-2xs">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                          AK
                        </div>
                        <div>
                          <div className="font-bold text-xs text-gray-900">Amit Kumar</div>
                          <div className="text-[11px] text-gray-500">98765 43210 · New Delhi</div>
                        </div>
                      </div>
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span>Credit with Sharma Mobile Hub</span>
                          <span className="text-rose-700">₹3,000 Due</span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Credit Limit: ₹10,000 · Available: ₹7,000
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("Payment popup for ₹3,000")}
                          className="w-full py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs"
                        >
                          Pay Outstanding Balance
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  // ================= OWNER APP SCREENS =================
                  ownerTab === "dashboard" ? (
                    <div className="space-y-3">
                      {/* Shop Switcher */}
                      <div className="p-2 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs font-bold">
                        <span>🏪 {activeShop}</span>
                        <button
                          type="button"
                          onClick={() => setActiveShop((s) => s.includes("Hub") ? "Sharma Home Appliances" : "Sharma Mobile Hub")}
                          className="text-emerald-700 text-[11px]"
                        >
                          Switch ▾
                        </button>
                      </div>

                      {/* Stat Cards */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500">Today's Sales</div>
                          <div className="text-sm font-black text-gray-900">₹14,290</div>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500">Pending Orders</div>
                          <div className="text-sm font-black text-amber-600">2 Actions</div>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500">Customer Udhaar</div>
                          <div className="text-sm font-black text-rose-600">₹18,500</div>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500">Low Stock</div>
                          <div className="text-sm font-black text-red-600">4 Items</div>
                        </div>
                      </div>

                      {/* Needs Action Box */}
                      <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-amber-950">
                          <span>Pending Order #O-2058</span>
                          <span className="bg-amber-200 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full">Needs Approval</span>
                        </div>
                        <div className="text-[11px] text-gray-700">
                          Customer: Priya Nair · ₹9,999 on Pay Later credit
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => alert("Order approved & invoice generated!")}
                            className="flex-1 py-1 rounded-md bg-[#047857] text-white text-[11px] font-bold"
                          >
                            Accept Order
                          </button>
                          <button
                            type="button"
                            onClick={() => alert("Order rejected")}
                            className="flex-1 py-1 rounded-md bg-white border border-gray-300 text-gray-700 text-[11px] font-bold"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : ownerTab === "inventory" ? (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-gray-900">Inventory ({SAMPLE_PRODUCTS.length})</h3>
                        <button
                          type="button"
                          onClick={() => alert("Product form modal")}
                          className="px-2 py-1 rounded-lg bg-[#047857] text-white text-[10px] font-bold"
                        >
                          + Add Item
                        </button>
                      </div>
                      {SAMPLE_PRODUCTS.map((p) => (
                        <div key={p.id} className="p-2.5 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[11px] text-gray-900 truncate">{p.name}</div>
                            <div className="text-[10px] text-gray-500">Stock: {p.qty} pcs · Selling: ₹{p.price}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert(`Adjust stock for ${p.name}`)}
                            className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-700"
                          >
                            Adjust
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : ownerTab === "pos" ? (
                    <div className="space-y-2.5">
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                        <div className="text-xs font-bold text-gray-700">Quick POS Counter Sale</div>
                        <input
                          type="text"
                          placeholder="Search product or scan barcode..."
                          className="w-full h-8 bg-gray-50 border border-gray-200 rounded-lg px-2.5 text-xs outline-none"
                        />
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="text-xs font-bold text-gray-900">Current Bill</div>
                        <div className="flex justify-between text-[11px] text-gray-600">
                          <span>boAt Type-C Cable × 1</span>
                          <span>₹299</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-600">
                          <span>boAt Airdopes 141 × 1</span>
                          <span>₹1,399</span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-xs">
                          <span>Total</span>
                          <span>₹1,698</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("POS invoice INV-1006 generated & inventory deducted!")}
                          className="w-full py-2 rounded-lg bg-[#047857] text-white font-bold text-xs"
                        >
                          Generate Invoice (Cash / UPI)
                        </button>
                      </div>
                    </div>
                  ) : ownerTab === "orders" ? (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-black text-gray-900">Store Orders</h3>
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                        <div className="flex justify-between font-bold text-xs">
                          <span>Order #O-2062</span>
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">Pickup Ready</span>
                        </div>
                        <div className="text-[11px] text-gray-500">Rohit Singh · ₹10,499 (UPI Paid)</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                        <div className="flex justify-between font-bold text-xs">
                          <span>Order #O-2058</span>
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">Pending Approval</span>
                        </div>
                        <div className="text-[11px] text-gray-500">Priya Nair · ₹9,999 (Credit Request)</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-sm font-black text-gray-900">Owner Tools</h3>
                      <Link
                        to="/app/khata"
                        className="block p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-xs text-gray-800 hover:border-emerald-500 shadow-2xs"
                      >
                        📖 Customer Khata & Udhaar (₹18,500)
                      </Link>
                      <Link
                        to="/app/expenses"
                        className="block p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-xs text-gray-800 hover:border-emerald-500 shadow-2xs"
                      >
                        💵 Daily Expenses & Cash Book
                      </Link>
                      <Link
                        to="/app/purchase"
                        className="block p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-xs text-gray-800 hover:border-emerald-500 shadow-2xs"
                      >
                        📦 Purchases & Stock Inward
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAppMode("customer")}
                        className="w-full py-2 bg-gray-100 rounded-xl font-bold text-xs text-gray-700 mt-2"
                      >
                        Switch to Customer View
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Smartphone Bottom Navigation Bar */}
              <div className="h-14 bg-white border-t border-gray-200 px-3 flex items-center justify-around shrink-0 select-none">
                {appMode === "customer" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCustTab("home")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        custTab === "home" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">🏠</span>
                      <span className="text-[9.5px]">Home</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustTab("search")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        custTab === "search" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">🔍</span>
                      <span className="text-[9.5px]">Search</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustTab("cart")}
                      className={`flex flex-col items-center gap-0.5 relative cursor-pointer ${
                        custTab === "cart" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">🛒</span>
                      {cartTotalItems > 0 && (
                        <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                          {cartTotalItems}
                        </span>
                      )}
                      <span className="text-[9.5px]">Cart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustTab("orders")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        custTab === "orders" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📦</span>
                      <span className="text-[9.5px]">Orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustTab("account")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        custTab === "account" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">👤</span>
                      <span className="text-[9.5px]">Account</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setOwnerTab("dashboard")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        ownerTab === "dashboard" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📊</span>
                      <span className="text-[9.5px]">Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerTab("inventory")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        ownerTab === "inventory" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📦</span>
                      <span className="text-[9.5px]">Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerTab("pos")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        ownerTab === "pos" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">⚡</span>
                      <span className="text-[9.5px]">POS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerTab("orders")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        ownerTab === "orders" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📋</span>
                      <span className="text-[9.5px]">Orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerTab("more")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        ownerTab === "more" ? "text-emerald-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">☰</span>
                      <span className="text-[9.5px]">More</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <HinglishToggle />
    </div>
  );
}
