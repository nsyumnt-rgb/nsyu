import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { setSalaryConfig, listSalaryConfigs, getCurrentSalaryConfig } from "../controllers/salaryConfigController";
import { createAdvance, listAdvances, cancelAdvance } from "../controllers/employeeAdvanceController";
import { createIncentive, listIncentives, cancelIncentive } from "../controllers/employeeIncentiveController";
import { previewPayroll, runPayroll, listPayrolls, getPayroll, paySalary, cancelPayroll } from "../controllers/payrollController";
import { getEmployeeLedger, getMyLedger, getMyPayrolls, listOutstandingSalaries } from "../controllers/employeeLedgerController";
import { validate, runPayrollRules } from "../middleware/validate";

const router = Router();

router.use(authenticate, requireShop);

// Self-service
router.get("/me", getMyPayrolls);
router.get("/me/ledger", getMyLedger);

// Salary configuration — owner/manager only
router.post("/salary-config", requirePermission("payroll", "create"), setSalaryConfig);
router.get("/salary-config/:employeeId", requirePermission("payroll", "view"), listSalaryConfigs);
router.get("/salary-config/:employeeId/current", requirePermission("payroll", "view"), getCurrentSalaryConfig);

// Advances — owner/manager only
router.post("/advances", requirePermission("payroll", "create"), createAdvance);
router.get("/advances", requirePermission("payroll", "view"), listAdvances);
router.post("/advances/:advanceId/cancel", requirePermission("payroll", "delete"), cancelAdvance);

// Incentives / commission — owner/manager only
router.post("/incentives", requirePermission("payroll", "create"), createIncentive);
router.get("/incentives", requirePermission("payroll", "view"), listIncentives);
router.post("/incentives/:incentiveId/cancel", requirePermission("payroll", "delete"), cancelIncentive);

// Payroll runs — owner/manager only
router.get("/preview", requirePermission("payroll", "view"), previewPayroll);
router.post("/run", requirePermission("payroll", "create"), validate(runPayrollRules), runPayroll);
router.get("/", requirePermission("payroll", "view"), listPayrolls);
router.get("/outstanding", requirePermission("payroll", "view"), listOutstandingSalaries);
router.get("/:payrollId", requirePermission("payroll", "view"), getPayroll);
router.get("/records/:payrollId", requirePermission("payroll", "view"), getPayroll);
router.post("/:payrollId/pay", requirePermission("payroll", "create"), paySalary);
router.post("/:payrollId/cancel", requirePermission("payroll", "delete"), cancelPayroll);

// Employee-wise salary ledger — owner/manager
router.get("/ledger/:employeeId", requirePermission("payroll", "view"), getEmployeeLedger);

export default router;
