"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const settingsController_1 = require("../controllers/settingsController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/visibility", settingsController_1.getVisibilitySettings);
router.put("/visibility", settingsController_1.updateVisibilitySettings);
router.post("/visibility/reset", settingsController_1.resetVisibilitySettings);
exports.default = router;
//# sourceMappingURL=settingsRoutes.js.map