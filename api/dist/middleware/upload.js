"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageUpload = void 0;
exports.publicUrlFor = publicUrlFor;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const UPLOAD_DIR = path_1.default.join(__dirname, "..", "..", "uploads", "products");
fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
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
function fileFilter(_req, file, cb) {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF.`));
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Unsupported file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`));
    }
    cb(null, true);
}
exports.productImageUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 }, // up to 10 images per upload call
});
function publicUrlFor(filename) {
    return `/uploads/products/${filename}`;
}
//# sourceMappingURL=upload.js.map