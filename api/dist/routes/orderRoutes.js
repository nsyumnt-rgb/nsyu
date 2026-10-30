"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const orderController_1 = require("../controllers/orderController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/stats", (0, permission_1.requirePermission)("orders", "view"), orderController_1.getOrderStats);
router.get("/", (0, permission_1.requirePermission)("orders", "view"), orderController_1.getOrders);
router.get("/:id", (0, permission_1.requirePermission)("orders", "view"), orderController_1.getOrderById);
router.post("/", (0, permission_1.requirePermission)("orders", "create"), orderController_1.createOrder);
router.put("/:id/status", (0, permission_1.requirePermission)("orders", "edit"), orderController_1.updateOrderStatus);
router.post("/:id/convert", (0, permission_1.requirePermission)("billing", "create"), orderController_1.convertOrderToBill);
exports.default = router;
//# sourceMappingURL=orderRoutes.js.map