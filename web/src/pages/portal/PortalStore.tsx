import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getPortalCategoriesApi, getPortalProductsApi } from "../../api/portal";
import { getMarketShop, type MarketShopDetail } from "../../api/marketplace";
import { resolveAssetUrl } from "../../api/client";
import { usePortalStore } from "../../store/portalStore";
import { CatalogCard, inr, priceInfo, primaryImage, type Category, type Product } from "../../components/StoreProduct";
import { KindIcon, ProductPlaceholder, productKind, tintFor } from "../../components/ProductArt";
import { useCartQty } from "../../components/storefront/useCartQty";

/* Customer storefront home. Every block is built from live catalog data for the customer's shop:
   banner slides use real products, rails use real sort orders, and empty rails are hidden. */

type Rail = { loading: boolean; items: Product[] };
const EMPTY: Rail = { loading: true, items: [] };

export default function PortalStore() {
  const customer = usePortalStore((s) => s.customer);
  const { cardProps, error, setError } = useCartQty();
  const [shop, setShop] = useState<MarketShopDetail | null>(null);
  const [categories, setCategories] = useState<(Category & { imageUrl?: string | null })[] | null>(null);
  const [newest, setNewest] = useState<Rail>(EMPTY);
  const [popular, setPopular] = useState<Rail>(EMPTY);
  const [offers, setOffers] = useState<Rail>(EMPTY);
  const [more, setMore] = useState<Rail>(EMPTY);

  useEffect(() => {
    if (customer?.shop?.code) getMarketShop(customer.shop.code).then(setShop).catch(() => setShop(null));
    getPortalCategoriesApi().then(setCategories).catch(() => setCategories([]));
    const load = (params: Parameters<typeof getPortalProductsApi>[0], set: (r: Rail) => void, keep: (p: Product) => boolean = () => true) =>
      getPortalProductsApi(params)
        .then((res) => set({ loading: false, items: ((res?.data || []) as Product[]).filter(keep) }))
        .catch(() => set({ loading: false, items: [] }));
    load({ sort: "newest", page: 1, limit: 10 }, setNewest);
    load({ sort: "popular", page: 1, limit: 10 }, setPopular, (p: any) => Number(p.unitsSold || 0) > 0);
    load({ sort: "discount", page: 1, limit: 10 }, setOffers, (p) => priceInfo(p).off > 0);
    load({ page: 1, limit: 10 }, setMore);
  }, [customer?.shop?.code]);

  // Banner slides from real products: the shop itself, its best offer and its newest arrival.
  const slides = useMemo(() => {
    const out: Slide[] = [];
    // The owner's uploaded store banner leads the slider when there is one.
    if (shop?.banner) out.push({ kind: "banner", url: shop.banner });
    const withImg = (list: Product[]) => list.filter((p) => primaryImage(p));
    const collage = withImg([...newest.items, ...offers.items, ...more.items]).slice(0, 3);
    out.push({ kind: "shop", products: collage });
    const offer = offers.items[0];
    if (offer) out.push({ kind: "offer", product: offer });
    const fresh = newest.items.find((p) => p.id !== offer?.id);
    if (fresh) out.push({ kind: "new", product: fresh });
    return out;
  }, [newest.items, offers.items, more.items, shop?.banner]);

  const shopName = customer?.shop?.name || "our store";
  const inStockCount = more.items.length;

  return (
    <div className="space-y-10 sm:space-y-12">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-semibold">Dismiss</button>
        </div>
      )}

      {/* Banner + store facts */}
      <section className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <BannerSlider slides={slides} shopName={shopName} address={customer?.shop?.address || shop?.address || null} loading={newest.loading && offers.loading} />
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <Fact tone="emerald" title={shop?.acceptsOrders === false ? "Orders paused" : "Order online"} sub={shop?.acceptsOrders === false ? "The shop isn't taking online orders right now" : "Home delivery or store pickup"} icon={<><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>} />
          <Fact tone="sky" title="Pay at delivery" sub="No online payment needed" icon={<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>} />
          <Fact tone="violet" title="Track every order" sub="Bills & khata in your account" icon={<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>} to="/portal/orders" />
          {customer?.shop?.phone ? (
            <Fact tone="amber" title="Need help?" sub={`Call ${customer.shop.phone}`} href={`tel:${customer.shop.phone}`} icon={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />} />
          ) : Number(shop?.minOrderValue || 0) > 0 ? (
            <Fact tone="amber" title="Minimum order" sub={`${inr(Number(shop?.minOrderValue))} per order`} icon={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>} />
          ) : (
            <Fact tone="amber" title="Your khata" sub="See dues and payments" to="/portal/ledger" icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>} />
          )}
        </div>
      </section>

      {/* Categories */}
      {(categories === null || categories.length > 0) && (
        <section>
          <SectionHead title="Featured categories" to="/portal/catalog" />
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories === null
              ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="shrink-0 w-[104px] sm:w-[124px] h-[136px] rounded-2xl bg-white ring-1 ring-slate-200/70 animate-pulse" />)
              : categories.map((c) => {
                  const img = resolveAssetUrl(c.imageUrl);
                  const t = tintFor(`${c.name}|${productKind(c.name)}`);
                  return (
                    <Link key={c.id} to={`/portal/catalog?category=${c.id}`} className="group snap-start shrink-0 w-[104px] sm:w-[124px] rounded-2xl bg-white ring-1 ring-slate-200/70 px-2 pt-4 pb-3 flex flex-col items-center text-center transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200">
                      <span className={`w-[68px] h-[68px] sm:w-20 sm:h-20 rounded-full overflow-hidden flex items-center justify-center transition group-hover:scale-105 ${img ? "bg-[#F3F4F2]" : `bg-gradient-to-br ${t.bg} ${t.fg}`}`}>
                        {img ? <img src={img} alt="" loading="lazy" className="w-[78%] h-[78%] object-contain mix-blend-multiply" /> : <KindIcon kind={productKind(c.name)} className="w-8 h-8" />}
                      </span>
                      <span className="mt-2.5 text-[12.5px] sm:text-[13px] font-semibold text-navy-900 leading-tight line-clamp-2 capitalize">{c.name.toLowerCase()}</span>
                      {(c as any).productCount !== undefined && <span className="text-[11.5px] text-slate-400 tabular">{(c as any).productCount} item{(c as any).productCount === 1 ? "" : "s"}</span>}
                    </Link>
                  );
                })}
          </div>
        </section>
      )}

      <ProductRail title="Featured products" subtitle="Most bought at this shop" to="/portal/catalog?sort=popular" rail={popular} cardProps={cardProps} hideWhenEmpty />
      <ProductRail title="Latest products" subtitle="Recently added to the store" to="/portal/catalog?sort=newest" rail={newest} cardProps={cardProps} />
      <ProductRail title="Special offers" subtitle="Biggest savings on MRP" to="/portal/catalog?sort=discount" rail={offers} cardProps={cardProps} hideWhenEmpty accent />

      {/* More to explore (grid) */}
      <section>
        <SectionHead title="More to explore" to="/portal/catalog" />
        {!more.loading && more.items.length === 0 ? (
          <EmptyCatalog />
        ) : (
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {more.loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[200px] rounded-2xl bg-white border border-border animate-pulse" />) : more.items.map((p) => <CatalogCard key={p.id} product={p} {...cardProps(p)} />)}
          </div>
        )}
        {inStockCount >= 10 && (
          <div className="mt-6 text-center">
            <Link to="/portal/catalog" className="btn-secondary h-11 px-6 rounded-full">Browse all products</Link>
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────── Banner slider ───────────────────────── */

type Slide = { kind: "banner"; url: string } | { kind: "shop"; products: Product[] } | { kind: "offer"; product: Product } | { kind: "new"; product: Product };

function BannerSlider({ slides, shopName, address, loading }: { slides: Slide[]; shopName: string; address: string | null; loading: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const idx = n ? i % n : 0;

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 5500);
    return () => clearInterval(t);
  }, [n, paused]);

  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <div
      className="relative overflow-hidden rounded-3xl min-h-[260px] sm:min-h-[320px] bg-gradient-to-br from-[#E9F7F0] via-[#EEF6FB] to-[#E7F3FF] ring-1 ring-slate-200/60"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      aria-roledescription="carousel"
    >
      <div aria-hidden className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/50" />
      <div aria-hidden className="absolute right-24 -bottom-32 w-72 h-72 rounded-full bg-brand-100/40" />
      {loading && n <= 1 ? (
        <div className="absolute inset-0 animate-pulse" />
      ) : (
        <div className="flex h-full transition-transform duration-700 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {slides.map((s, k) =>
            s.kind === "banner" ? (
              <div key={k} className="relative shrink-0 w-full min-h-[260px] sm:min-h-[320px]" aria-hidden={k !== idx}>
                <img src={resolveAssetUrl(s.url) || ""} alt={`${shopName} banner`} className="absolute inset-0 w-full h-full object-cover" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute left-6 sm:left-20 bottom-10 right-6 text-white">
                  <div className="text-[22px] sm:text-[30px] font-bold tracking-tight drop-shadow">{shopName}</div>
                  {address && <div className="text-[13px] text-white/85 drop-shadow">{address}</div>}
                </div>
              </div>
            ) : (
              <div key={k} className="relative shrink-0 w-full min-h-[260px] sm:min-h-[320px] grid sm:grid-cols-[1.1fr_1fr] items-center gap-4 px-6 sm:px-20 py-8 pb-12" aria-hidden={k !== idx}>
                <SlideContent slide={s} shopName={shopName} address={address} />
              </div>
            )
          )}
        </div>
      )}

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-navy-900 hover:scale-105 transition">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next slide" className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-navy-900 hover:scale-105 transition">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-2 rounded-full transition-all ${k === idx ? "w-6 bg-brand-600" : "w-2 bg-navy-900/20 hover:bg-navy-900/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SlideContent({ slide, shopName, address }: { slide: Slide; shopName: string; address: string | null }) {
  if (slide.kind === "shop") {
    return (
      <>
        <div className="relative">
          <span className="inline-flex px-3 py-1 rounded-full bg-white text-[12px] font-semibold text-brand-700 shadow-xs">Welcome</span>
          <h2 className="mt-3 text-[28px] sm:text-[40px] font-extrabold leading-[1.08] tracking-tight text-navy-900">Shop online at {shopName}</h2>
          {address && <p className="mt-3 text-[14px] sm:text-[15px] text-slate-600 max-w-md line-clamp-2">{address}</p>}
          <Link to="/portal/catalog" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-brand-600 text-white font-semibold shadow-brand hover:bg-brand-700 transition">
            Shop now <Arrow />
          </Link>
        </div>
        <div className="relative hidden sm:flex items-center justify-center h-full">
          {slide.products.length > 0 ? (
            <div className="relative w-full max-w-[340px] aspect-[4/3]">
              {slide.products.map((p, k) => (
                <img
                  key={p.id}
                  src={primaryImage(p) ?? undefined}
                  alt=""
                  className="absolute object-contain mix-blend-multiply drop-shadow-xl"
                  style={[{ left: "28%", top: "6%", width: "48%" }, { left: "0%", top: "34%", width: "40%" }, { right: "0%", top: "38%", width: "38%" }][k]}
                />
              ))}
            </div>
          ) : (
            <span className="w-40 h-40 rounded-[36px] bg-white/80 shadow-lg ring-1 ring-white flex items-center justify-center text-brand-600">
              <KindIcon kind="generic" className="w-20 h-20" />
            </span>
          )}
        </div>
      </>
    );
  }
  if (slide.kind === "banner") return null; // rendered full-bleed by BannerSlider
  const p = slide.product;
  const { price, mrp, off } = priceInfo(p);
  const img = primaryImage(p);
  return (
    <>
      <div className="relative">
        <span className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold shadow-xs ${slide.kind === "offer" ? "bg-rose-600 text-white" : "bg-white text-brand-700"}`}>
          {slide.kind === "offer" ? `Save ${off}% today` : "New arrival"}
        </span>
        <h2 className="mt-3 text-[26px] sm:text-[36px] font-extrabold leading-[1.1] tracking-tight text-navy-900 line-clamp-2">{p.name}</h2>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-[24px] sm:text-[28px] font-bold text-navy-900 tabular">{inr(price)}</span>
          {off > 0 && <span className="text-[15px] text-slate-400 line-through tabular">{inr(mrp)}</span>}
        </div>
        <Link to={`/portal/product/${p.id}`} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-brand-600 text-white font-semibold shadow-brand hover:bg-brand-700 transition">
          {slide.kind === "offer" ? "Grab the offer" : "View product"} <Arrow />
        </Link>
      </div>
      <div className="relative hidden sm:flex items-center justify-center h-full">
        <span className="relative w-full max-w-[300px] aspect-square rounded-full bg-white/70 ring-8 ring-white/60 shadow-xl overflow-hidden">
          {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-contain p-[14%] mix-blend-multiply" /> : <ProductPlaceholder name={p.name} category={p.category?.name} brand={p.brand} />}
        </span>
      </div>
    </>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function ProductRail({
  title,
  subtitle,
  to,
  rail,
  cardProps,
  hideWhenEmpty,
  accent,
}: {
  title: string;
  subtitle?: string;
  to: string;
  rail: Rail;
  cardProps: (p: Product) => { qty: number; updating: boolean; onQty: (q: number) => void };
  hideWhenEmpty?: boolean;
  accent?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!rail.loading && rail.items.length === 0) return hideWhenEmpty ? null : null;
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className={accent ? "rounded-3xl bg-gradient-to-br from-rose-50 via-orange-50/60 to-amber-50 ring-1 ring-orange-100 p-4 sm:p-6" : ""}>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-[20px] sm:text-[24px] font-bold tracking-tight text-navy-900">
            <span className={`w-1.5 h-6 rounded-full ${accent ? "bg-rose-500" : "bg-brand-600"}`} />
            {title}
          </h2>
          {subtitle && <p className="mt-1 ml-4 text-[13px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} className="hidden sm:flex w-9 h-9 rounded-full bg-white ring-1 ring-slate-200 items-center justify-center hover:ring-slate-300">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} className="hidden sm:flex w-9 h-9 rounded-full bg-white ring-1 ring-slate-200 items-center justify-center hover:ring-slate-300">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <Link to={to} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800 min-h-[36px] ml-1">View all <Arrow /></Link>
        </div>
      </div>
      <div ref={ref} className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(rail.loading ? Array.from({ length: 5 }) : rail.items).map((p: any, k) => (
          <div key={p?.id ?? k} className="snap-start shrink-0 w-[86%] min-[560px]:w-[48%] lg:w-[calc((100%-2*16px)/3)] xl:w-[calc((100%-3*16px)/4)]">
            {p ? <CatalogCard product={p} {...cardProps(p)} /> : <div className="h-[200px] rounded-2xl bg-white border border-border animate-pulse" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Fact({ title, sub, icon, tone, to, href }: { title: string; sub: string; icon: React.ReactNode; tone: "emerald" | "sky" | "violet" | "amber"; to?: string; href?: string }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    sky: "bg-sky-50 text-sky-600 ring-sky-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    amber: "bg-orange-50 text-orange-600 ring-orange-100",
  }[tone];
  const body = (
    <>
      <span className="w-11 h-11 rounded-xl bg-white/80 ring-1 ring-inherit flex items-center justify-center shrink-0">
        <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] sm:text-[14px] font-bold text-navy-900 leading-tight">{title}</span>
        <span className="block text-[12px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{sub}</span>
      </span>
    </>
  );
  const cls = `flex items-center gap-3 rounded-2xl p-3 sm:p-3.5 ring-1 ${tones} ${to || href ? "transition hover:-translate-y-0.5 hover:shadow-sm" : ""}`;
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (href) return <a href={href} className={cls}>{body}</a>;
  return <div className={cls}>{body}</div>;
}

function SectionHead({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <h2 className="flex items-center gap-2.5 text-[20px] sm:text-[24px] font-bold tracking-tight text-navy-900">
        <span className="w-1.5 h-6 rounded-full bg-brand-600" />
        {title}
      </h2>
      <Link to={to} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800 min-h-[36px]">View all <Arrow /></Link>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
      <span className="mx-auto w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><KindIcon kind="generic" className="w-8 h-8" /></span>
      <p className="mt-4 text-[16px] font-semibold text-navy-900">No products yet</p>
      <p className="mt-1 text-[13px] text-slate-500">This shop hasn't listed products online yet. Please check back soon.</p>
    </div>
  );
}

function Arrow() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
