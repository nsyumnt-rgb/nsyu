import { useRef, useState } from "react";
import { deleteProductImage, replaceProductImage, setPrimaryProductImage, uploadProductImages } from "../api/products";
import { apiErrorMessage, resolveAssetUrl } from "../api/client";
import type { ProductImage } from "../types";
import { ACCEPTED_IMAGE_TYPES, shrinkImage } from "../utils/imageResize";
import { Icon } from "./ui";

const MAX_PHOTOS = 8;

/**
 * Photo manager for one product: add (multi-select or drag & drop), set the
 * cover photo, replace and delete. Photos are shrunk in the browser first.
 */
export default function ProductPhotos({
  productId,
  images,
  onChange,
  canEdit = true,
  compact = false,
}: {
  productId: number;
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  canEdit?: boolean;
  compact?: boolean;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const sorted = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id);
  const room = MAX_PHOTOS - images.length;

  async function add(list: FileList | File[] | null) {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setError(null);
    if (files.length > room) {
      setError(room > 0 ? `You can add ${room} more photo${room === 1 ? "" : "s"} (max ${MAX_PHOTOS}).` : `This product already has ${MAX_PHOTOS} photos.`);
      return;
    }
    setBusy(`Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`);
    try {
      const small = await Promise.all(files.map((f) => shrinkImage(f)));
      const res = await uploadProductImages(productId, small);
      onChange([...images, ...(res.data.data ?? [])]);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not upload the photo"));
    } finally {
      setBusy(null);
      if (addRef.current) addRef.current.value = "";
    }
  }

  async function replace(file: File | undefined) {
    if (!file || replacing === null) return;
    setError(null);
    setBusy("Replacing photo…");
    try {
      const res = await replaceProductImage(replacing, await shrinkImage(file));
      const updated = res.data.data;
      if (updated) onChange(images.map((im) => (im.id === updated.id ? { ...im, url: updated.url } : im)));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not replace the photo"));
    } finally {
      setBusy(null);
      setReplacing(null);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  async function makeCover(im: ProductImage) {
    setError(null);
    setBusy("Updating cover…");
    try {
      await setPrimaryProductImage(im.id);
      onChange(images.map((x) => ({ ...x, is_primary: x.id === im.id })));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not set the cover photo"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(im: ProductImage) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setError(null);
    setBusy("Deleting…");
    try {
      await deleteProductImage(im.id);
      const rest = images.filter((x) => x.id !== im.id);
      // Mirror the server: promote the next photo when the cover is deleted.
      if (im.is_primary && rest.length && !rest.some((x) => x.is_primary)) {
        const next = [...rest].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)[0];
        onChange(rest.map((x) => ({ ...x, is_primary: x.id === next.id })));
      } else onChange(rest);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not delete the photo"));
    } finally {
      setBusy(null);
    }
  }

  const tile = compact ? "w-20 h-20" : "w-28 h-28 sm:w-32 sm:h-32";

  return (
    <div
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDrag(false);
        add(e.dataTransfer.files);
      }}
      className={`rounded-xl transition ${drag ? "ring-2 ring-brand-500 bg-brand-50/50" : ""}`}
    >
      <div className="flex flex-wrap gap-3">
        {sorted.map((im) => (
          <div key={im.id} className={`group relative ${tile} rounded-xl overflow-hidden bg-slate-100 ring-1 ${im.is_primary ? "ring-2 ring-brand-500" : "ring-border"}`}>
            <img src={resolveAssetUrl(im.url) || ""} alt="" className="w-full h-full object-cover" loading="lazy" />
            {im.is_primary && <span className="absolute left-1.5 top-1.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">Cover</span>}
            {canEdit && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
                {!im.is_primary && (
                  <TileBtn title="Make cover photo" disabled={!!busy} onClick={() => makeCover(im)}>
                    <Icon name="checkCircle" className="w-3.5 h-3.5" />
                  </TileBtn>
                )}
                <TileBtn
                  title="Replace photo"
                  disabled={!!busy}
                  onClick={() => {
                    setReplacing(im.id);
                    replaceRef.current?.click();
                  }}
                >
                  <Icon name="refresh" className="w-3.5 h-3.5" />
                </TileBtn>
                <TileBtn title="Delete photo" disabled={!!busy} onClick={() => remove(im)} danger>
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </TileBtn>
              </div>
            )}
          </div>
        ))}

        {canEdit && room > 0 && (
          <button
            type="button"
            onClick={() => addRef.current?.click()}
            disabled={!!busy}
            className={`${tile} rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 text-slate-500 hover:text-brand-700 flex flex-col items-center justify-center gap-1 transition disabled:opacity-50`}
          >
            <Icon name="plus" className="w-5 h-5" />
            <span className="text-[11.5px] font-semibold">Add photo</span>
            {!compact && <span className="text-[10.5px] text-slate-400">or drop here</span>}
          </button>
        )}

        {!canEdit && sorted.length === 0 && <div className="text-[12.5px] text-slate-400">No photos yet.</div>}
      </div>

      <div className="mt-2 min-h-[18px] text-[12px]">
        {busy ? (
          <span className="inline-flex items-center gap-2 text-brand-700 font-medium">
            <span className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /> {busy}
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-1.5 text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {error}</span>
        ) : canEdit ? (
          <span className="text-slate-400">JPG, PNG, WEBP or GIF · up to {MAX_PHOTOS} photos · the cover photo shows in lists and the store</span>
        ) : null}
      </div>

      <input ref={addRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <input ref={replaceRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => replace(e.target.files?.[0])} />
    </div>
  );
}

function TileBtn({ title, onClick, disabled, danger, children }: { title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/90 shadow-sm disabled:opacity-50 ${danger ? "text-rose-600 hover:bg-rose-50" : "text-navy-900 hover:bg-white"}`}
    >
      {children}
    </button>
  );
}
