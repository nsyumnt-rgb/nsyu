"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roleController_1 = require("../controllers/roleController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// List active modules dynamically
router.get("/modules", roleController_1.listModules);
// Shop modules access control
router.get("/shop-modules/:shopId?", roleController_1.listShopModules);
router.put("/shop-modules/:shopId", auth_1.requireOwner, roleController_1.updateShopModule);
// Roles management
router.get("/", roleController_1.listRoles);
router.post("/", auth_1.requireOwner, roleController_1.createRole);
router.put("/:roleId/permissions", auth_1.requireOwner, roleController_1.updateRolePermissions);
router.put("/:roleId/field-permissions", auth_1.requireOwner, roleController_1.updateRoleFieldPermissions);
router.delete("/:roleId", auth_1.requireOwner, roleController_1.deleteRole);
exports.default = router;
//# sourceMappingURL=roleRoutes.js.map