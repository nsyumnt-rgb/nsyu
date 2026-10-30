"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeIncentive = exports.INCENTIVE_STATUSES = exports.INCENTIVE_BASES = exports.INCENTIVE_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.INCENTIVE_TYPES = ["fixed", "percentage"];
exports.INCENTIVE_BASES = ["sales", "profit", "product", "category", "other"];
exports.INCENTIVE_STATUSES = ["pending", "included_in_payroll", "paid", "cancelled"];
class EmployeeIncentive extends sequelize_1.Model {
}
exports.EmployeeIncentive = EmployeeIncentive;
EmployeeIncentive.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    type: { type: sequelize_1.DataTypes.ENUM(...exports.INCENTIVE_TYPES), allowNull: false },
    basis: { type: sequelize_1.DataTypes.ENUM(...exports.INCENTIVE_BASES), allowNull: false, defaultValue: "other" },
    base_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    computed_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    period_start: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    period_end: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    description: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.INCENTIVE_STATUSES), allowNull: false, defaultValue: "pending" },
    payroll_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "EmployeeIncentive",
    tableName: "employee_incentives",
    indexes: [
        { fields: ["employee_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["status"] },
        { fields: ["period_start", "period_end"] },
    ],
});
//# sourceMappingURL=EmployeeIncentive.js.map