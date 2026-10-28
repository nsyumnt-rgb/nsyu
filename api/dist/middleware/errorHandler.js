"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    console.error(err);
    if (err.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Record already exists", errors: err.errors });
    }
    if (err.name === "SequelizeValidationError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: err.errors });
    }
    return res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error",
    });
}
//# sourceMappingURL=errorHandler.js.map