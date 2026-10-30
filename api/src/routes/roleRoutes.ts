import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import {
  listModules,
  createRole,
  listRoles,
  updateRolePermissions,
  updateRoleFieldPermissions,
  deleteRole,
  listShopModules,
  updateShopModule,
} from "../controllers/roleController";

const router = Router();

router.use(authenticate);

// List active modules dynamically
router.get("/modules", listModules);

// Shop modules access control
router.get("/shop-modules/:shopId?", listShopModules);
router.put("/shop-modules/:shopId", requireOwner, updateShopModule);

// Roles management
router.get("/", listRoles);
router.post("/", requireOwner, createRole);
router.put("/:roleId/permissions", requireOwner, updateRolePermissions);
router.put("/:roleId/field-permissions", requireOwner, updateRoleFieldPermissions);
router.delete("/:roleId", requireOwner, deleteRole);

export default router;
