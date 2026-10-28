import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import { validate, createEmployeeRules } from "../middleware/validate";
import {
  createEmployee,
  listEmployees,
  getEmployee,
  assignShopRole,
  removeShopAssignment,
  setEmployeeStatus,
} from "../controllers/employeeController";

const router = Router();

router.use(authenticate, requireOwner); // only the owner manages employees

router.get("/", listEmployees);
router.get("/:employeeId", getEmployee);
router.post("/", validate(createEmployeeRules), createEmployee);
router.post("/assign-shop", assignShopRole);
router.post("/remove-shop", removeShopAssignment);
router.patch("/:employeeId/status", setEmployeeStatus);

export default router;
