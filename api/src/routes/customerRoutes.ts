import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { createCustomer, listCustomers, getCustomer, updateCustomer } from "../controllers/customerController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/", requirePermission("customers", "view"), listCustomers);
router.get("/:customerId", requirePermission("customers", "view"), getCustomer);
router.post("/", requirePermission("customers", "create"), createCustomer);
router.put("/:customerId", requirePermission("customers", "edit"), updateCustomer);

export default router;
