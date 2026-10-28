"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const supplierLedgerController_1 = require("../controllers/supplierLedgerController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/outstanding", (0, permission_1.requirePermission)("suppliers", "view"), supplierLedgerController_1.listSupplierOutstanding);
router.get("/payments", (0, permission_1.requirePermission)("suppliers", "view"), supplierLedgerController_1.listSupplierPayments);
router.get("/:supplierId", (0, permission_1.requirePermission)("suppliers", "view"), supplierLedgerController_1.getSupplierLedger);
exports.default = router;
//# sourceMappingURL=supplierLedgerRoutes.js.map