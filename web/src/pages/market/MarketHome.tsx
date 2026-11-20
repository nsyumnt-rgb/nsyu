import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMarketCategories,
  searchMarket,
  type MarketListing,
} from "../../api/marketplace";
import MarketCard from "../../components/MarketCard";
import MarketCategorySidebar from "../../components/MarketCategorySidebar";
import { resolveAssetUrl } from "../../api/client";

export default function MarketHome() {
  const [categories, setCategories] = useState<{ name: string; count: number; imageUrl: string | null }[]>([]);
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
      .then(([cats, pNew, pBest]) => {
        setCategories(cats || []);
        setNewArrivals(pNew?.data || []);
        setBestSellers(pBest?.data || []);
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

        {/* Right Main Area: Hero Banner + Category Tile Shelf */}
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
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#064E3B] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>{heroSlides[currentSlide].buttonText}</span>
                </Link>
              </div>
            </div>

            {/* Right Hero Product Collage with Badge */}
            <div className="relative flex items-center justify-center z-10">
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white/85 backdrop-blur-xs p-4 flex items-center justify-center shadow-lg border border-emerald-100">
                <img
                  src={heroSlides[currentSlide].image}
                  alt="Featured Products"
                  className="max-h-full max-w-full object-contain rounded-2xl drop-shadow-md hover:scale-105 transition-transform duration-500"
                />
              </div>

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

          {/* Real API Driven Category Tiles */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-2xs">
            {categories.length === 0 ? (
              <div className="text-center py-3 text-xs text-gray-400 font-medium">
                {loading ? "Loading categories..." : "Categories will appear here once products are published."}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3 text-center">
                {categories.slice(0, 8).map((cat) => {
                  const src = cat.imageUrl ? resolveAssetUrl(cat.imageUrl) : null;
                  return (
                    <Link
                      key={cat.name}
                      to={`/market/search?category=${encodeURIComponent(cat.name)}`}
                      className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs p-2 sm:p-2.5 flex flex-col items-center justify-center gap-1.5 hover:shadow-md hover:border-emerald-200 transition group"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50/50">
                        {src ? (
                          <img
                            src={src}
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
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FULL-WIDTH: NEW ARRIVALS (Live Products from Backend API)   */}
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
        ) : newArrivals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-xs text-gray-500 font-medium">
            No new products available right now. New items added by registered shops will appear here immediately.
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
      {/* 3. FULL-WIDTH: BEST SELLERS (Live Products from Backend API)   */}
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
        ) : bestSellers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-xs text-gray-500 font-medium">
            Featured products will appear here based on real customer orders.
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
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Retail Billing & Khata</h4>
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
