import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import { exportBackup, validateBackup, restoreBackup } from "../controllers/backupController";

const router = Router();
router.use(authenticate);

// Full data export (customers, ledger, sales) is owner-only, like restore.
router.get("/", requireOwner, exportBackup);
router.post("/validate", validateBackup);
router.post("/restore", requireOwner, restoreBackup);

export default router;
