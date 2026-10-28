"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const attendanceController_1 = require("../controllers/attendanceController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
// Self-service — any authenticated employee, no module permission required
router.post("/check-in", attendanceController_1.checkIn);
router.post("/check-out", attendanceController_1.checkOut);
router.get("/me", attendanceController_1.getMyAttendance);
// Owner/manager — requires "attendance" permission
router.get("/", (0, permission_1.requirePermission)("attendance", "view"), attendanceController_1.listAttendance);
router.post("/", (0, permission_1.requirePermission)("attendance", "create"), attendanceController_1.markAttendance);
router.post("/bulk", (0, permission_1.requirePermission)("attendance", "create"), attendanceController_1.markBulkAttendance);
exports.default = router;
//# sourceMappingURL=attendanceRoutes.js.map