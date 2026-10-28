"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const validate_1 = require("../middleware/validate");
const saleController_1 = require("../controllers/saleController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("sales", "view"), saleController_1.listSales);
router.get("/:saleId", (0, permission_1.requirePermission)("sales", "view"), saleController_1.getSale);
router.post("/", (0, permission_1.requirePermission)("sales", "create"), (0, validate_1.validate)(validate_1.createSaleRules), saleController_1.createSale);
router.post("/:saleId/payments", (0, permission_1.requirePermission)("billing", "create"), saleController_1.recordSalePayment);
router.post("/:saleId/cancel", (0, permission_1.requirePermission)("sales", "delete"), saleController_1.cancelSale);
router.post("/:saleId/returns", (0, permission_1.requirePermission)("sales", "edit"), saleController_1.returnSale);
router.get("/:saleId/bill/pdf", (0, permission_1.requirePermission)("billing", "view"), saleController_1.downloadBillPdf);
exports.default = router;
//# sourceMappingURL=saleRoutes.js.map