"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const shopRoutes_1 = __importDefault(require("./routes/shopRoutes"));
const roleRoutes_1 = __importDefault(require("./routes/roleRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const supplierRoutes_1 = __importDefault(require("./routes/supplierRoutes"));
const inventoryRoutes_1 = __importDefault(require("./routes/inventoryRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const saleRoutes_1 = __importDefault(require("./routes/saleRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const ledgerRoutes_1 = __importDefault(require("./routes/ledgerRoutes"));
const emiRoutes_1 = __importDefault(require("./routes/emiRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const leaveRoutes_1 = __importDefault(require("./routes/leaveRoutes"));
const payrollRoutes_1 = __importDefault(require("./routes/payrollRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const supplierLedgerRoutes_1 = __importDefault(require("./routes/supplierLedgerRoutes"));
const referenceRoutes_1 = __importDefault(require("./routes/referenceRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const activityRoutes_1 = __importDefault(require("./routes/activityRoutes"));
const backupRoutes_1 = __importDefault(require("./routes/backupRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const models_1 = require("./models");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false })); // allow <img> tags to load /uploads from the frontend's origin
const allowedOrigins = [
    "https://nsyumnt-rgb.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : [])
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Mobile apps and curl/server-to-server requests have no origin
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("CORS not allowed for this origin"));
        }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express_1.default.json());
if (process.env.NODE_ENV !== "test") {
    app.use((0, morgan_1.default)("dev")); // quiet during automated tests (see tests/env.ts) — keeps CI output readable
}
// Serves product images uploaded via multer (see middleware/upload.ts)
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "..", "uploads")));
app.get(["/", "/api", "/health", "/api/health"], async (_req, res) => {
    try {
        await models_1.sequelize.authenticate();
        return res.json({
            success: true,
            message: "NSYU Business API is running",
            status: "connected",
        });
    }
    catch (err) {
        console.error("Database health check failed:", err.message);
        return res.status(503).json({
            success: false,
            message: "Database service unavailable",
            status: "disconnected",
        });
    }
});
app.use("/api/auth", authRoutes_1.default);
app.use("/api/shops", shopRoutes_1.default);
app.use("/api/roles", roleRoutes_1.default);
app.use("/api/employees", employeeRoutes_1.default);
app.use("/api/products", productRoutes_1.default);
app.use("/api/categories", categoryRoutes_1.default);
app.use("/api/suppliers", supplierRoutes_1.default);
app.use("/api/inventory", inventoryRoutes_1.default);
app.use("/api/customers", customerRoutes_1.default);
app.use("/api/sales", saleRoutes_1.default);
app.use("/api/payments", paymentRoutes_1.default);
app.use("/api/ledger", ledgerRoutes_1.default);
app.use("/api/emi", emiRoutes_1.default);
app.use("/api/attendance", attendanceRoutes_1.default);
app.use("/api/leave", leaveRoutes_1.default);
app.use("/api/payroll", payrollRoutes_1.default);
app.use("/api/notifications", notificationRoutes_1.default);
app.use("/api/reports", reportRoutes_1.default);
app.use("/api/purchases", purchaseRoutes_1.default);
app.use("/api/supplier-ledger", supplierLedgerRoutes_1.default);
app.use("/api/reference", referenceRoutes_1.default);
app.use("/api/orders", orderRoutes_1.default);
app.use("/api/activity", activityRoutes_1.default);
app.use("/api/backup", backupRoutes_1.default);
app.use("/api/settings", settingsRoutes_1.default);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map