"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const leaveController_1 = require("../controllers/leaveController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
// Self-service
router.post("/", leaveController_1.requestLeave);
router.get("/me", leaveController_1.getMyLeaves);
router.post("/:leaveId/cancel", leaveController_1.cancelLeave); // ownership enforced inside the controller
// Owner/manager
router.get("/", (0, permission_1.requirePermission)("leave", "view"), leaveController_1.listLeaves);
router.post("/:leaveId/decide", (0, permission_1.requirePermission)("leave", "edit"), leaveController_1.decideLeave);
exports.default = router;
//# sourceMappingURL=leaveRoutes.js.map