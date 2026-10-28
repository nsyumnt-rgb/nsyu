"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const inventoryController_1 = require("../controllers/inventoryController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
router.post("/movement", (0, permission_1.requirePermission)("inventory", "create"), inventoryController_1.recordMovement);
router.get("/movement/:movementId", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.getMovement);
router.get("/movements/:movementId", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.getMovement);
router.get("/history", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.getInventoryHistory);
router.get("/stock/:productId", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.getProductStockOverview);
// Transfers
router.get("/transfers", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.listTransfers);
router.get("/transfers/:transferId", (0, permission_1.requirePermission)("inventory", "view"), inventoryController_1.getTransfer);
router.post("/transfer", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.transferStock);
router.post("/transfers", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.transferStock);
router.put("/transfer/:id/dispatch", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.dispatchTransfer);
router.put("/transfers/:id/dispatch", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.dispatchTransfer);
router.put("/transfer/:id/receive", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.receiveTransfer);
router.put("/transfers/:id/receive", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.receiveTransfer);
router.put("/transfer/:id/cancel", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.cancelTransfer);
router.put("/transfers/:id/cancel", (0, permission_1.requirePermission)("inventory", "edit"), inventoryController_1.cancelTransfer);
exports.default = router;
//# sourceMappingURL=inventoryRoutes.js.map