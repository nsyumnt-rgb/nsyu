import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getVisibilitySettings,
  updateVisibilitySettings,
  resetVisibilitySettings,
} from "../controllers/settingsController";

const router = Router();

router.use(authenticate);

router.get("/visibility", getVisibilitySettings);
router.put("/visibility", updateVisibilitySettings);
router.post("/visibility/reset", resetVisibilitySettings);

export default router;
