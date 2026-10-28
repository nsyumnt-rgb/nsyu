"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Employee = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Employee extends sequelize_1.Model {
}
exports.Employee = Employee;
Employee.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    password: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING(20) },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    // Cached running balance from EmployeeLedger — "net amount the
    // owner currently owes this employee" (salary earned + incentives
    // - deductions - advances - salary payments). See utils/salaryLedger.ts,
    // the only place this column is allowed to change. Added in the
    // Attendance/Payroll pass; defaults to 0 so existing rows are unaffected.
    salary_outstanding: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Employee",
    tableName: "employees",
    indexes: [
        { unique: true, fields: ["owner_id", "email"] }, // email unique per owner, not globally
        { fields: ["owner_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Employee.js.map