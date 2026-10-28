import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import {
  createRole,
  listRoles,
  updateRolePermissions,
  updateRoleFieldPermissions,
  deleteRole,
} from "../controllers/roleController";

const router = Router();

router.use(authenticate, requireOwner); // only the owner manages roles & permissions

router.get("/", listRoles);
router.post("/", createRole);
router.put("/:roleId/permissions", updateRolePermissions);
router.put("/:roleId/field-permissions", updateRoleFieldPermissions);
router.delete("/:roleId", deleteRole);

export default router;
