import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { listSuppliers, createSupplier, getSupplier, updateSupplier } from "../controllers/supplierController";

const router = Router();
router.use(authenticate, requireShop);

router.get("/", requirePermission("suppliers", "view"), listSuppliers);
router.post("/", requirePermission("suppliers", "create"), createSupplier);
router.get("/:id", requirePermission("suppliers", "view"), getSupplier);
router.put("/:id", requirePermission("suppliers", "edit"), updateSupplier);

export default router;
