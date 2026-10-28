"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const validate_1 = require("../middleware/validate");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop, (0, permission_1.requirePermission)("reports", "view"), (0, validate_1.validate)(validate_1.dateRangeQueryRules));
// All support ?from=&to=&shopId= (shopId is owner-only — employees are always pinned to their own shop)
router.get("/sales", reportController_1.salesReport);
router.get("/purchase", reportController_1.purchaseReport);
router.get("/inventory", reportController_1.inventoryReport);
router.get("/profit", reportController_1.profitReport);
router.get("/customer-outstanding", reportController_1.customerOutstandingReport);
router.get("/supplier-outstanding", reportController_1.supplierOutstandingReport);
router.get("/emi", reportController_1.emiReport);
router.get("/payments", reportController_1.paymentsReport);
router.get("/shop-performance", reportController_1.shopPerformanceReport);
router.get("/product-performance", reportController_1.productPerformanceReport);
router.get("/attendance", reportController_1.attendanceReport);
router.get("/salary", reportController_1.salaryReport);
router.get("/payroll", reportController_1.payrollReport);
router.get("/advances", reportController_1.advanceReport);
exports.default = router;
//# sourceMappingURL=reportRoutes.js.map