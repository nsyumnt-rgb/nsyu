/**
 * Shrinks a photo in the browser before upload so phone pictures (often 4–12 MB)
 * become ~150–500 KB. Keeps aspect ratio; never upscales. GIFs are sent as-is
 * (re-encoding would drop animation). If anything fails, the original file is used.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
    if ("close" in bitmap && typeof (bitmap as ImageBitmap).close === "function") (bitmap as ImageBitmap).close();

    const blob = await toBlob(canvas, "image/webp", quality);
    const out = blob && blob.type === "image/webp" ? blob : await toBlob(canvas, "image/jpeg", quality);
    if (!out || out.size >= file.size) return file; // already small enough
    const ext = out.type === "image/webp" ? "webp" : "jpg";
    return new File([out], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: out.type });
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
