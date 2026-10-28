import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/authRoutes";
import shopRoutes from "./routes/shopRoutes";
import roleRoutes from "./routes/roleRoutes";
import employeeRoutes from "./routes/employeeRoutes";
import productRoutes from "./routes/productRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import supplierRoutes from "./routes/supplierRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import customerRoutes from "./routes/customerRoutes";
import saleRoutes from "./routes/saleRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import emiRoutes from "./routes/emiRoutes";
import attendanceRoutes from "./routes/attendanceRoutes";
import leaveRoutes from "./routes/leaveRoutes";
import payrollRoutes from "./routes/payrollRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import reportRoutes from "./routes/reportRoutes";
import purchaseRoutes from "./routes/purchaseRoutes";
import supplierLedgerRoutes from "./routes/supplierLedgerRoutes";
import referenceRoutes from "./routes/referenceRoutes";
import orderRoutes from "./routes/orderRoutes";
import activityRoutes from "./routes/activityRoutes";
import backupRoutes from "./routes/backupRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { sequelize } from "./models";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow <img> tags to load /uploads from the frontend's origin

// Enable Private Network Access & CORS for GitHub Pages (https://nsyumnt-rgb.github.io) & local dev
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network");
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev")); // quiet during automated tests (see tests/env.ts) — keeps CI output readable
}

// Serves product images uploaded via multer (see middleware/upload.ts)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get(["/", "/api", "/health", "/api/health"], async (_req, res) => {
  try {
    await sequelize.authenticate();
    return res.json({
      success: true,
      message: "NSYU Business API is running",
      status: "connected",
      database: "Supabase PostgreSQL",
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || "postgres",
    });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      message: "Database connection failed",
      status: "disconnected",
      error: err.message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/emi", emiRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/supplier-ledger", supplierLedgerRoutes);
app.use("/api/reference", referenceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/settings", settingsRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

export default app;
