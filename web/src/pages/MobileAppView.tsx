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

interface B2BItem {
  id: string;
  name: string;
  distributor: string;
  moq: number;
  rate: number;
  mrp: number;
  pack: string;
  category: string;
}

const B2B_WHOLESALE_ITEMS: B2BItem[] = [
  { id: "b1", name: "boAt Type-C Fast Data Cable", distributor: "Verma Distributors", moq: 50, rate: 45, mrp: 299, pack: "Box of 50 pcs", category: "Cables" },
  { id: "b2", name: "boAt Rockerz 255 Wireless Neckband", distributor: "Verma Distributors", moq: 20, rate: 680, mrp: 1299, pack: "Carton of 20 pcs", category: "Audio" },
  { id: "b3", name: "Anker 20W PD Type-C Fast Charger", distributor: "Verma Distributors", moq: 30, rate: 290, mrp: 1099, pack: "Box of 30 pcs", category: "Chargers" },
  { id: "b4", name: "9D Curved Edge Tempered Glass Universal", distributor: "Verma Distributors", moq: 100, rate: 18, mrp: 199, pack: "Pack of 100 pcs", category: "Accessories" },
  { id: "b5", name: "OTG Dual Drive 64GB USB 3.0", distributor: "Verma Distributors", moq: 25, rate: 210, mrp: 599, pack: "Box of 25 pcs", category: "Storage" },
];

interface MobilePO {
  id: string;
  buyer: string;
  seller: string;
  items: string;
  total: number;
  terms: string;
  status: "Pending" | "Approved" | "Dispatched" | "Delivered";
  date: string;
}

const INITIAL_POS: MobilePO[] = [
  { id: "PO-9045", buyer: "Sharma Mobile Hub", seller: "Verma Distributors", items: "100× Tempered Glass, 50× Cables", total: 4050, terms: "Credit Net 15", status: "Pending", date: "Today" },
  { id: "PO-9041", buyer: "Sharma Mobile Hub", seller: "Verma Distributors", items: "30× 20W Fast Chargers, 20× Neckbands", total: 22300, terms: "Credit Net 30", status: "Dispatched", date: "18 Nov" },
  { id: "PO-9038", buyer: "Sharma Mobile Hub", seller: "Verma Distributors", items: "50× Fast Cables", total: 2250, terms: "Immediate UPI", status: "Delivered", date: "12 Nov" },
  { id: "PO-9046", buyer: "Gupta Electronics", seller: "Verma Distributors", items: "50× Neckbands", total: 34000, terms: "Immediate UPI", status: "Pending", date: "Today" },
];

