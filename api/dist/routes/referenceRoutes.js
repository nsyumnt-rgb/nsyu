"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const referenceController_1 = require("../controllers/referenceController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/resolve", referenceController_1.resolveReference);
exports.default = router;
//# sourceMappingURL=referenceRoutes.js.map