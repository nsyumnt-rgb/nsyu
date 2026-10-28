"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const purchaseController_1 = require("../controllers/purchaseController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("purchase", "view"), purchaseController_1.listPurchases);
router.get("/:purchaseId", (0, permission_1.requirePermission)("purchase", "view"), purchaseController_1.getPurchase);
router.post("/", (0, permission_1.requirePermission)("purchase", "create"), purchaseController_1.createPurchase);
router.post("/:purchaseId/payments", (0, permission_1.requirePermission)("purchase", "create"), purchaseController_1.recordPurchasePayment);
router.post("/:purchaseId/cancel", (0, permission_1.requirePermission)("purchase", "delete"), purchaseController_1.cancelPurchase);
router.post("/:purchaseId/returns", (0, permission_1.requirePermission)("purchase", "edit"), purchaseController_1.returnPurchase);
router.get("/:purchaseId/pdf", (0, permission_1.requirePermission)("purchase", "view"), purchaseController_1.downloadPurchasePdf);
exports.default = router;
//# sourceMappingURL=purchaseRoutes.js.map