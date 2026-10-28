import { Router } from "express";
import { registerOwner, login, refresh, logout, getMe } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validate, registerOwnerRules, loginRules } from "../middleware/validate";

const router = Router();

router.post("/register", validate(registerOwnerRules), registerOwner);
router.post("/login", validate(loginRules), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// ADDITIVE — does not touch any existing route/behavior.
// Used by the frontend to know who's logged in, which shop/role
// they're scoped to, and their resolved permission grid.
router.get("/me", authenticate, getMe);

export default router;
