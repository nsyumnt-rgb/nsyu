"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const orderController_1 = require("../controllers/orderController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", orderController_1.getOrders);
router.get("/:id", orderController_1.getOrderById);
router.post("/", orderController_1.createOrder);
router.put("/:id/status", orderController_1.updateOrderStatus);
router.post("/:id/convert", orderController_1.convertOrderToBill);
exports.default = router;
//# sourceMappingURL=orderRoutes.js.map