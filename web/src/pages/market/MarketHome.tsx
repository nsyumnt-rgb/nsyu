import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMarketCategories,
  searchMarket,
  type MarketListing,
} from "../../api/marketplace";
import MarketCard from "../../components/MarketCard";
import MarketCategorySidebar from "../../components/MarketCategorySidebar";

// Quick category items below hero banner (matching Image 1 Wireframe 8 tiles)
const CATEGORY_TILES = [
  {
    name: "Electronics",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=200&q=80",
    query: "Electronics",
  },
  {
    name: "Accessories",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
    query: "Accessories",
  },
  {
    name: "Home & Living",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=200&q=80",
    query: "Home & Living",
  },
  {
    name: "Fashion",
    image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=200&q=80",
    query: "Fashion",
  },
  {
    name: "Beauty Care",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=200&q=80",
    query: "Beauty & Personal Care",
  },
  {
    name: "Health Care",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80",
    query: "Health & Wellness",
  },
  {
    name: "Sports",
    image: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=200&q=80",
    query: "Sports & Fitness",
  },
  {
    name: "More",
    icon: "⊞",
    query: "",
  },
];

// Fallback listings to match Image 1 wireframe 1:1 if DB has fewer products
const WIREFRAME_NEW_ARRIVALS: MarketListing[] = [
  {
    productId: 9001,
    name: "Premium Earbuds 451270",
    brand: "NSYU Audio",
    sku: "UC-EARBUD-451",
    category: "Accessories",
    price: 2500,
    mrp: 2999,
    discountPercent: 17,
    gstPercent: 18,
    stock: 45,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
  {
    productId: 9002,
    name: "Wireless Keyboard 237746",
    brand: "NSYU Tech",
    sku: "UC-KB-237",
    category: "Electronics",
    price: 1500,
    mrp: 1800,
    discountPercent: 17,
    gstPercent: 18,
    stock: 30,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=400&q=80",
    shop: { id: 2, name: "Gupta Electronics", code: "s2", address: "Sector 18, Noida" },
  },
  {
    productId: 9003,
    name: "Wireless Keyboard 313801",
    brand: "NSYU Tech",
    sku: "UC-KB-313",
    category: "Electronics",
    price: 1500,
    mrp: 1800,
    discountPercent: 17,
    gstPercent: 18,
    stock: 25,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=400&q=80",
    shop: { id: 3, name: "Verma Distributors", code: "s3", address: "Commercial Plaza, Ghaziabad" },
  },
  {
    productId: 9004,
    name: "Power Bank 20000mAh",
    brand: "NSYU Power",
    sku: "UC-PB-200",
    category: "Accessories",
    price: 1499,
    mrp: 1799,
    discountPercent: 17,
    gstPercent: 18,
    stock: 60,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1609592424368-20d0f622e70e?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
  {
    productId: 9005,
    name: "Neckband Bluetooth",
    brand: "NSYU Audio",
    sku: "UC-NB-099",
    category: "Accessories",
    price: 999,
    mrp: 1199,
    discountPercent: 17,
    gstPercent: 18,
    stock: 50,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
  {
    productId: 9006,
    name: "GaN Charger 100W",
    brand: "NSYU Power",
    sku: "UC-CHG-100",
    category: "Chargers",
    price: 2499,
    mrp: 2999,
    discountPercent: 17,
    gstPercent: 18,
    stock: 40,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    shop: { id: 2, name: "Gupta Electronics", code: "s2", address: "Sector 18, Noida" },
  },
];

const WIREFRAME_BEST_SELLERS: MarketListing[] = [
  {
    productId: 9101,
    name: "Smartphone 5G Pro",
    brand: "NSYU Mobile",
    sku: "UC-PH-5G",
    category: "Electronics",
    price: 14999,
    mrp: 17999,
    discountPercent: 17,
    gstPercent: 18,
    stock: 15,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
  {
    productId: 9102,
    name: "Over-Ear Wireless Headphones",
    brand: "NSYU Audio",
    sku: "UC-HP-349",
    category: "Accessories",
    price: 3499,
    mrp: 4499,
    discountPercent: 22,
    gstPercent: 18,
    stock: 20,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
    shop: { id: 2, name: "Gupta Electronics", code: "s2", address: "Sector 18, Noida" },
  },
  {
    productId: 9103,
    name: "Smart Watch Elite",
    brand: "NSYU Tech",
    sku: "UC-SW-299",
    category: "Electronics",
    price: 2999,
    mrp: 3999,
    discountPercent: 25,
    gstPercent: 18,
    stock: 35,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
  {
    productId: 9104,
    name: "Ultra Slim Phone 128GB",
    brand: "NSYU Mobile",
    sku: "UC-PH-128",
    category: "Electronics",
    price: 18999,
    mrp: 21999,
    discountPercent: 14,
    gstPercent: 18,
    stock: 12,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=400&q=80",
    shop: { id: 3, name: "Verma Distributors", code: "s3", address: "Commercial Plaza, Ghaziabad" },
  },
  {
    productId: 9105,
    name: "Classic Chrono Watch",
    brand: "NSYU Tech",
    sku: "UC-SW-199",
    category: "Accessories",
    price: 1999,
    mrp: 2499,
    discountPercent: 20,
    gstPercent: 18,
    stock: 28,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=400&q=80",
    shop: { id: 2, name: "Gupta Electronics", code: "s2", address: "Sector 18, Noida" },
  },
  {
    productId: 9106,
    name: "Flagship Mobile 5G",
    brand: "NSYU Mobile",
    sku: "UC-PH-5GF",
    category: "Electronics",
    price: 24999,
    mrp: 28999,
    discountPercent: 14,
    gstPercent: 18,
    stock: 8,
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=400&q=80",
    shop: { id: 1, name: "Sharma Mobile Hub", code: "s1", address: "Mithepur, Badarpur, Delhi" },
  },
];

export default function MarketHome() {
  const [newArrivals, setNewArrivals] = useState<MarketListing[]>([]);
  const [bestSellers, setBestSellers] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      title: "Premium Quality Products at Best Prices",
      subtitle: "Shop Smart. Save More.",
      buttonText: "Shop Now →",
      buttonLink: "/market/search",
      badgeText: "Up to 50% OFF",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Discover Local Shops & Direct Delivery",
      subtitle: "Support Verified Neighborhood Stores.",
      buttonText: "Explore Shops →",
      buttonLink: "/market/shops",
      badgeText: "Fast Local Delivery",
      image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80",
    },
  ];

  useEffect(() => {
    Promise.all([
      getMarketCategories().catch(() => []),
      searchMarket({ sort: "newest", inStock: true, limit: 12 }).catch(() => ({
        data: [] as MarketListing[],
      })),
      searchMarket({ sort: "relevance", inStock: true, limit: 12 }).catch(() => ({
        data: [] as MarketListing[],
      })),
    ])
      .then(([, pNew, pBest]) => {
        const dbNew = pNew.data || [];
        const dbBest = pBest.data || [];

        // Ensure at least 6 listings matching Image 1
        const mergedNew = [...dbNew];
        for (const wf of WIREFRAME_NEW_ARRIVALS) {
          if (mergedNew.length >= 6) break;
          if (!mergedNew.some((m) => m.name === wf.name)) mergedNew.push(wf);
        }

        const mergedBest = [...dbBest];
        for (const wf of WIREFRAME_BEST_SELLERS) {
          if (mergedBest.length >= 6) break;
          if (!mergedBest.some((m) => m.name === wf.name)) mergedBest.push(wf);
        }

        setNewArrivals(mergedNew.length > 0 ? mergedNew : WIREFRAME_NEW_ARRIVALS);
        setBestSellers(mergedBest.length > 0 ? mergedBest : WIREFRAME_BEST_SELLERS);
      })
      .finally(() => setLoading(false));
  }, []);

  // Carousel autoplay timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  return (
    <div className="space-y-8 relative">
      
      {/* ============================================================== */}
      {/* 1. TOP SECTION: CATEGORIES SIDEBAR (Left) + HERO & TILES (Right)*/}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
        
        {/* Left Sidebar: Categories (Permanent Card matching Image 1) */}
        <div className="hidden lg:block sticky top-28 z-10">
          <MarketCategorySidebar />
        </div>

        {/* Right Main Area: Hero Banner + 8-Category Tile Shelf */}
        <div className="space-y-4 min-w-0">

          {/* Hero Banner with Mint Green Gradient */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#D7F5E6] via-[#EDFAF3] to-[#C9F2DC] border border-emerald-100/90 p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[290px] shadow-xs">
            {/* Left Hero Text */}
            <div className="max-w-md space-y-3 z-10 text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-[#064E3B] leading-tight tracking-tight">
                {heroSlides[currentSlide].title}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                {heroSlides[currentSlide].subtitle}
              </p>
              <div className="pt-2">
                <Link
                  to={heroSlides[currentSlide].buttonLink}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#064E3B] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95"
                >
                  <span>{heroSlides[currentSlide].buttonText}</span>
                </Link>
              </div>
            </div>

            {/* Right Hero Product Collage with 50% Off Badge */}
            <div className="relative flex items-center justify-center z-10">
              {/* Circular Product Frame */}
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white/85 backdrop-blur-xs p-4 flex items-center justify-center shadow-lg border border-emerald-100">
                <img
                  src={heroSlides[currentSlide].image}
                  alt="Featured Products"
                  className="max-h-full max-w-full object-contain rounded-2xl drop-shadow-md hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* "Up to 50% OFF" Circular Badge matching Image 1 */}
              <div className="absolute top-2 -right-2 sm:right-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#064E3B] text-white p-1 shadow-xl border-2 border-white flex flex-col items-center justify-center text-center leading-none z-20 animate-pulse">
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-200">Up to</span>
                <span className="text-base sm:text-lg font-black text-amber-300 tracking-tight">50%</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase">OFF</span>
              </div>
            </div>

            {/* Carousel Arrows */}
            <button
              type="button"
              onClick={() =>
                setCurrentSlide(
                  (prev) => (prev - 1 + heroSlides.length) % heroSlides.length
                )
              }
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow-md transition cursor-pointer"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
              }
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow-md transition cursor-pointer"
            >
              ›
            </button>

            {/* Carousel Pagination Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlide === idx
                      ? "w-6 bg-[#047857]"
                      : "w-2 bg-emerald-300 hover:bg-emerald-400"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* 8-Category Tiles Row (Matching Image 1 Wireframe) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-2xs">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3 text-center">
              {CATEGORY_TILES.map((cat) => {
                const href = cat.query
                  ? `/market/search?category=${encodeURIComponent(cat.query)}`
                  : "/market/search";
                return (
                  <Link
                    key={cat.name}
                    to={href}
                    className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs p-2 sm:p-2.5 flex flex-col items-center justify-center gap-1.5 hover:shadow-md hover:border-emerald-200 transition group"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50/50">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain p-1 group-hover:scale-110 transition duration-300"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#047857] flex items-center justify-center text-lg font-black">
                          ⊞
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-gray-800 group-hover:text-emerald-700 transition truncate max-w-full">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FULL-WIDTH: NEW ARRIVALS (6 Cards across matching Image 1)  */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-[#047857] inline-block" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              New Arrivals
            </h2>
          </div>
          <Link
            to="/market/search?sort=newest"
            className="text-xs font-bold text-[#047857] hover:text-emerald-800 flex items-center gap-1 transition"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-3 h-64 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {newArrivals.slice(0, 12).map((p) => (
              <MarketCard
                key={`${p.shop.id}-${p.productId}`}
                listing={p}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 3. FULL-WIDTH: BEST SELLERS (6 Cards across matching Image 1)  */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-[#047857] inline-block" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Best Sellers
            </h2>
          </div>
          <Link
            to="/market/search?sort=relevance"
            className="text-xs font-bold text-[#047857] hover:text-emerald-800 flex items-center gap-1 transition"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-3 h-64 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {bestSellers.slice(0, 12).map((p) => (
              <MarketCard
                key={`best-${p.shop.id}-${p.productId}`}
                listing={p}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 4. TRUST & ASSURANCE BANNER                                    */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🏪
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Verified Direct Shops</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Order directly from approved neighborhood merchants.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🚚
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Fast Local Dispatch</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Prompt delivery directly from your nearest store.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              📑
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Retail & POS Billing</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Instant GST invoices, customer ledger & credit terms.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🛡️
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">100% Genuine Products</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Transparent stock records and easy returns policy.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
