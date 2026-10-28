"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const salaryConfigController_1 = require("../controllers/salaryConfigController");
const employeeAdvanceController_1 = require("../controllers/employeeAdvanceController");
const employeeIncentiveController_1 = require("../controllers/employeeIncentiveController");
const payrollController_1 = require("../controllers/payrollController");
const employeeLedgerController_1 = require("../controllers/employeeLedgerController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireShop);
// Self-service
router.get("/me", employeeLedgerController_1.getMyPayrolls);
router.get("/me/ledger", employeeLedgerController_1.getMyLedger);
// Salary configuration — owner/manager only
router.post("/salary-config", (0, permission_1.requirePermission)("payroll", "create"), salaryConfigController_1.setSalaryConfig);
router.get("/salary-config/:employeeId", (0, permission_1.requirePermission)("payroll", "view"), salaryConfigController_1.listSalaryConfigs);
router.get("/salary-config/:employeeId/current", (0, permission_1.requirePermission)("payroll", "view"), salaryConfigController_1.getCurrentSalaryConfig);
// Advances — owner/manager only
router.post("/advances", (0, permission_1.requirePermission)("payroll", "create"), employeeAdvanceController_1.createAdvance);
router.get("/advances", (0, permission_1.requirePermission)("payroll", "view"), employeeAdvanceController_1.listAdvances);
router.post("/advances/:advanceId/cancel", (0, permission_1.requirePermission)("payroll", "delete"), employeeAdvanceController_1.cancelAdvance);
// Incentives / commission — owner/manager only
router.post("/incentives", (0, permission_1.requirePermission)("payroll", "create"), employeeIncentiveController_1.createIncentive);
router.get("/incentives", (0, permission_1.requirePermission)("payroll", "view"), employeeIncentiveController_1.listIncentives);
router.post("/incentives/:incentiveId/cancel", (0, permission_1.requirePermission)("payroll", "delete"), employeeIncentiveController_1.cancelIncentive);
// Payroll runs — owner/manager only
router.get("/preview", (0, permission_1.requirePermission)("payroll", "view"), payrollController_1.previewPayroll);
router.post("/run", (0, permission_1.requirePermission)("payroll", "create"), (0, validate_1.validate)(validate_1.runPayrollRules), payrollController_1.runPayroll);
router.get("/", (0, permission_1.requirePermission)("payroll", "view"), payrollController_1.listPayrolls);
router.get("/outstanding", (0, permission_1.requirePermission)("payroll", "view"), employeeLedgerController_1.listOutstandingSalaries);
router.get("/:payrollId", (0, permission_1.requirePermission)("payroll", "view"), payrollController_1.getPayroll);
router.get("/records/:payrollId", (0, permission_1.requirePermission)("payroll", "view"), payrollController_1.getPayroll);
router.post("/:payrollId/pay", (0, permission_1.requirePermission)("payroll", "create"), payrollController_1.paySalary);
router.post("/:payrollId/cancel", (0, permission_1.requirePermission)("payroll", "delete"), payrollController_1.cancelPayroll);
// Employee-wise salary ledger — owner/manager
router.get("/ledger/:employeeId", (0, permission_1.requirePermission)("payroll", "view"), employeeLedgerController_1.getEmployeeLedger);
exports.default = router;
//# sourceMappingURL=payrollRoutes.js.map