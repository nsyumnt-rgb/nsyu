import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listActivityLogs } from "../controllers/activityController";

const router = Router();
router.use(authenticate);
router.get("/", listActivityLogs);

export default router;
