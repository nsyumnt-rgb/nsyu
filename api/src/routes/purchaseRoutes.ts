import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  listPurchases,
  getPurchase,
  createPurchase,
  recordPurchasePayment,
  cancelPurchase,
  returnPurchase,
  downloadPurchasePdf,
} from "../controllers/purchaseController";

const router = Router();
router.use(authenticate, requireShop);

router.get("/", requirePermission("purchase", "view"), listPurchases);
router.post("/", requirePermission("purchase", "create"), createPurchase);
router.get("/:id", requirePermission("purchase", "view"), getPurchase);
router.get("/:id/pdf", requirePermission("purchase", "view"), downloadPurchasePdf);
router.post("/:id/payment", requirePermission("purchase", "edit"), recordPurchasePayment);
router.post("/:id/cancel", requirePermission("purchase", "delete"), cancelPurchase);
router.post("/:id/return", requirePermission("purchase", "edit"), returnPurchase);

export default router;
