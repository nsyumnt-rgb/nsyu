import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { resolveReference } from "../controllers/referenceController";

const router = Router();

router.use(authenticate);
router.get("/resolve", resolveReference);

export default router;
