import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { getCustomerLedger, listOutstandingBalances } from "../controllers/ledgerController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/outstanding", requirePermission("ledger", "view"), listOutstandingBalances);
router.get("/customer/:customerId", requirePermission("ledger", "view"), getCustomerLedger);
router.get("/:customerId", requirePermission("ledger", "view"), getCustomerLedger);

export default router;
