import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
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
