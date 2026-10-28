import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { getSupplierLedger, listSupplierOutstanding, listSupplierPayments } from "../controllers/supplierLedgerController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/outstanding", requirePermission("suppliers", "view"), listSupplierOutstanding);
router.get("/payments", requirePermission("suppliers", "view"), listSupplierPayments);
router.get("/:supplierId", requirePermission("suppliers", "view"), getSupplierLedger);

export default router;
