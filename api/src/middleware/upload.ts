import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

/**
 * Defense in depth: reject on BOTH the declared MIME type (which the
 * client sends and can lie about) AND the file extension (so a
 * ".php.jpg" or a mismatched extension/MIME pair can't sneak through
 * either check alone). Filenames are always rewritten to a fresh
 * UUID + the validated extension — the original filename is never
 * used for anything, which also rules out path traversal.
 */
function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF.`));
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Unsupported file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`));
  }
  cb(null, true);
}

export const productImageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 }, // up to 10 images per upload call
});

export function publicUrlFor(filename: string): string {
  return `/uploads/products/${filename}`;
}
