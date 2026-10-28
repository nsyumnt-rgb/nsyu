"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const paymentController_1 = require("../controllers/paymentController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("payments", "view"), paymentController_1.listPayments);
router.get("/:paymentId", (0, permission_1.requirePermission)("payments", "view"), paymentController_1.getPayment);
router.post("/:paymentId/cancel", (0, permission_1.requirePermission)("payments", "delete"), paymentController_1.cancelPayment);
router.get("/:paymentId/receipt/pdf", (0, permission_1.requirePermission)("payments", "view"), paymentController_1.downloadReceiptPdf);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map