"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const activityController_1 = require("../controllers/activityController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", activityController_1.listActivityLogs);
exports.default = router;
//# sourceMappingURL=activityRoutes.js.map