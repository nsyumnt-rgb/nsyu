import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { requestLeave, getMyLeaves, listLeaves, decideLeave, cancelLeave } from "../controllers/leaveController";

const router = Router();

router.use(authenticate, requireShop);

// Self-service
router.post("/", requestLeave);
router.get("/me", getMyLeaves);
router.post("/:leaveId/cancel", cancelLeave); // ownership enforced inside the controller

// Owner/manager
router.get("/", requirePermission("leave", "view"), listLeaves);
router.post("/:leaveId/decide", requirePermission("leave", "edit"), decideLeave);

export default router;
