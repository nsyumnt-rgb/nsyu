import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ success: false, message: "Record already exists", errors: err.errors });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ success: false, message: "Validation failed", errors: err.errors });
  }
  // Upload problems (multer): file too large, too many files, or a rejected type.
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That image is too large. Use a smaller photo (max 5 MB, banners 8 MB)."
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? "Too many files in one upload."
        : err.message;
    return res.status(400).json({ success: false, message });
  }
  if (typeof err.message === "string" && /^Unsupported (image type|file extension)/.test(err.message)) {
    return res.status(400).json({ success: false, message: err.message });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
}
