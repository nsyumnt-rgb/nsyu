import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { listPayments, getPayment, createPayment, cancelPayment, downloadReceiptPdf } from "../controllers/paymentController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/", requirePermission("payments", "view"), listPayments);
router.post("/", requirePermission("payments", "create"), createPayment);
router.get("/:paymentId", requirePermission("payments", "view"), getPayment);
router.post("/:paymentId/cancel", requirePermission("payments", "delete"), cancelPayment);
router.get("/:paymentId/receipt/pdf", requirePermission("payments", "view"), downloadReceiptPdf);

export default router;
