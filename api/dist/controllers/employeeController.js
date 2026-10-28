"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmployee = createEmployee;
exports.listEmployees = listEmployees;
exports.getEmployee = getEmployee;
exports.assignShopRole = assignShopRole;
exports.removeShopAssignment = removeShopAssignment;
exports.setEmployeeStatus = setEmployeeStatus;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const audit_1 = require("../utils/audit");
/** Owner-only: create a new employee (login credentials, not yet assigned to a shop). */
async function createEmployee(req, res) {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "name, email and password are required" });
    }
    const existing = await models_1.Employee.findOne({ where: { owner_id: req.auth.ownerId, email } });
    if (existing) {
        return res.status(409).json({ success: false, message: "An employee with this email already exists" });
    }
    const hashed = await bcryptjs_1.default.hash(password, 10);
    const employee = await models_1.Employee.create({ owner_id: req.auth.ownerId, name, email, password: hashed, phone });
    await (0, audit_1.logAudit)({ req, module: "employees", action: "create", entityType: "Employee", entityId: employee.id });
    return res.status(201).json({
        success: true,
        data: { id: employee.id, name: employee.name, email: employee.email, phone: employee.phone },
    });
}
/** List all employees under this owner, with their shop+role assignments. */
async function listEmployees(req, res) {
    const employees = await models_1.Employee.findAll({
        where: { owner_id: req.auth.ownerId },
        attributes: { exclude: ["password"] },
        include: [
            {
                model: models_1.EmployeeShop,
                as: "shopAssignments",
                include: [{ model: models_1.Shop, as: "shop" }, { model: models_1.Role, as: "role" }],
            },
        ],
    });
    return res.json({ success: true, data: employees });
}
/** Get a single employee with shop/role assignments, salary config, recent attendance, and payroll. */
async function getEmployee(req, res) {
    const param = String(req.params.employeeId).trim();
    const isNumeric = /^\d+$/.test(param);
    const where = { owner_id: req.auth.ownerId };
    if (isNumeric) {
        where.id = Number(param);
    }
    else {
        where[sequelize_1.Op.or] = [
            { email: { [sequelize_1.Op.iLike]: param } },
            { name: { [sequelize_1.Op.iLike]: param } },
        ];
    }
    const employee = await models_1.Employee.findOne({
        where,
        attributes: { exclude: ["password"] },
        include: [
            {
                model: models_1.EmployeeShop,
                as: "shopAssignments",
                include: [{ model: models_1.Shop, as: "shop" }, { model: models_1.Role, as: "role" }],
            },
            {
                model: models_1.SalaryConfig,
                as: "salaryConfigs",
            },
            {
                model: models_1.Attendance,
                as: "attendanceRecords",
                limit: 15,
                order: [["date", "DESC"]],
            },
            {
                model: models_1.Payroll,
                as: "payrolls",
                limit: 12,
                order: [["created_at", "DESC"]],
            },
        ],
    });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, data: employee });
}
/**
 * Owner-only: assign (or update) an employee's role for a specific shop.
 * Because EmployeeShop has a unique (employee_id, shop_id) index, calling
 * this again for the same shop just changes their role there.
 */
async function assignShopRole(req, res) {
    const { employeeId, shopId, roleId } = req.body;
    if (!employeeId || !shopId || !roleId) {
        return res.status(400).json({ success: false, message: "employeeId, shopId and roleId are required" });
    }
    const [employee, shop, role] = await Promise.all([
        models_1.Employee.findOne({ where: { id: employeeId, owner_id: req.auth.ownerId } }),
        models_1.Shop.findOne({ where: { id: shopId, owner_id: req.auth.ownerId } }),
        models_1.Role.findOne({ where: { id: roleId, owner_id: req.auth.ownerId } }),
    ]);
    if (!employee || !shop || !role) {
        return res.status(404).json({ success: false, message: "Employee, shop or role not found" });
    }
    const [assignment] = await models_1.EmployeeShop.upsert({ employee_id: employeeId, shop_id: shopId, role_id: roleId });
    await (0, audit_1.logAudit)({
        req,
        module: "employees",
        action: "assign_shop_role",
        entityType: "Employee",
        entityId: employeeId,
        details: { shopId, roleId },
    });
    return res.json({ success: true, data: assignment });
}
/** Owner-only: remove an employee's access to a shop. */
async function removeShopAssignment(req, res) {
    const { employeeId, shopId } = req.body;
    await models_1.EmployeeShop.destroy({ where: { employee_id: employeeId, shop_id: shopId } });
    await (0, audit_1.logAudit)({ req, module: "employees", action: "remove_shop_assignment", entityType: "Employee", entityId: employeeId });
    return res.json({ success: true, message: "Access removed" });
}
/** Owner-only: activate/deactivate an employee account. */
async function setEmployeeStatus(req, res) {
    const employeeId = Number(req.params.employeeId);
    const { status } = req.body; // "active" | "inactive"
    const employee = await models_1.Employee.findOne({ where: { id: employeeId, owner_id: req.auth.ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    const oldStatus = employee.status;
    employee.status = status;
    await employee.save();
    await (0, audit_1.logAudit)({
        req,
        module: "employees",
        action: "employee_change",
        entityType: "Employee",
        entityId: employeeId,
        oldValue: { status: oldStatus },
        newValue: { status },
    });
    return res.json({ success: true, data: { id: employee.id, status: employee.status } });
}
//# sourceMappingURL=employeeController.js.map