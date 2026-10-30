"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const productController_1 = require("../controllers/productController");
const models_1 = require("../models");
const inventoryController_1 = require("../controllers/inventoryController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
// Products CRUD under /api/inventory
router.get("/products", (0, permission_1.requirePermission)("products", "view"), productController_1.listProductsOwnerView);
router.get("/products/:productId", (0, permission_1.requirePermission)("products", "view"), productController_1.getProductOwnerView);
router.post("/products", (0, permission_1.requirePermission)("products", "create"), productController_1.createProduct);
router.put("/products/:productId", (0, permission_1.requirePermission)("products", "edit"), productController_1.updateProduct);
router.patch("/products/:productId/status", (0, permission_1.requirePermission)("products", "edit"), productController_1.updateProduct);
// Dropdown Metadata
router.get("/categories", async (req, res) => {
    try {
        const list = await models_1.Category.findAll({ where: { status: "active" } });
        const names = list.map((c) => c.name);
        return res.json({ success: true, data: names.length > 0 ? names : ["Mobile Accessories", "Chargers", "Cables", "Stationery", "Others"] });
    }
    catch (_) {
        return res.json({ success: true, data: ["Mobile Accessories", "Chargers", "Cables", "Stationery", "Others"] });
    }
});
router.get("/brands", (req, res) => {
    return res.json({ success: true, data: ["ERD", "Samsung", "Apple", "Boat", "Noise", "Realme", "Xiaomi", "Generic"] });
});
router.get("/units", (req, res) => {
    return res.json({ success: true, data: ["PCS", "BOX", "SET", "KG", "MTR"] });
});
router.get("/hsn-sac", (req, res) => {
    return res.json({ success: true, data: ["8504", "8517", "8518", "8544", "9023", "8471"] });
});
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