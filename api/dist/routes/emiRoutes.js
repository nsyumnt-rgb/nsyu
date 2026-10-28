"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const emiController_1 = require("../controllers/emiController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("emi", "view"), emiController_1.listEmiPlans);
router.get("/due", (0, permission_1.requirePermission)("emi", "view"), emiController_1.listDueInstallments);
router.get("/:planId", (0, permission_1.requirePermission)("emi", "view"), emiController_1.getEmiPlan);
router.get("/plans/:planId", (0, permission_1.requirePermission)("emi", "view"), emiController_1.getEmiPlan);
router.post("/:planId/cancel", (0, permission_1.requirePermission)("emi", "delete"), emiController_1.cancelEmiPlan);
router.post("/installments/:installmentId/pay", (0, permission_1.requirePermission)("emi", "create"), emiController_1.payInstallment);
exports.default = router;
//# sourceMappingURL=emiRoutes.js.map