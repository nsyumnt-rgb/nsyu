import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Where uploaded images (product photos, shop banners) are kept.
 *
 * Production runs on Render's free plan, whose disk is wiped on every
 * restart/deploy, so files must live in Supabase Storage there. Configure:
 *   SUPABASE_URL               https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key (server-side only, never sent to browsers)
 *   SUPABASE_STORAGE_BUCKET    public bucket name (default "nsyu-media")
 *
 * Without that config, dev/test fall back to the local ./uploads folder, while
 * production refuses uploads with a clear error instead of saving files that
 * would silently disappear.
 */

const LOCAL_ROOT = path.join(__dirname, "..", "..", "uploads");

export class StorageNotConfiguredError extends Error {
  status = 503;
  constructor() {
    super("Image storage is not configured on the server. Ask the platform admin to set up Supabase Storage.");
  }
}

export class InvalidImageError extends Error {
  status = 400;
}

function cfg() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "nsyu-media";
  return { url, key, bucket, enabled: Boolean(url && key) };
}

export function storageMode(): "supabase" | "local" | "disabled" {
  if (cfg().enabled) return "supabase";
  return process.env.NODE_ENV === "production" ? "disabled" : "local";
}

/** Detect the real image type from the first bytes; never trust the filename or declared MIME alone. */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString("latin1"))) return { ext: "gif", mime: "image/gif" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/**
 * Stores one image and returns its public URL.
 * `folder` is a server-built path such as "owners/3/products/12" — never user input.
 */
export async function saveImage(file: { buffer: Buffer }, folder: string): Promise<string> {
  const kind = sniffImage(file.buffer);
  if (!kind) throw new InvalidImageError("That file isn't a JPG, PNG, WEBP or GIF image.");

  const name = `${uuidv4()}.${kind.ext}`;
  const objectPath = `${folder.replace(/^\/+|\/+$/g, "")}/${name}`;
  const mode = storageMode();

  if (mode === "disabled") throw new StorageNotConfiguredError();

  if (mode === "local") {
    const dir = path.join(LOCAL_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), file.buffer);
    return `/uploads/${objectPath}`;
  }

  const { url, key, bucket } = cfg();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": kind.mime,
      "Cache-Control": "max-age=31536000",
      "x-upsert": "false",
    },
    body: new Uint8Array(file.buffer),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image upload to storage failed (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** Best-effort removal of a previously stored image (Supabase object or local file). Never throws. */
export async function removeImage(publicUrl?: string | null): Promise<void> {
  if (!publicUrl) return;
  try {
    const { url, key, bucket, enabled } = cfg();
    const prefix = `${url}/storage/v1/object/public/${bucket}/`;
    if (enabled && publicUrl.startsWith(prefix)) {
      const objectPath = decodeURIComponent(publicUrl.slice(prefix.length));
      await fetch(`${url}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [objectPath] }),
      });
      return;
    }
    if (publicUrl.startsWith("/uploads/")) {
      const rel = path.normalize(publicUrl.slice("/uploads/".length));
      if (rel.startsWith("..") || path.isAbsolute(rel)) return; // never leave the uploads folder
      fs.unlink(path.join(LOCAL_ROOT, rel), () => {});
    }
  } catch {
    /* cleanup is best-effort */
  }
}
