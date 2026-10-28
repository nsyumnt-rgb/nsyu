import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  listEmiPlans,
  getEmiPlan,
  listDueInstallments,
  payInstallment,
  cancelEmiPlan,
} from "../controllers/emiController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/", requirePermission("emi", "view"), listEmiPlans);
router.get("/due", requirePermission("emi", "view"), listDueInstallments);
router.get("/:planId", requirePermission("emi", "view"), getEmiPlan);
router.get("/plans/:planId", requirePermission("emi", "view"), getEmiPlan);
router.post("/:planId/cancel", requirePermission("emi", "delete"), cancelEmiPlan);
router.post("/installments/:installmentId/pay", requirePermission("emi", "create"), payInstallment);

export default router;
