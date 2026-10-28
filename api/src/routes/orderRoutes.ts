import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  convertOrderToBill,
} from "../controllers/orderController";

const router = Router();

router.use(authenticate);

router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.put("/:id/status", updateOrderStatus);
router.post("/:id/convert", convertOrderToBill);

export default router;
