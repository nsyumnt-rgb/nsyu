import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  createProduct,
  updateProduct,
  listProductsOwnerView,
  getProductOwnerView,
} from "../controllers/productController";
import { Category } from "../models";
import {
  recordMovement,
  transferStock,
  listTransfers,
  getTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  getMovement,
  getInventoryHistory,
  getProductStockOverview,
} from "../controllers/inventoryController";

const router = Router();

router.use(authenticate, requireShop);

// Products CRUD under /api/inventory
router.get("/products", requirePermission("products", "view"), listProductsOwnerView);
router.get("/products/:productId", requirePermission("products", "view"), getProductOwnerView);
router.post("/products", requirePermission("products", "create"), createProduct);
router.put("/products/:productId", requirePermission("products", "edit"), updateProduct);
router.patch("/products/:productId/status", requirePermission("products", "edit"), updateProduct);

// Dropdown Metadata
router.get("/categories", async (req, res) => {
  try {
    const list = await Category.findAll({ where: { status: "active" } });
    const names = list.map((c) => c.name);
    return res.json({ success: true, data: names.length > 0 ? names : ["Mobile Accessories", "Chargers", "Cables", "Stationery", "Others"] });
  } catch (_) {
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

router.post("/movement", requirePermission("inventory", "create"), recordMovement);
router.get("/movement/:movementId", requirePermission("inventory", "view"), getMovement);
router.get("/movements/:movementId", requirePermission("inventory", "view"), getMovement);
router.get("/history", requirePermission("inventory", "view"), getInventoryHistory);
router.get("/stock/:productId", requirePermission("inventory", "view"), getProductStockOverview);

// Transfers
router.get("/transfers", requirePermission("inventory", "view"), listTransfers);
router.get("/transfers/:transferId", requirePermission("inventory", "view"), getTransfer);
router.post("/transfer", requirePermission("inventory", "edit"), transferStock);
router.post("/transfers", requirePermission("inventory", "edit"), transferStock);
router.put("/transfer/:id/dispatch", requirePermission("inventory", "edit"), dispatchTransfer);
router.put("/transfers/:id/dispatch", requirePermission("inventory", "edit"), dispatchTransfer);
router.put("/transfer/:id/receive", requirePermission("inventory", "edit"), receiveTransfer);
router.put("/transfers/:id/receive", requirePermission("inventory", "edit"), receiveTransfer);
router.put("/transfer/:id/cancel", requirePermission("inventory", "edit"), cancelTransfer);
router.put("/transfers/:id/cancel", requirePermission("inventory", "edit"), cancelTransfer);

export default router;
