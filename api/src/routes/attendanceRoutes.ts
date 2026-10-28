import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  checkIn,
  checkOut,
  getMyAttendance,
  listAttendance,
  markAttendance,
  markBulkAttendance,
} from "../controllers/attendanceController";

const router = Router();

router.use(authenticate, requireShop);

// Self-service — any authenticated employee, no module permission required
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/me", getMyAttendance);

// Owner/manager — requires "attendance" permission
router.get("/", requirePermission("attendance", "view"), listAttendance);
router.post("/", requirePermission("attendance", "create"), markAttendance);
router.post("/bulk", requirePermission("attendance", "create"), markBulkAttendance);

export default router;
