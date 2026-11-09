import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  listMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  getAlerts,
} from "../controllers/notificationController";

const router = Router();

router.use(authenticate, requireShop);

// Self-service — every actor only ever sees notifications addressed to them
router.get("/", listMyNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/:notificationId/read", markRead);
router.patch("/:notificationId/read", markRead);
router.post("/read-all", markAllRead);

// Owner/manager — live-computed operational alerts (low stock, overdue EMI, pending leave)
router.get("/alerts", requirePermission("dashboard", "view"), getAlerts);

export default router;