export default function MobileAppView() {
  const [appMode, setAppMode] = useState<"customer" | "owner" | "buyer" | "seller">("customer");
  
  // Tab states for different personas
  const [custTab, setCustTab] = useState<"home" | "search" | "cart" | "orders" | "account">("home");
  const [ownerTab, setOwnerTab] = useState<"dashboard" | "inventory" | "pos" | "orders" | "more">("dashboard");
  const [buyerTab, setBuyerTab] = useState<"market" | "po" | "ledger">("market");
  const [sellerTab, setSellerTab] = useState<"incoming" | "dispatch" | "receivables">("incoming");

  // Shared state
  const [activeShop] = useState("Sharma Mobile Hub");
  const [cart, setCart] = useState<{ [id: string]: number }>({ p4: 2, p6: 1 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // B2B state
  const [posList, setPosList] = useState<MobilePO[]>(INITIAL_POS);
  const [buyerDraft, setBuyerDraft] = useState<{ [id: string]: number }>({ b1: 50, b4: 100 });
  const [poTerms, setPoTerms] = useState("Credit Net 15");
  const [sharmaReceivable, setSharmaReceivable] = useState(18500);

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

  // Buyer PO draft actions
  const updateBuyerDraft = (itemId: string, delta: number, moq: number) => {
    setBuyerDraft((prev) => {
      const current = prev[itemId] || 0;
      const next = current + delta * moq;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const draftSubtotal = Object.entries(buyerDraft).reduce((sum, [id, qty]) => {
    const item = B2B_WHOLESALE_ITEMS.find((b) => b.id === id);
    return sum + (item ? item.rate * qty : 0);
  }, 0);

  const handleSendPO = () => {
    if (Object.keys(buyerDraft).length === 0) {
      alert("Please select at least one wholesale product with minimum order quantity (MOQ).");
      return;
    }
    const itemSummary = Object.entries(buyerDraft)
      .map(([id, qty]) => {
        const item = B2B_WHOLESALE_ITEMS.find((b) => b.id === id);
        return `${qty}× ${item?.name}`;
      })
      .join(", ");

    const newPO: MobilePO = {
      id: `PO-${Math.floor(9000 + Math.random() * 999)}`,
      buyer: "Sharma Mobile Hub",
      seller: "Verma Distributors",
      items: itemSummary,
      total: draftSubtotal,
      terms: poTerms,
      status: "Pending",
      date: "Just now",
    };

    setPosList((prev) => [newPO, ...prev]);
    setBuyerDraft({});
    alert(`Purchase order ${newPO.id} sent to Verma Distributors for approval!`);
    setBuyerTab("po");
  };

  const handleApprovePO = (id: string) => {
    setPosList((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status: "Approved" } : po))
    );
    alert(`Purchase order ${id} approved! Dispatched queue updated.`);
  };

  const handleDispatchPO = (id: string) => {
    setPosList((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status: "Dispatched" } : po))
    );
    alert(`Order ${id} marked as dispatched! Retailer notified.`);
  };

  const handleGoodsReceipt = (id: string) => {
    setPosList((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status: "Delivered" } : po))
    );
    alert(`Goods receipt confirmed for ${id}! Stock added to Sharma Mobile Hub inventory.`);
  };

  const handleRecordPayment = () => {
    if (sharmaReceivable <= 0) {
      alert("Sharma Mobile Hub has already cleared all outstanding receivables.");
      return;
    }
    setSharmaReceivable(0);
    alert("Payment of ₹18,500 recorded via NEFT/UPI! Ledger updated to ₹0.");
  };

  const filteredProducts = SAMPLE_PRODUCTS.filter((p) => {
    const matchQ = !searchQuery || (p.name + p.brand + p.shop).toLowerCase().includes(searchQuery.toLowerCase());
    const matchC = !selectedCat || p.category.toLowerCase().includes(selectedCat.toLowerCase());
    return matchQ && matchC;
  });

  return (
    <div className="min-h-screen bg-white text-navy-900 flex flex-col font-sans">
      <DemoBar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Documentation & Persona Switcher */}
          <div className="lg:col-span-5 space-y-6 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <span>📱</span>
              <span>Flutter Mobile Companion Simulator</span>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                One unified platform, four mobile surfaces.
              </h1>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                Test the complete omnichannel commerce loop directly inside this interactive smartphone frame. Toggle between Customer, Shop Owner, B2B Buyer, and B2B Wholesale Seller.
              </p>
            </div>

            {/* App Mode Switcher (4 Modes) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Select Mobile Surface:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setAppMode("customer")}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    appMode === "customer"
                      ? "bg-[#047857] text-white shadow-xs"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/60"
                  }`}
                >
                  <span>🛍️</span>
                  <span>Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode("owner")}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    appMode === "owner"
                      ? "bg-[#047857] text-white shadow-xs"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/60"
                  }`}
                >
                  <span>🏪</span>
                  <span>Owner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode("buyer")}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    appMode === "buyer"
                      ? "bg-[#047857] text-white shadow-xs"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/60"
                  }`}
                >
                  <span>🏭</span>
                  <span>B2B Buyer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode("seller")}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    appMode === "seller"
                      ? "bg-[#047857] text-white shadow-xs"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/60"
                  }`}
                >
                  <span>🏢</span>
                  <span>B2B Seller</span>
                </button>
              </div>
            </div>

            {/* Mode Description Banner */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-2">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                {appMode === "customer" && "🛍️ Customer Shopping App"}
                {appMode === "owner" && "🏪 Shop Owner Business App (Sharma Mobile Hub)"}
                {appMode === "buyer" && "🏭 B2B Retailer Wholesale App (Purchasing as Sharma Mobile Hub)"}
                {appMode === "seller" && "🏢 B2B Distributor Portal (Verma Distributors)"}
              </div>
              <p className="leading-relaxed text-gray-600">
                {appMode === "customer" && "Browse neighborhood retail stores, check live product availability, order with instant home delivery, and view your Udhaar / Khata passbook."}
                {appMode === "owner" && "Manage daily store operations, generate instant POS invoices, monitor real-time stock levels, and send customer WhatsApp reminders."}
                {appMode === "buyer" && "Source inventory at direct distributor rates with volume tiers, issue digital purchase orders (PO), request Net 15/30 credit, and verify goods inward receipt."}
                {appMode === "seller" && "Approve bulk purchase orders from retailer stores, dispatch stock cartons with barcode batches, and manage wholesale credit receivables."}
              </p>
            </div>

            {/* Architecture Card */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <b>Supabase & API Isolation:</b> All four mobile roles communicate with the exact same Postgres multi-tenant schema. Role-based access controls and shop isolation run on every request.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/"
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition"
              >
                ← Back to Web Storefront
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
                {/* ============================================================== */}
                {/* 1. CUSTOMER APP SCREENS                                        */}
                {/* ============================================================== */}
                {appMode === "customer" && (
                  custTab === "home" ? (
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-black text-emerald-800 text-sm">
                          <span>NSYU</span>
                          <span className="text-gray-400 font-normal">|</span>
                          <span className="text-gray-700 text-xs font-bold">Mithepur, Delhi</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRefresh}
                          className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs hover:bg-gray-200 cursor-pointer"
                          title="Refresh"
                        >
                          ↻
                        </button>
                      </div>

                      {/* Promo Banner */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Sharma Mobile Hub</div>
                        <div className="text-sm font-black mt-0.5">Festive Electronics Sale</div>
                        <div className="text-[11px] text-emerald-100 mt-1">Get up to 40% OFF on fast chargers and wireless earbuds.</div>
                      </div>

                      {/* Category Ribbon */}
                      <div>
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Categories</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCat(selectedCat === c.name ? null : c.name)}
                              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 flex items-center gap-1 transition ${
                                selectedCat === c.name
                                  ? "bg-[#047857] text-white border-emerald-600 shadow-2xs"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <span>{c.icon}</span>
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Featured Products List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Available in Store</span>
                          <span className="text-[10px] text-gray-400">{filteredProducts.length} items</span>
                        </div>

                        {filteredProducts.map((p) => (
                          <div key={p.id} className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-gray-900 truncate">{p.name}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{p.brand} · {p.shop}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-black text-emerald-800">₹{p.price.toLocaleString("en-IN")}</span>
                                {p.mrp > p.price && <span className="text-[10px] text-gray-400 line-through">₹{p.mrp}</span>}
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">In Stock</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addToCart(p.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#064E3B] text-white text-[11px] font-bold shadow-2xs cursor-pointer active:scale-95"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : custTab === "search" ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search products, brands or shops..."
                          className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
                      </div>
                      <div className="space-y-2">
                        {filteredProducts.map((p) => (
                          <div key={p.id} className="p-2.5 bg-white rounded-xl border border-gray-200 flex justify-between items-center">
                            <div>
                              <div className="font-bold">{p.name}</div>
                              <div className="text-emerald-700 font-bold">₹{p.price}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addToCart(p.id)}
                              className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : custTab === "cart" ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-gray-900">Your Shopping Cart</h3>
                      {Object.keys(cart).length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Cart is empty</div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(cart).map(([id, qty]) => {
                            const p = SAMPLE_PRODUCTS.find((x) => x.id === id);
                            if (!p) return null;
                            return (
                              <div key={id} className="p-2.5 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
                                <div>
                                  <div className="font-bold">{p.name}</div>
                                  <div className="text-emerald-700 font-bold">₹{p.price * qty}</div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-lg">
                                  <button type="button" onClick={() => updateCartQty(id, -1)} className="font-bold text-gray-600">-</button>
                                  <span className="font-bold">{qty}</span>
                                  <button type="button" onClick={() => updateCartQty(id, 1)} className="font-bold text-gray-600">+</button>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => alert("Order placed with Udhaar / Khata pay later terms!")}
                            className="w-full py-2.5 bg-[#047857] text-white font-bold rounded-xl mt-3"
                          >
                            Place Order (Pay Later / Cash)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : custTab === "orders" ? (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-black text-gray-900">Order History</h3>
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>Order #ORD-1082</span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">Delivered</span>
                        </div>
                        <div className="text-gray-500 text-[11px]">Redmi 13C 5G × 1 · ₹10,499</div>
                        <div className="text-[10px] text-gray-400">Sharma Mobile Hub · Paid via UPI</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                          AK
                        </div>
                        <div>
                          <div className="font-bold text-sm">Amit Kumar</div>
                          <div className="text-[11px] text-gray-500">98765 43210 · Mithepur, Delhi</div>
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="text-[10px] text-emerald-700 font-bold uppercase">Customer Khata Balance</div>
                        <div className="text-xl font-black text-emerald-900 mt-0.5">₹3,000.00 Due</div>
                        <div className="text-[10px] text-emerald-600 mt-1">Store Credit Limit: ₹10,000.00</div>
                      </div>
                    </div>
                  )
                )}

                {/* ============================================================== */}
                {/* 2. OWNER APP SCREENS                                           */}
                {/* ============================================================== */}
                {appMode === "owner" && (
                  ownerTab === "dashboard" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Active Shop</div>
                          <div className="text-xs font-black text-gray-900">{activeShop}</div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px]">Active</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Today's Sales</div>
                          <div className="text-base font-black text-gray-900 mt-0.5">₹24,850</div>
                          <div className="text-[9.5px] text-emerald-600 mt-0.5">↑ 18 bills generated</div>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Total Khata Udhaar</div>
                          <div className="text-base font-black text-rose-600 mt-0.5">₹18,500</div>
                          <div className="text-[9.5px] text-gray-400 mt-0.5">Across 4 customers</div>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="font-bold text-xs text-gray-900">Action Items</div>
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-[11px] flex items-center justify-between">
                          <span>⚠️ 3 products at low stock</span>
                          <button type="button" onClick={() => setOwnerTab("inventory")} className="font-bold underline text-[10px]">Restock</button>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-900 text-[11px] flex items-center justify-between">
                          <span>📦 2 online orders awaiting pickup</span>
                          <button type="button" onClick={() => setOwnerTab("orders")} className="font-bold underline text-[10px]">View</button>
                        </div>
                      </div>
                    </div>
                  ) : ownerTab === "inventory" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-900">Stock & Inventory</h3>
                        <span className="text-[10px] text-gray-500">Live count</span>
                      </div>
                      {SAMPLE_PRODUCTS.map((p) => (
                        <div key={p.id} className="p-2 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-gray-800">{p.name}</div>
                            <div className="text-[10px] text-gray-500">{p.qty} in stock · ₹{p.price}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert(`Adjust stock for ${p.name}`)}
                            className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700"
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
                      <button
                        type="button"
                        onClick={() => setAppMode("buyer")}
                        className="w-full text-left p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 font-bold text-xs text-emerald-800 hover:border-emerald-500 shadow-2xs"
                      >
                        🏭 Switch to B2B Wholesale Purchasing
                      </button>
                    </div>
                  )
                )}

                {/* ============================================================== */}
                {/* 3. B2B BUYER SCREENS (Wholesale Purchasing)                    */}
                {/* ============================================================== */}
                {appMode === "buyer" && (
                  buyerTab === "market" ? (
                    <div className="space-y-3">
                      {/* Buyer Top Header */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-xs">
                        <div className="text-[9.5px] font-bold text-blue-200 uppercase">Wholesale Procurement</div>
                        <div className="text-xs font-black mt-0.5">Purchasing as: Sharma Mobile Hub</div>
                        <div className="text-[10px] text-blue-100 mt-1">Verified Supplier: Verma Distributors</div>
                      </div>

                      {/* Wholesale Catalog Items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
                          <span>Wholesale Accessories</span>
                          <span>MOQ Tiers</span>
                        </div>

                        {B2B_WHOLESALE_ITEMS.map((item) => {
                          const currentQty = buyerDraft[item.id] || 0;
                          return (
                            <div key={item.id} className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-gray-900">{item.name}</div>
                                  <div className="text-[10px] text-gray-500">{item.pack} · MOQ: {item.moq} pcs</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-blue-800 text-xs">₹{item.rate}/pc</div>
                                  <div className="text-[9.5px] text-gray-400 line-through">MRP ₹{item.mrp}</div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                <span className="text-[10.5px] text-gray-500">
                                  {currentQty > 0 ? `${currentQty} pcs = ₹${(currentQty * item.rate).toLocaleString("en-IN")}` : "Not in draft"}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateBuyerDraft(item.id, -1, item.moq)}
                                    className="w-6 h-6 rounded bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-xs"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-bold text-xs">{currentQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateBuyerDraft(item.id, 1, item.moq)}
                                    className="w-6 h-6 rounded bg-blue-600 text-white font-bold flex items-center justify-center text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* PO Draft & Submit Drawer */}
                      <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-2 mt-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-700">Draft PO Total:</span>
                          <span className="font-black text-blue-900 text-sm">₹{draftSubtotal.toLocaleString("en-IN")}</span>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-bold block mb-1">Payment Terms:</label>
                          <select
                            value={poTerms}
                            onChange={(e) => setPoTerms(e.target.value)}
                            className="w-full h-7 bg-gray-50 border border-gray-200 rounded-lg px-2 text-[11px] outline-none"
                          >
                            <option value="Credit Net 15">Credit Net 15 (Requires approval)</option>
                            <option value="Credit Net 30">Credit Net 30 (Requires approval)</option>
                            <option value="Immediate UPI">Immediate UPI / Bank Transfer</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendPO}
                          className="w-full py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95"
                        >
                          🚀 Send Purchase Order to Distributor
                        </button>
                      </div>
                    </div>
                  ) : buyerTab === "po" ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-900">Purchase Orders</h3>
                        <span className="text-[10px] text-gray-500">Sharma Mobile Hub</span>
                      </div>

                      {posList
                        .filter((po) => po.buyer === "Sharma Mobile Hub")
                        .map((po) => (
                          <div key={po.id} className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-blue-900">{po.id}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                                  po.status === "Delivered"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : po.status === "Dispatched"
                                    ? "bg-blue-50 text-blue-800 animate-pulse"
                                    : "bg-amber-50 text-amber-800"
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-600">{po.items}</div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                              <span>Total: ₹{po.total.toLocaleString("en-IN")} · {po.terms}</span>
                              <span>{po.date}</span>
                            </div>

                            {po.status === "Dispatched" && (
                              <button
                                type="button"
                                onClick={() => handleGoodsReceipt(po.id)}
                                className="w-full mt-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                              >
                                ✓ Confirm Goods Receipt & Stock Inward
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 space-y-2">
                        <div className="text-[10px] font-bold uppercase text-blue-700">Wholesale Payables Statement</div>
                        <div className="text-xl font-black text-blue-950">₹18,500.00 Due</div>
                        <div className="text-[11px] text-blue-800">
                          Supplier: <b>Verma Distributors</b> · Approved Limit: ₹50,000.00
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="font-bold text-xs text-gray-800">Recent Ledger Entries</div>
                        <div className="text-[11px] text-gray-600 flex justify-between py-1 border-b border-gray-100">
                          <span>18 Nov · PO-9041 (Chargers & Neckbands)</span>
                          <span className="font-bold text-rose-600">+₹22,300</span>
                        </div>
                        <div className="text-[11px] text-gray-600 flex justify-between py-1 border-b border-gray-100">
                          <span>14 Nov · NEFT Payment Settle</span>
                          <span className="font-bold text-emerald-600">-₹10,000</span>
                        </div>
                        <div className="text-[11px] text-gray-600 flex justify-between py-1">
                          <span>12 Nov · PO-9038 (Cables)</span>
                          <span className="font-bold text-rose-600">+₹2,250</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => alert("Bank transfer receipt uploaded for verification!")}
                        className="w-full py-2 rounded-xl bg-blue-700 text-white font-bold text-xs"
                      >
                        Record Bank / UPI Payment
                      </button>
                    </div>
                  )
                )}

                {/* ============================================================== */}
                {/* 4. B2B SELLER SCREENS (Verma Distributors)                     */}
                {/* ============================================================== */}
                {appMode === "seller" && (
                  sellerTab === "incoming" ? (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-orange-800 text-white shadow-xs">
                        <div className="text-[9.5px] font-bold text-amber-200 uppercase">Distributor Hub</div>
                        <div className="text-xs font-black mt-0.5">Verma Distributors (Wholesale Hub)</div>
                        <div className="text-[10px] text-amber-100 mt-1">Reviewing incoming orders from neighborhood retail stores</div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
                          <span>Incoming Retailer Orders</span>
                          <span className="text-amber-700 font-bold">
                            {posList.filter((p) => p.status === "Pending").length} pending
                          </span>
                        </div>

                        {posList.map((po) => (
                          <div key={po.id} className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-gray-900">{po.id} · {po.buyer}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  po.status === "Pending" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-600">{po.items}</div>
                            <div className="text-[10px] text-gray-400">Total: ₹{po.total.toLocaleString("en-IN")} ({po.terms})</div>

                            {po.status === "Pending" && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApprovePO(po.id)}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                                >
                                  ✓ Approve PO
                                </button>
                                <button
                                  type="button"
                                  onClick={() => alert(`PO ${po.id} rejected.`)}
                                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11px]"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : sellerTab === "dispatch" ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-900">Vehicle Dispatch Queue</h3>
                        <span className="text-[10px] text-gray-500">Warehouse Outward</span>
                      </div>

                      {posList
                        .filter((p) => p.status === "Approved" || p.status === "Dispatched")
                        .map((po) => (
                          <div key={po.id} className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
                            <div className="flex justify-between items-center font-bold text-xs">
                              <span>{po.id} → {po.buyer}</span>
                              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[9.5px]">
                                {po.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-600">{po.items}</div>
                            {po.status === "Approved" && (
                              <button
                                type="button"
                                onClick={() => handleDispatchPO(po.id)}
                                className="w-full mt-1.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px]"
                              >
                                🚚 Mark Dispatched via Delivery Van
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                        <div className="text-[10px] font-bold uppercase text-amber-800">Total Market Receivables</div>
                        <div className="text-xl font-black text-amber-950">₹{sharmaReceivable.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-amber-800">Across verified retail shops in Delhi NCR</div>
                      </div>

                      <div className="space-y-2">
                        <div className="font-bold text-xs text-gray-800">Retailer Accounts</div>
                        
                        <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-bold text-xs text-gray-900">Sharma Mobile Hub</div>
                              <div className="text-[10.5px] text-gray-500">Credit Limit: ₹50,000 · Terms: Net 15</div>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-rose-600 text-xs">₹{sharmaReceivable.toLocaleString("en-IN")} Due</div>
                              <div className="text-[9.5px] text-gray-400">Due in 9 days</div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-gray-100">
                            <a
                              href="https://wa.me/919810011122?text=Namaste%20Sharma%20Ji,%20Verma%20Distributors%20se%20wholesale%20bill%20ka%20baaki%20payment%20kripya%20bhejein."
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1.5 bg-emerald-50 text-emerald-800 font-bold rounded-lg text-center text-[10.5px] hover:bg-emerald-100"
                            >
                              💬 WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={handleRecordPayment}
                              className="flex-1 py-1.5 bg-amber-600 text-white font-bold rounded-lg text-[10.5px] hover:bg-amber-700"
                            >
                              Collect ₹18.5k
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-gray-200 flex justify-between items-center shadow-2xs">
                          <div>
                            <div className="font-bold text-xs text-gray-900">Gupta Electronics</div>
                            <div className="text-[10.5px] text-gray-500">Credit Limit: ₹30,000</div>
                          </div>
                          <span className="text-emerald-700 font-bold text-xs">₹0 (Clear)</span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Smartphone Bottom Navigation Bar */}
              <div className="h-14 bg-white border-t border-gray-200 px-3 flex items-center justify-around shrink-0 select-none">
                {appMode === "customer" && (
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
                )}

                {appMode === "owner" && (
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

                {appMode === "buyer" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setBuyerTab("market")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        buyerTab === "market" ? "text-blue-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">🏭</span>
                      <span className="text-[9.5px]">Wholesale</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyerTab("po")}
                      className={`flex flex-col items-center gap-0.5 relative cursor-pointer ${
                        buyerTab === "po" ? "text-blue-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📋</span>
                      <span className="text-[9.5px]">My POs</span>
                      {posList.filter((p) => p.buyer === "Sharma Mobile Hub" && p.status === "Dispatched").length > 0 && (
                        <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                          1
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyerTab("ledger")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        buyerTab === "ledger" ? "text-blue-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">💳</span>
                      <span className="text-[9.5px]">Payables</span>
                    </button>
                  </>
                )}

                {appMode === "seller" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSellerTab("incoming")}
                      className={`flex flex-col items-center gap-0.5 relative cursor-pointer ${
                        sellerTab === "incoming" ? "text-amber-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">📥</span>
                      <span className="text-[9.5px]">Orders</span>
                      {posList.filter((p) => p.status === "Pending").length > 0 && (
                        <span className="absolute -top-1 -right-2 bg-amber-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                          {posList.filter((p) => p.status === "Pending").length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellerTab("dispatch")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        sellerTab === "dispatch" ? "text-amber-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">🚚</span>
                      <span className="text-[9.5px]">Dispatch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellerTab("receivables")}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                        sellerTab === "receivables" ? "text-amber-700 font-bold" : "text-gray-400"
                      }`}
                    >
                      <span className="text-base leading-none">💰</span>
                      <span className="text-[9.5px]">Receivables</span>
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
