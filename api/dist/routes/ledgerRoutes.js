"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const ledgerController_1 = require("../controllers/ledgerController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.get("/outstanding", (0, permission_1.requirePermission)("ledger", "view"), ledgerController_1.listOutstandingBalances);
router.get("/customer/:customerId", (0, permission_1.requirePermission)("ledger", "view"), ledgerController_1.getCustomerLedger);
router.get("/:customerId", (0, permission_1.requirePermission)("ledger", "view"), ledgerController_1.getCustomerLedger);
exports.default = router;
//# sourceMappingURL=ledgerRoutes.js.map