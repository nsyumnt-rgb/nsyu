"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const customerController_1 = require("../controllers/customerController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("customers", "view"), customerController_1.listCustomers);
router.get("/:customerId", (0, permission_1.requirePermission)("customers", "view"), customerController_1.getCustomer);
router.post("/", (0, permission_1.requirePermission)("customers", "create"), customerController_1.createCustomer);
router.put("/:customerId", (0, permission_1.requirePermission)("customers", "edit"), customerController_1.updateCustomer);
exports.default = router;
//# sourceMappingURL=customerRoutes.js.map