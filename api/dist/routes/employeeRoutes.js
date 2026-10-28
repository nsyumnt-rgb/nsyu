"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const employeeController_1 = require("../controllers/employeeController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireOwner); // only the owner manages employees
router.get("/", employeeController_1.listEmployees);
router.get("/:employeeId", employeeController_1.getEmployee);
router.post("/", (0, validate_1.validate)(validate_1.createEmployeeRules), employeeController_1.createEmployee);
router.post("/assign-shop", employeeController_1.assignShopRole);
router.post("/remove-shop", employeeController_1.removeShopAssignment);
router.patch("/:employeeId/status", employeeController_1.setEmployeeStatus);
exports.default = router;
//# sourceMappingURL=employeeRoutes.js.map