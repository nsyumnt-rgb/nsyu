"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryConfig = exports.SALARY_CYCLES = exports.SALARY_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.SALARY_TYPES = ["monthly", "weekly", "daily", "hourly", "commission"];
exports.SALARY_CYCLES = ["monthly", "weekly", "daily"];
class SalaryConfig extends sequelize_1.Model {
}
exports.SalaryConfig = SalaryConfig;
SalaryConfig.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    salary_type: { type: sequelize_1.DataTypes.ENUM(...exports.SALARY_TYPES), allowNull: false },
    basic_salary: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allowances: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    overtime_rate: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    incentive: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    commission_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    deductions: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    salary_cycle: { type: sequelize_1.DataTypes.ENUM(...exports.SALARY_CYCLES), allowNull: false, defaultValue: "monthly" },
    effective_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    is_active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "SalaryConfig",
    tableName: "salary_configs",
    indexes: [{ fields: ["employee_id"] }, { fields: ["employee_id", "effective_date"] }, { fields: ["owner_id"] }],
});
//# sourceMappingURL=SalaryConfig.js.map