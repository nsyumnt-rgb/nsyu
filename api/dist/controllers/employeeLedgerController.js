"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeLedger = getEmployeeLedger;
exports.getMyLedger = getMyLedger;
exports.getMyPayrolls = getMyPayrolls;
exports.listOutstandingSalaries = listOutstandingSalaries;
const models_1 = require("../models");
async function buildLedgerResponse(employee, shopId) {
    const where = { owner_id: employee.owner_id, employee_id: employee.id };
    if (shopId)
        where.shop_id = shopId;
    const entries = await models_1.EmployeeLedger.findAll({
        where,
        order: [
            ["entry_date", "ASC"],
            ["id", "ASC"],
        ],
    });
    const totalCredit = entries
        .filter((e) => e.entry_type === "credit" && e.status === "active")
        .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalDebit = entries
        .filter((e) => e.entry_type === "debit" && e.status === "active")
        .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
        employee: { id: employee.id, name: employee.name },
        outstanding: Number(employee.salary_outstanding),
        totalCredit: Math.round(totalCredit * 100) / 100,
        totalDebit: Math.round(totalDebit * 100) / 100,
        entries,
    };
}
/** Owner/manager view of any employee's full salary ledger. */
async function getEmployeeLedger(req, res) {
    const employee = await models_1.Employee.findOne({ where: { id: req.params.employeeId, owner_id: req.auth.ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    const data = await buildLedgerResponse(employee, req.query.shopId ? Number(req.query.shopId) : undefined);
    return res.json({ success: true, data });
}
/** Self-service: the authenticated employee's own salary ledger. */
async function getMyLedger(req, res) {
    if (!req.auth.employeeId)
        return res.status(400).json({ success: false, message: "This endpoint is for employees" });
    const employee = await models_1.Employee.findOne({ where: { id: req.auth.employeeId, owner_id: req.auth.ownerId } });
    if (!employee)
        return res.status(404).json({ success: false, message: "Employee not found" });
    const data = await buildLedgerResponse(employee);
    return res.json({ success: true, data });
}
/** Self-service: the authenticated employee's own payroll history. */
async function getMyPayrolls(req, res) {
    if (!req.auth.employeeId)
        return res.status(400).json({ success: false, message: "This endpoint is for employees" });
    const payrolls = await models_1.Payroll.findAll({
        where: { employee_id: req.auth.employeeId },
        order: [["period_start", "DESC"]],
    });
    return res.json({ success: true, data: payrolls });
}
/** Owner: every employee with a non-zero salary_outstanding — for an owner-wide payroll dues overview. */
async function listOutstandingSalaries(req, res) {
    const employees = await models_1.Employee.findAll({
        where: { owner_id: req.auth.ownerId },
        order: [["salary_outstanding", "DESC"]],
    });
    const outstanding = employees.filter((e) => Number(e.salary_outstanding) !== 0);
    return res.json({ success: true, data: outstanding });
}
//# sourceMappingURL=employeeLedgerController.js.map