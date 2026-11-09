"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
// Strictly authenticate and require Super Admin role on all admin routes
router.use(auth_1.authenticate);
router.use(auth_1.requireSuperAdmin);
// Platform Dashboard
router.get("/dashboard", adminController_1.getAdminDashboard);
// Shop Management
router.get("/shops", adminController_1.getAdminShops);
router.post("/shops", adminController_1.createAdminShop);
router.put("/shops/:id", adminController_1.updateAdminShop);
router.patch("/shops/:id/status", adminController_1.toggleAdminShopStatus);
// Owner Management
router.get("/owners", adminController_1.getAdminOwners);
router.post("/owners", adminController_1.createAdminOwner);
router.patch("/owners/:id/password", adminController_1.resetAdminOwnerPassword);
router.patch("/owners/:id/status", adminController_1.toggleAdminOwnerStatus);
// Platform Audit Log
router.get("/audit-logs", adminController_1.getAdminAuditLogs);
// Read-only Shop Data Viewer for Support
router.get("/shops/:id/data", adminController_1.getAdminShopSupportData);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map