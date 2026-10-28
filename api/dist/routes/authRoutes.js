"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.post("/register", (0, validate_1.validate)(validate_1.registerOwnerRules), authController_1.registerOwner);
router.post("/login", (0, validate_1.validate)(validate_1.loginRules), authController_1.login);
router.post("/refresh", authController_1.refresh);
router.post("/logout", authController_1.logout);
// ADDITIVE — does not touch any existing route/behavior.
// Used by the frontend to know who's logged in, which shop/role
// they're scoped to, and their resolved permission grid.
router.get("/me", auth_1.authenticate, authController_1.getMe);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map