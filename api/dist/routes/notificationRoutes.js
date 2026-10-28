"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
// Self-service — every actor only ever sees notifications addressed to them
router.get("/", notificationController_1.listMyNotifications);
router.post("/:notificationId/read", notificationController_1.markRead);
router.post("/read-all", notificationController_1.markAllRead);
// Owner/manager — live-computed operational alerts (low stock, overdue EMI, pending leave)
router.get("/alerts", (0, permission_1.requirePermission)("dashboard", "view"), notificationController_1.getAlerts);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map