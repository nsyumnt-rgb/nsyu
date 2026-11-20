import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMarketCategories,
  searchMarket,
  type MarketListing,
} from "../../api/marketplace";
import MarketCard from "../../components/MarketCard";
import MarketCategorySidebar from "../../components/MarketCategorySidebar";

// Quick category circle items below hero banner (matching Image 1)
const CATEGORY_CIRCLES = [
  { name: "Electronics", icon: "💻", query: "Electronics" },
  { name: "Accessories", icon: "🎧", query: "Accessories" },
  { name: "Home & Living", icon: "🛋️", query: "Home & Living" },
  { name: "Fashion", icon: "👕", query: "Fashion" },
  { name: "Beauty Care", icon: "💄", query: "Beauty & Personal Care" },
  { name: "Health Care", icon: "💊", query: "Health & Wellness" },
  { name: "Sports", icon: "🏀", query: "Sports & Fitness" },
  { name: "More", icon: "⊞", query: "" },
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
        setNewArrivals(pNew.data || []);
        setBestSellers(pBest.data || []);
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
    <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
      
      {/* ============================================================== */}
      {/* LEFT SIDEBAR: CATEGORIES (Permanent Left Sidebar in Image 1)   */}
      {/* ============================================================== */}
      <div className="hidden lg:block sticky top-28 z-10">
        <MarketCategorySidebar />
      </div>

      {/* ============================================================== */}
      {/* RIGHT MAIN CONTENT AREA                                         */}
      {/* ============================================================== */}
      <div className="space-y-8 min-w-0">

        {/* 1. HERO CAROUSEL BANNER (Image 1 Mockup) */}
        <div className="market-hero p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[280px]">
          {/* Left Hero Text */}
          <div className="max-w-md space-y-3 z-10 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-navy-900 leading-tight tracking-tight">
              {heroSlides[currentSlide].title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              {heroSlides[currentSlide].subtitle}
            </p>
            <div className="pt-2">
              <Link
                to={heroSlides[currentSlide].buttonLink}
                className="market-accent-button rounded-full px-6 py-2.5 text-xs sm:text-sm hover:scale-105"
              >
                <span>{heroSlides[currentSlide].buttonText}</span>
              </Link>
            </div>
          </div>

          {/* Right Hero Product Collage with 50% Off Badge */}
          <div className="relative flex items-center justify-center z-10">
            {/* Visual Circular Product Frame */}
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white/85 backdrop-blur-xs p-4 flex items-center justify-center shadow-lg border border-emerald-100">
              <img
                src={heroSlides[currentSlide].image}
                alt="Featured Products"
                className="max-h-full max-w-full object-contain rounded-2xl drop-shadow-md hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* "Up to 50% OFF" Badge */}
            <div className="absolute top-2 -right-2 sm:right-2 bg-brand-700 text-white px-3.5 py-1.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1.5 text-xs font-black animate-bounce">
              <span>⭐</span>
              <span>{heroSlides[currentSlide].badgeText}</span>
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
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center shadow-md transition"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
            }
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center shadow-md transition"
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

        {/* 2. CIRCULAR CATEGORY STRIP with Pastel Tints (Inspired by Flower-Shop) */}
        <div className="bg-white rounded-2xl border border-[#EAE7DD] p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4 text-center">
            {CATEGORY_CIRCLES.map((cat, i) => {
              const href = cat.query
                ? `/market/search?category=${encodeURIComponent(cat.query)}`
                : "/market/search";
              const tints = [
                "bg-emerald-50/80 border-emerald-100 text-emerald-900 group-hover:bg-emerald-100",
                "bg-amber-50/80 border-amber-100 text-amber-900 group-hover:bg-amber-100",
                "bg-sky-50/80 border-sky-100 text-sky-900 group-hover:bg-sky-100",
                "bg-rose-50/80 border-rose-100 text-rose-900 group-hover:bg-rose-100",
                "bg-indigo-50/80 border-indigo-100 text-indigo-900 group-hover:bg-indigo-100",
                "bg-teal-50/80 border-teal-100 text-teal-900 group-hover:bg-teal-100",
                "bg-orange-50/80 border-orange-100 text-orange-900 group-hover:bg-orange-100",
                "bg-slate-50/80 border-slate-100 text-slate-900 group-hover:bg-slate-100",
              ];
              const tint = tints[i % tints.length];
              return (
                <Link
                  key={cat.name}
                  to={href}
                  className="group flex flex-col items-center gap-2 transition"
                >
                  <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center text-xl sm:text-2xl shadow-xs group-hover:scale-110 transition-all duration-200 ${tint}`}>
                    <span>{cat.icon}</span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-700 group-hover:text-brand-700 transition truncate max-w-full">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 3. NEW ARRIVALS SECTION (6-Column Grid in Image 1) */}
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
          ) : newArrivals.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 text-xs text-gray-400">
              No products available right now.
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

        {/* 4. BEST SELLERS SECTION (6-Column Grid in Image 1) */}
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
              {(bestSellers.length > 0 ? bestSellers : newArrivals)
                .slice(0, 12)
                .map((p) => (
                  <MarketCard
                    key={`best-${p.shop.id}-${p.productId}`}
                    listing={p}
                  />
                ))}
            </div>
          )}
        </section>

        {/* 5. TRUST & ASSURANCE BANNER (Inspired by Flower-Shop's Contact & Assurance Card) */}
        <div className="rounded-2xl border border-[#EAE7DD] bg-white p-6 sm:p-8 shadow-xs">
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
                <h4 className="text-xs sm:text-sm font-bold text-navy-900">B2B & B2C Billing</h4>
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
    </div>
  );
}
