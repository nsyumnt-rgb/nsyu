import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  setEmployeeStatus,
  assignShop,
  removeShop,
} from "../controllers/employeeController";

/** Staff account management — owner only (employees cannot create or edit staff). */
const router = Router();
router.use(authenticate, requireOwner);

router.get("/", listEmployees);
router.post("/", createEmployee);
router.post("/assign-shop", assignShop);
router.post("/remove-shop", removeShop);
router.get("/:employeeId", getEmployee);
router.put("/:employeeId", updateEmployee);
router.patch("/:employeeId/status", setEmployeeStatus);
router.patch("/:employeeId/password", resetEmployeePassword);

export default router;
