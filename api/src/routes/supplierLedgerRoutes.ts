import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { getSupplierLedger, listSupplierOutstanding, listSupplierPayments } from "../controllers/supplierLedgerController";

const router = Router();
router.use(authenticate, requireShop);

// Static paths first so they aren't captured by "/:supplierId"
router.get("/outstanding", requirePermission("suppliers", "view"), listSupplierOutstanding);
router.get("/payments", requirePermission("payments", "view"), listSupplierPayments);
router.get("/:supplierId", requirePermission("suppliers", "view"), getSupplierLedger);

export default router;
