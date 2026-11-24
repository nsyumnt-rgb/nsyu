import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMarketCategories,
  getMarketShops,
  searchMarket,
  type MarketListing,
  type MarketShop,
} from "../../api/marketplace";
import MarketCard, { listingHref } from "../../components/MarketCard";
import MarketCategorySidebar from "../../components/MarketCategorySidebar";
import { ProductPlaceholder } from "../../components/ProductArt";
import { resolveAssetUrl } from "../../api/client";

type HeroSlide = {
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  /** Real discount for this product, or null when there isn't one. */
  discount: number | null;
  price?: number;
  mrp?: number;
  image: string | null;
  listing?: MarketListing;
  shopName?: string;
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const discountOf = (l: MarketListing) =>
  l.discountPercent > 0
    ? Math.round(l.discountPercent)
    : l.mrp && l.mrp > l.price
    ? Math.round(((l.mrp - l.price) / l.mrp) * 100)
    : 0;

const keyOf = (l: MarketListing) => `p-${l.shop.id}-${l.productId}`;

/** Builds the hero carousel from live marketplace data — no placeholder copy or stock photos. */
function buildHeroSlides(
  newArrivals: MarketListing[],
  bestSellers: MarketListing[],
  shops: MarketShop[],
  shopTotal: number,
  productTotal: number,
): HeroSlide[] {
  const seen = new Set<string>();
  const pool = [...bestSellers, ...newArrivals].filter((l) => {
    const k = keyOf(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const productSlide = (l: MarketListing, eyebrow: string): HeroSlide => {
    const d = discountOf(l);
    return {
      key: keyOf(l),
      eyebrow,
      title: l.name,
      subtitle: [l.brand, l.category, `Sold by ${l.shop.name}`].filter(Boolean).join(" · "),
      buttonText: "Shop now →",
      buttonLink: listingHref(l),
      discount: d > 0 ? d : null,
      price: l.price,
      mrp: l.mrp && l.mrp > l.price ? l.mrp : undefined,
      image: resolveAssetUrl(l.imageUrl),
      listing: l,
    };
  };

  const slides: HeroSlide[] = [];
  // The biggest real discounts available right now
  pool
    .filter((l) => discountOf(l) > 0)
    .sort((a, b) => discountOf(b) - discountOf(a))
    .slice(0, 2)
    .forEach((l) => slides.push(productSlide(l, "Top deal")));
  // The newest product not already shown
  const fresh = newArrivals.find((l) => !slides.some((s) => s.key === keyOf(l)));
  if (fresh) slides.push(productSlide(fresh, "New arrival"));
  // Live shop and product counts
  if (shopTotal > 0) {
    const names = shops.slice(0, 3).map((s) => s.name);
    slides.push({
      key: "shops",
      eyebrow: "Local shops",
      title: `${shopTotal} local shop${shopTotal === 1 ? "" : "s"}, ${productTotal} product${productTotal === 1 ? "" : "s"} in stock`,
      subtitle: names.length ? `Including ${names.join(", ")}` : "Order directly from verified neighbourhood stores.",
      buttonText: "Explore shops →",
      buttonLink: "/market/shops",
      discount: null,
      image: resolveAssetUrl(shops[0]?.logo),
      shopName: shops[0]?.name,
    });
  }
  return slides;
}

export default function MarketHome() {
  const [categories, setCategories] = useState<{ name: string; count: number; imageUrl: string | null }[]>([]);
  const [newArrivals, setNewArrivals] = useState<MarketListing[]>([]);
  const [bestSellers, setBestSellers] = useState<MarketListing[]>([]);
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [shopTotal, setShopTotal] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    Promise.all([
      getMarketCategories().catch(() => []),
      searchMarket({ sort: "newest", inStock: true, limit: 12 }).catch(() => null),
      searchMarket({ sort: "relevance", inStock: true, limit: 12 }).catch(() => null),
      getMarketShops({ limit: 6 }).catch(() => null),
    ])
      .then(([cats, pNew, pBest, pShops]) => {
        setCategories(cats || []);
        setNewArrivals(pNew?.data || []);
        setBestSellers(pBest?.data || []);
        setShops(pShops?.data || []);
        setShopTotal(pShops?.pagination?.total ?? pShops?.data?.length ?? 0);
        setProductTotal(pNew?.pagination?.total ?? pNew?.data?.length ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const heroSlides = useMemo(
    () => buildHeroSlides(newArrivals, bestSellers, shops, shopTotal, productTotal),
    [newArrivals, bestSellers, shops, shopTotal, productTotal],
  );
  const slideCount = heroSlides.length;
  const slide = slideCount ? heroSlides[currentSlide % slideCount] : null;

  // Carousel autoplay timer
  useEffect(() => {
    if (slideCount < 2) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 6000);
    return () => clearInterval(timer);
  }, [slideCount]);

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
          {/* Hero Banner — slides are built from live marketplace data */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#D7F5E6] via-[#EDFAF3] to-[#C9F2DC] border border-emerald-100/90 px-12 py-8 sm:px-14 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[290px] shadow-xs">
            {!slide ? (
              loading ? (
                <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6" aria-busy="true">
                  <div className="w-full max-w-md space-y-3">
                    <div className="skeleton h-4 w-24 rounded-full" />
                    <div className="skeleton h-9 w-full rounded-xl" />
                    <div className="skeleton h-4 w-2/3 rounded-lg" />
                    <div className="skeleton h-10 w-36 rounded-full" />
                  </div>
                  <div className="skeleton w-56 h-56 sm:w-64 sm:h-64 rounded-full" />
                </div>
              ) : (
                <div className="max-w-md space-y-3 z-10 text-center md:text-left">
                  <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-navy-900 leading-tight tracking-tight">
                    Shop from local stores near you
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    Products appear here as soon as shops publish them.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/market/shops"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-navy-900 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95"
                    >
                      Explore shops →
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <>
                {/* Left Hero Text */}
                <div key={slide.key} className="max-w-md min-w-0 space-y-3 z-10 text-center md:text-left animate-fade-in">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700 ring-1 ring-inset ring-brand-600/15">
                    {slide.eyebrow}
                  </span>
                  <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-navy-900 leading-tight tracking-tight line-clamp-3 [overflow-wrap:anywhere]">
                    {slide.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium line-clamp-2">{slide.subtitle}</p>
                  {slide.price !== undefined && (
                    <div className="flex items-baseline justify-center md:justify-start gap-2 tabular">
                      <span className="text-xl sm:text-2xl font-extrabold text-navy-900">{inr(slide.price)}</span>
                      {slide.mrp && <span className="text-sm text-slate-400 line-through">{inr(slide.mrp)}</span>}
                    </div>
                  )}
                  <div className="pt-1">
                    <Link
                      to={slide.buttonLink}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-navy-900 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm transition shadow-md hover:scale-105 active:scale-95"
                    >
                      <span>{slide.buttonText}</span>
                    </Link>
                  </div>
                </div>

                {/* Right: real product image (or a generated placeholder when the shop hasn't uploaded one) */}
                <Link to={slide.buttonLink} className="relative flex items-center justify-center z-10 shrink-0" aria-label={slide.title}>
                  <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white/85 backdrop-blur-xs p-6 flex items-center justify-center shadow-lg border border-emerald-100 overflow-hidden">
                    {slide.image ? (
                      <img
                        key={slide.key}
                        src={slide.image}
                        alt={slide.title}
                        className="max-h-full max-w-full object-contain rounded-2xl drop-shadow-md hover:scale-105 transition-transform duration-500 animate-fade-in"
                      />
                    ) : slide.listing ? (
                      <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-3xl overflow-hidden shadow-md">
                        <ProductPlaceholder name={slide.listing.name} category={slide.listing.category} brand={slide.listing.brand} />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-3xl bg-brand-gradient text-white flex items-center justify-center text-5xl font-black shadow-brand">
                        {(slide.shopName || "N").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {slide.discount !== null && (
                    <div className="absolute top-2 -right-2 sm:right-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-navy-900 text-white p-1 shadow-xl border-2 border-white flex flex-col items-center justify-center text-center leading-none z-20">
                      <span className="text-base sm:text-lg font-black text-amber-300 tracking-tight tabular">{slide.discount}%</span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase mt-0.5">OFF</span>
                    </div>
                  )}
                </Link>

                {slideCount > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount)}
                      aria-label="Previous slide"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-md transition z-20"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentSlide((prev) => (prev + 1) % slideCount)}
                      aria-label="Next slide"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-md transition z-20"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                      {heroSlides.map((s, idx) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setCurrentSlide(idx)}
                          className={`h-2 rounded-full transition-all ${
                            currentSlide % slideCount === idx ? "w-6 bg-brand-700" : "w-2 bg-emerald-300 hover:bg-emerald-400"
                          }`}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Real API Driven Category Tiles */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 shadow-2xs">
            {categories.length === 0 ? (
              <div className="text-center py-3 text-xs text-slate-400 font-medium">
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
                      className="bg-white rounded-2xl border border-slate-100/90 shadow-2xs p-2 sm:p-2.5 flex flex-col items-center justify-center gap-1.5 hover:shadow-md hover:border-emerald-200 transition group"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50/50">
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
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition truncate max-w-full">
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
            <h2 className="text-base sm:text-lg font-extrabold text-navy-900 tracking-tight">
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
                className="bg-white rounded-2xl border border-slate-100 p-3 h-64 animate-pulse"
              />
            ))}
          </div>
        ) : newArrivals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-xs text-slate-500 font-medium">
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
            <h2 className="text-base sm:text-lg font-extrabold text-navy-900 tracking-tight">
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
                className="bg-white rounded-2xl border border-slate-100 p-3 h-64 animate-pulse"
              />
            ))}
          </div>
        ) : bestSellers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-xs text-slate-500 font-medium">
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
      <div className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🏪
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Verified Direct Shops</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Order directly from approved neighborhood merchants.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🚚
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Fast Local Dispatch</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Prompt delivery directly from your nearest store.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              📑
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">Retail Billing & Khata</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Instant GST invoices, customer ledger & credit terms.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 text-xl border border-emerald-100">
              🛡️
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-navy-900">100% Genuine Products</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Transparent stock records and easy returns policy.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
