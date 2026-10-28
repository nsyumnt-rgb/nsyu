"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roleController_1 = require("../controllers/roleController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireOwner); // only the owner manages roles & permissions
router.get("/", roleController_1.listRoles);
router.post("/", roleController_1.createRole);
router.put("/:roleId/permissions", roleController_1.updateRolePermissions);
router.put("/:roleId/field-permissions", roleController_1.updateRoleFieldPermissions);
router.delete("/:roleId", roleController_1.deleteRole);
exports.default = router;
//# sourceMappingURL=roleRoutes.js.map