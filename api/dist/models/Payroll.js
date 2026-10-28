"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payroll = exports.PAYROLL_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.PAYROLL_STATUSES = ["draft", "finalized", "partially_paid", "paid", "cancelled"];
class Payroll extends sequelize_1.Model {
}
exports.Payroll = Payroll;
Payroll.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    period_start: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    period_end: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    salary_type: { type: sequelize_1.DataTypes.ENUM("monthly", "weekly", "daily", "hourly", "commission"), allowNull: false },
    present_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    absent_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    half_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    paid_leave_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    unpaid_leave_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    holiday_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    week_off_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    payable_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    total_days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: sequelize_1.DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    overtime_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    basic_salary: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allowances: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    incentive_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    gross_salary: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    other_deduction: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    advance_deduction: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    net_salary: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.PAYROLL_STATUSES), allowNull: false, defaultValue: "draft" },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Payroll",
    tableName: "payrolls",
    indexes: [
        { unique: true, fields: ["employee_id", "period_start", "period_end"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Payroll.js.map