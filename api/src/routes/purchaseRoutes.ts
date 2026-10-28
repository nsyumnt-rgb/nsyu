import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  createPurchase,
  listPurchases,
  getPurchase,
  recordPurchasePayment,
  cancelPurchase,
  returnPurchase,
  downloadPurchasePdf,
} from "../controllers/purchaseController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/", requirePermission("purchase", "view"), listPurchases);
router.get("/:purchaseId", requirePermission("purchase", "view"), getPurchase);
router.post("/", requirePermission("purchase", "create"), createPurchase);
router.post("/:purchaseId/payments", requirePermission("purchase", "create"), recordPurchasePayment);
router.post("/:purchaseId/cancel", requirePermission("purchase", "delete"), cancelPurchase);
router.post("/:purchaseId/returns", requirePermission("purchase", "edit"), returnPurchase);
router.get("/:purchaseId/pdf", requirePermission("purchase", "view"), downloadPurchasePdf);

export default router;
