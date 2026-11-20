import { useEffect, useRef, useState } from "react";
import { deleteShopBanner, getShop, listShops, uploadShopBanner } from "../api/shops";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { ACCEPTED_IMAGE_TYPES, shrinkImage } from "../utils/imageResize";
import { Icon } from "./ui";

/**
 * Storefront banner for the active shop. Shown at the top of the customer
 * store (portal) and the shop's marketplace page.
 */
export default function ShopBannerCard() {
  const rawShopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const accountType = useAuthStore((s) => s.accountType);
  const owner = useAuthStore((s) => s.owner);
  const isOwner = accountType === "owner" || accountType === "super_admin" || Boolean(owner);

  const shopId = rawShopId || activeShop?.id || null;
  const inputRef = useRef<HTMLInputElement>(null);

  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchBanner() {
      setLoading(true);
      setError(null);

      let targetShopId = shopId;
      if (!targetShopId) {
        try {
          const listRes = await listShops();
          const first = listRes.data.data?.[0];
          if (first && active) {
            setActiveShop(first);
            targetShopId = first.id;
          }
        } catch {
          // ignore error
        }
      }

      if (!targetShopId) {
        if (active) setLoading(false);
        return;
      }

      try {
        const res = await getShop(targetShopId);
        if (active) {
          const bUrl = ((res.data.data as any)?.settings?.bannerUrl as string) || null;
          setBanner(bUrl);
        }
      } catch {
        if (active) setBanner(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchBanner();

    return () => {
      active = false;
    };
  }, [shopId, setActiveShop]);

  async function upload(file?: File) {
    if (!file) return;
    const targetShopId = shopId || activeShop?.id;
    if (!targetShopId) {
      setError("Please select or register a shop before uploading a banner.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPG, PNG, WEBP or GIF image.");
      return;
    }

    setError(null);
    setDone(null);
    setBusy("Uploading banner…");
    try {
      const small = await shrinkImage(file, 2400, 0.85);
      const res = await uploadShopBanner(targetShopId, small);
      const url = res.data.data?.bannerUrl || null;
      setBanner(url);
      if (activeShop && res.data.data?.shop) {
        setActiveShop({ ...activeShop, settings: res.data.data.shop.settings });
      }
      setDone("Banner updated successfully — customers see it on your store now!");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not upload the banner"));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    const targetShopId = shopId || activeShop?.id;
    if (!targetShopId || !confirm("Remove the store banner?")) return;
    setError(null);
    setDone(null);
    setBusy("Removing…");
    try {
      const res = await deleteShopBanner(targetShopId);
      setBanner(null);
      if (activeShop && res.data.data?.shop) {
        setActiveShop({ ...activeShop, settings: res.data.data.shop.settings });
      }
      setDone("Banner removed.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove the banner"));
    } finally {
      setBusy(null);
    }
  }

  const src = resolveAssetUrl(banner);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
            🖼️
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Store Banner</h2>
            <p className="text-xs text-slate-500">
              Top of your customer store and marketplace page{activeShop?.name ? ` · ${activeShop.name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!isOwner || !!busy}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Icon name="upload" className="w-3.5 h-3.5" />
            <span>{src ? "Change Banner" : "Upload Banner"}</span>
          </button>
          {src && isOwner && (
            <button
              type="button"
              onClick={remove}
              disabled={!!busy}
              className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Banner Upload / Preview Box */}
      <div
        onDragOver={(e) => {
          if (!isOwner) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (!isOwner) return;
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (isOwner && !busy) inputRef.current?.click();
        }}
        className={`group relative aspect-[3/1] max-h-64 w-full rounded-2xl overflow-hidden cursor-pointer transition-all ${
          src ? "bg-slate-900 ring-1 ring-slate-200" : "border-2 border-dashed bg-slate-50/60"
        } ${drag ? "border-emerald-500 ring-4 ring-emerald-500/10" : "border-slate-300 hover:border-emerald-500"}`}
      >
        {loading ? (
          <div className="absolute inset-0 animate-pulse bg-slate-100 flex items-center justify-center text-xs text-slate-400">
            Loading banner…
          </div>
        ) : src ? (
          <>
            <img src={src} alt="Store banner" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white text-xs font-semibold">
              <span className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-base">
                📷
              </span>
              <span>Click or drop image to replace banner</span>
              <span className="text-[11px] text-white/80">Recommended size: 1500 × 500 px</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition-transform">
              🖼️
            </span>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {isOwner ? "Upload Store Banner" : "No banner uploaded yet"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwner
                  ? "Click to browse or drag & drop image here (1500 × 500 px recommended)"
                  : "Only the shop owner can upload a banner."}
              </p>
            </div>
            {isOwner && (
              <span className="mt-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                Select Image (JPG, PNG, WEBP, GIF up to 8 MB)
              </span>
            )}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-2.5 text-xs font-bold text-emerald-800 z-10">
            <span className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <span>{busy}</span>
          </div>
        )}
      </div>

      {/* Status Notifications */}
      <div className="min-h-[20px] text-xs">
        {error ? (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
            <Icon name="alert" className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : done ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
            <Icon name="checkCircle" className="w-4 h-4 shrink-0" />
            <span>{done}</span>
          </div>
        ) : (
          <p className="text-[11.5px] text-slate-500 flex items-center justify-between">
            <span>Wide banner image appears on the Customer Portal and Marketplace storefront.</span>
            <span>Max 8 MB · Resized automatically</span>
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </section>
  );
}
