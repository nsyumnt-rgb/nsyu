import { Router } from "express";
import {
  loginSupplier,
  listSupplierPurchases,
  getSupplierPurchaseDetail,
  getSupplierLedger,
  changeSupplierPassword,
} from "../controllers/supplierPortalController";
import { requireSupplier } from "../middleware/auth";

const router = Router();

// Public auth
router.post("/auth/login", loginSupplier);

// Authenticated supplier routes
router.use(requireSupplier);
router.post("/auth/change-password", changeSupplierPassword);
router.get("/purchases", listSupplierPurchases);
router.get("/purchases/:id", getSupplierPurchaseDetail);
router.get("/ledger", getSupplierLedger);

export default router;
