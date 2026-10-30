import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  convertOrderToBill,
} from "../controllers/orderController";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("orders", "view"), getOrders);
router.get("/:id", requirePermission("orders", "view"), getOrderById);
router.post("/", requirePermission("orders", "create"), createOrder);
router.put("/:id/status", requirePermission("orders", "edit"), updateOrderStatus);
router.post("/:id/convert", requirePermission("billing", "create"), convertOrderToBill);

export default router;
