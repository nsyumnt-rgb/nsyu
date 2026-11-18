import { useEffect, useRef, useState } from "react";
import { deleteShopBanner, getShop, uploadShopBanner } from "../api/shops";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { ACCEPTED_IMAGE_TYPES, shrinkImage } from "../utils/imageResize";
import { Icon } from "./ui";

/**
 * Storefront banner for the active shop. Shown at the top of the customer
 * store (portal) and the shop's marketplace page. Owner-only on the server.
 */
export default function ShopBannerCard() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const isOwner = useAuthStore((s) => s.accountType === "owner");
  const inputRef = useRef<HTMLInputElement>(null);

  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    getShop(shopId)
      .then((r) => setBanner(((r.data.data as any)?.settings?.bannerUrl as string) || null))
      .catch(() => setBanner(null))
      .finally(() => setLoading(false));
  }, [shopId]);

  async function upload(file?: File) {
    if (!file || !shopId) return;
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG, WEBP or GIF image.");
    setError(null);
    setDone(null);
    setBusy("Uploading banner…");
    try {
      const small = await shrinkImage(file, 2400, 0.85);
      const res = await uploadShopBanner(shopId, small);
      const url = res.data.data?.bannerUrl || null;
      setBanner(url);
      if (activeShop && res.data.data?.shop) setActiveShop({ ...activeShop, settings: res.data.data.shop.settings });
      setDone("Banner updated — customers see it on your store now.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not upload the banner"));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!shopId || !confirm("Remove the store banner?")) return;
    setError(null);
    setDone(null);
    setBusy("Removing…");
    try {
      const res = await deleteShopBanner(shopId);
      setBanner(null);
      if (activeShop && res.data.data?.shop) setActiveShop({ ...activeShop, settings: res.data.data.shop.settings });
      setDone("Banner removed.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove the banner"));
    } finally {
      setBusy(null);
    }
  }

  const src = resolveAssetUrl(banner);

  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center">
            <Icon name="layers" className="w-4 h-4" />
          </span>
          <div>
            <h2 className="card-title text-[14px]">Store banner</h2>
            <p className="text-[12px] text-slate-500">Top of your customer store and marketplace page{activeShop?.name ? ` · ${activeShop.name}` : ""}</p>
          </div>
        </div>
        {src && isOwner && (
          <div className="flex gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} className="btn-secondary btn-sm">
              <Icon name="refresh" className="w-3.5 h-3.5" /> Replace
            </button>
            <button type="button" onClick={remove} disabled={!!busy} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">
              <Icon name="trash" className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
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
          className={`relative aspect-[3/1] max-h-64 w-full rounded-xl overflow-hidden ${src ? "bg-slate-100" : "border-2 border-dashed"} ${drag ? "border-brand-500 ring-4 ring-brand-500/10" : "border-slate-300"}`}
        >
          {loading ? (
            <div className="absolute inset-0 animate-pulse bg-slate-100" />
          ) : src ? (
            <img src={src} alt="Store banner" className="w-full h-full object-cover" />
          ) : (
            <button
              type="button"
              disabled={!isOwner || !!busy}
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50/40 transition disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
            >
              <Icon name="upload" className="w-6 h-6" />
              <span className="text-[13px] font-semibold">{isOwner ? "Upload a banner" : "No banner yet"}</span>
              {isOwner && <span className="text-[11.5px] text-slate-400">Wide image, about 1500 × 500 px · or drop it here</span>}
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2 text-[13px] font-medium text-brand-700">
              <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /> {busy}
            </div>
          )}
        </div>
        <div className="mt-2 min-h-[18px] text-[12px]">
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {error}</span>
          ) : done ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700"><Icon name="checkCircle" className="w-3.5 h-3.5" /> {done}</span>
          ) : !isOwner ? (
            <span className="text-slate-400">Only the shop owner can change the banner.</span>
          ) : (
            <span className="text-slate-400">JPG, PNG, WEBP or GIF · up to 8 MB · it's resized automatically</span>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </section>
  );
}
