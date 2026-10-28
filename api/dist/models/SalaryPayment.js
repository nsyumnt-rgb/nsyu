"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryPayment = exports.SALARY_PAYMENT_STATUSES = exports.SALARY_PAYMENT_METHODS = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.SALARY_PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "cheque", "other"];
exports.SALARY_PAYMENT_STATUSES = ["completed", "cancelled"];
class SalaryPayment extends sequelize_1.Model {
}
exports.SalaryPayment = SalaryPayment;
SalaryPayment.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    payroll_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: sequelize_1.DataTypes.ENUM(...exports.SALARY_PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
    payment_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.SALARY_PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "SalaryPayment",
    tableName: "salary_payments",
    indexes: [{ fields: ["employee_id"] }, { fields: ["payroll_id"] }, { fields: ["owner_id", "shop_id"] }],
});
//# sourceMappingURL=SalaryPayment.js.map