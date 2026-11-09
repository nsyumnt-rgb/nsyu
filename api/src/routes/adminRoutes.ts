import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../middleware/auth";
import {
  getAdminDashboard,
  getAdminShops,
  createAdminShop,
  updateAdminShop,
  toggleAdminShopStatus,
  getAdminOwners,
  createAdminOwner,
  resetAdminOwnerPassword,
  toggleAdminOwnerStatus,
  getAdminAuditLogs,
  getAdminShopSupportData,
} from "../controllers/adminController";

const router = Router();

// Strictly authenticate and require Super Admin role on all admin routes
router.use(authenticate);
router.use(requireSuperAdmin);

// Platform Dashboard
router.get("/dashboard", getAdminDashboard);

// Shop Management
router.get("/shops", getAdminShops);
router.post("/shops", createAdminShop);
router.put("/shops/:id", updateAdminShop);
router.patch("/shops/:id/status", toggleAdminShopStatus);

// Owner Management
router.get("/owners", getAdminOwners);
router.post("/owners", createAdminOwner);
router.patch("/owners/:id/password", resetAdminOwnerPassword);
router.patch("/owners/:id/status", toggleAdminOwnerStatus);

// Platform Audit Log
router.get("/audit-logs", getAdminAuditLogs);

// Read-only Shop Data Viewer for Support
router.get("/shops/:id/data", getAdminShopSupportData);

export default router;
