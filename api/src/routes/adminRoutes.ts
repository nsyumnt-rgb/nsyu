import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../middleware/auth";
import { productImageUpload } from "../middleware/upload";
import {
  getAdminDashboard,
  getAdminShops,
  createAdminShop,
  updateAdminShop,
  toggleAdminShopStatus,
  approveAdminShop,
  rejectAdminShop,
  getAdminOwners,
  createAdminOwner,
  resetAdminOwnerPassword,
  toggleAdminOwnerStatus,
  getAdminAuditLogs,
  getAdminShopSupportData,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  uploadAdminCategoryImage,
  getAdminNotifications,
  broadcastAdminNotification,
} from "../controllers/adminController";

const router = Router();

// Strictly authenticate and require Super Admin role on all admin routes
router.use(authenticate);
router.use(requireSuperAdmin);

// Platform Dashboard
router.get("/dashboard", getAdminDashboard);

// Shop Management & Approval Process
router.get("/shops", getAdminShops);
router.post("/shops", createAdminShop);
router.put("/shops/:id", updateAdminShop);
router.patch("/shops/:id/status", toggleAdminShopStatus);
router.post("/shops/:id/approve", approveAdminShop);
router.post("/shops/:id/reject", rejectAdminShop);

// Owner Management
router.get("/owners", getAdminOwners);
router.post("/owners", createAdminOwner);
router.patch("/owners/:id/password", resetAdminOwnerPassword);
router.patch("/owners/:id/status", toggleAdminOwnerStatus);

// Master Platform Categories Management
router.get("/categories", getAdminCategories);
router.post("/categories", createAdminCategory);
router.put("/categories/:id", updateAdminCategory);
router.delete("/categories/:id", deleteAdminCategory);
router.post("/categories/:id/image", productImageUpload.single("image"), uploadAdminCategoryImage);

// Platform Notifications & Broadcasts
router.get("/notifications", getAdminNotifications);
router.post("/notifications/broadcast", broadcastAdminNotification);

// Platform Audit Log
router.get("/audit-logs", getAdminAuditLogs);

// Read-only Shop Data Viewer for Support
router.get("/shops/:id/data", getAdminShopSupportData);

export default router;


