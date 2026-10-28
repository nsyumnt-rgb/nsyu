import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { createSupplier, listSuppliers, getSupplier, updateSupplier, setSupplierStatus } from "../controllers/supplierController";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("suppliers", "view"), listSuppliers);
router.get("/:supplierId", requirePermission("suppliers", "view"), getSupplier);
router.post("/", requirePermission("suppliers", "create"), createSupplier);
router.put("/:supplierId", requirePermission("suppliers", "edit"), updateSupplier);
router.patch("/:supplierId/status", requirePermission("suppliers", "edit"), setSupplierStatus);

export default router;
