"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSalaryConfig = getActiveSalaryConfig;
exports.summarizeAttendance = summarizeAttendance;
exports.calculatePayroll = calculatePayroll;
exports.getPendingIncentiveTotal = getPendingIncentiveTotal;
exports.getTotalOutstandingAdvance = getTotalOutstandingAdvance;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
function round2(n) {
    return Math.round(n * 100) / 100;
}
/** Finds the salary structure in force on a given date (latest effective_date <= asOf, active). */
async function getActiveSalaryConfig(employeeId, asOf) {
    const config = await models_1.SalaryConfig.findOne({
        where: { employee_id: employeeId, is_active: true, effective_date: { [sequelize_1.Op.lte]: asOf } },
        order: [["effective_date", "DESC"]],
    });
    if (!config) {
        throw Object.assign(new Error("No active salary configuration found for this employee as of the period"), {
            status: 400,
        });
    }
    return config;
}
/**
 * Tallies a period's Attendance rows into payroll-ready counts.
 * "Leave" status rows are cross-referenced against approved
 * LeaveRequests covering that date to split Paid vs Unpaid Leave
 * (an Attendance row alone doesn't carry that distinction).
 */
async function summarizeAttendance(employeeId, periodStart, periodEnd) {
    const records = await models_1.Attendance.findAll({
        where: { employee_id: employeeId, date: { [sequelize_1.Op.between]: [periodStart, periodEnd] } },
    });
    const approvedLeaves = await models_1.LeaveRequest.findAll({
        where: {
            employee_id: employeeId,
            status: "Approved",
            start_date: { [sequelize_1.Op.lte]: periodEnd },
            end_date: { [sequelize_1.Op.gte]: periodStart },
        },
    });
    const isPaidLeaveDate = (date) => approvedLeaves.some((lr) => lr.is_paid && lr.start_date <= date && lr.end_date >= date);
    const summary = {
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        holidayDays: 0,
        weekOffDays: 0,
        payableDays: 0,
        totalDaysMarked: records.length,
        overtimeHours: 0,
        totalWorkingHours: 0,
    };
    for (const rec of records) {
        summary.overtimeHours = round2(summary.overtimeHours + Number(rec.overtime_hours));
        summary.totalWorkingHours = round2(summary.totalWorkingHours + Number(rec.working_hours));
        switch (rec.status) {
            case "Present":
            case "Late":
                summary.presentDays += 1;
                break;
            case "Absent":
                summary.absentDays += 1;
                break;
            case "Half Day":
                summary.halfDays += 1;
                break;
            case "Holiday":
                summary.holidayDays += 1;
                break;
            case "Week Off":
                summary.weekOffDays += 1;
                break;
            case "Leave":
                if (isPaidLeaveDate(rec.date))
                    summary.paidLeaveDays += 1;
                else
                    summary.unpaidLeaveDays += 1;
                break;
        }
    }
    // Payable days = full credit for Present/Late/Holiday/Week Off/Paid Leave, half credit for Half Day
    summary.payableDays = round2(summary.presentDays + summary.holidayDays + summary.weekOffDays + summary.paidLeaveDays + summary.halfDays * 0.5);
    return summary;
}
/**
 * Pure calculation — no DB reads/writes, so it's trivially testable
 * and reusable for both a real payroll run and a "preview" endpoint.
 * See models/Payroll.ts for the field-by-field formula this implements.
 */
function calculatePayroll(input) {
    const { salaryType, basicSalary, allowances, overtimeRate, configIncentive, totalDaysInPeriod, attendance } = input;
    let basicComponent = 0;
    let allowancesComponent = 0;
    switch (salaryType) {
        case "monthly":
        case "weekly": {
            // basic_salary is a per-cycle figure; prorate by payable/total days in the period
            const ratio = totalDaysInPeriod > 0 ? attendance.payableDays / totalDaysInPeriod : 0;
            basicComponent = round2(basicSalary * ratio);
            allowancesComponent = round2(allowances * ratio);
            break;
        }
        case "daily": {
            // basic_salary is a per-day rate
            basicComponent = round2(basicSalary * attendance.payableDays);
            allowancesComponent = round2(allowances * (totalDaysInPeriod > 0 ? attendance.payableDays / totalDaysInPeriod : 0));
            break;
        }
        case "hourly": {
            // basic_salary is a per-hour rate; pay for actual hours logged (overtime hours billed separately below)
            const regularHours = Math.max(0, attendance.totalWorkingHours - attendance.overtimeHours);
            basicComponent = round2(basicSalary * regularHours);
            allowancesComponent = round2(allowances * (totalDaysInPeriod > 0 ? attendance.payableDays / totalDaysInPeriod : 0));
            break;
        }
        case "commission": {
            // basic_salary acts as a base retainer (often 0); full amount, not prorated, plus allowances
            basicComponent = round2(basicSalary);
            allowancesComponent = round2(allowances);
            break;
        }
    }
    const overtimeAmount = round2(attendance.overtimeHours * overtimeRate);
    const incentiveAmount = round2(input.incentiveAmount + configIncentive);
    const grossSalary = round2(basicComponent + allowancesComponent + overtimeAmount + incentiveAmount);
    const otherDeduction = round2(input.otherDeduction);
    const netSalaryBeforeAdvance = Math.max(0, round2(grossSalary - otherDeduction));
    return {
        basicComponent,
        allowancesComponent,
        overtimeAmount,
        incentiveAmount,
        grossSalary,
        otherDeduction,
        netSalaryBeforeAdvance,
    };
}
/** Sum of computed_amount for an employee's incentives in a period that haven't already been consumed by a payroll run. */
async function getPendingIncentiveTotal(employeeId, periodStart, periodEnd) {
    const rows = await models_1.EmployeeIncentive.findAll({
        where: {
            employee_id: employeeId,
            status: "pending",
            period_start: { [sequelize_1.Op.gte]: periodStart },
            period_end: { [sequelize_1.Op.lte]: periodEnd },
        },
    });
    return { rows, total: round2(rows.reduce((sum, r) => sum + Number(r.computed_amount), 0)) };
}
/** Total unrecovered advance principal outstanding for an employee. */
async function getTotalOutstandingAdvance(employeeId) {
    const rows = await models_1.EmployeeAdvance.findAll({
        where: { employee_id: employeeId, status: ["outstanding", "partially_recovered"] },
    });
    return { rows, total: round2(rows.reduce((sum, r) => sum + Number(r.outstanding_amount), 0)) };
}
//# sourceMappingURL=payroll.js.map