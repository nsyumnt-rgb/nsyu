"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const supplierController_1 = require("../controllers/supplierController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", (0, permission_1.requirePermission)("suppliers", "view"), supplierController_1.listSuppliers);
router.get("/:supplierId", (0, permission_1.requirePermission)("suppliers", "view"), supplierController_1.getSupplier);
router.post("/", (0, permission_1.requirePermission)("suppliers", "create"), supplierController_1.createSupplier);
router.put("/:supplierId", (0, permission_1.requirePermission)("suppliers", "edit"), supplierController_1.updateSupplier);
router.patch("/:supplierId/status", (0, permission_1.requirePermission)("suppliers", "edit"), supplierController_1.setSupplierStatus);
exports.default = router;
//# sourceMappingURL=supplierRoutes.js.map