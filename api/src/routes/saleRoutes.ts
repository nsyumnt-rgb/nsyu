import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { validate, createSaleRules } from "../middleware/validate";
import {
  createSale,
  listSales,
  getSale,
  recordSalePayment,
  cancelSale,
  returnSale,
  downloadBillPdf,
} from "../controllers/saleController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/", requirePermission("sales", "view"), listSales);
router.get("/:saleId", requirePermission("sales", "view"), getSale);
router.post("/", requirePermission("sales", "create"), validate(createSaleRules), createSale);
router.post("/:saleId/payments", requirePermission("billing", "create"), recordSalePayment);
router.post("/:saleId/cancel", requirePermission("sales", "delete"), cancelSale);
router.post("/:saleId/returns", requirePermission("sales", "edit"), returnSale);
router.get("/:saleId/bill/pdf", requirePermission("billing", "view"), downloadBillPdf);

export default router;
