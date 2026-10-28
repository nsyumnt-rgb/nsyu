"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const backupController_1 = require("../controllers/backupController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", backupController_1.exportBackup);
router.post("/validate", backupController_1.validateBackup);
router.post("/restore", auth_1.requireOwner, backupController_1.restoreBackup);
exports.default = router;
//# sourceMappingURL=backupRoutes.js.map