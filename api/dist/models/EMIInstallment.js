"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMIInstallment = exports.EMI_INSTALLMENT_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Sale_1 = require("./Sale");
exports.EMI_INSTALLMENT_STATUSES = [
    "Upcoming",
    "Due",
    "Partially Paid",
    "Paid",
    "Overdue",
    "Cancelled",
];
class EMIInstallment extends sequelize_1.Model {
}
exports.EMIInstallment = EMIInstallment;
EMIInstallment.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    emi_plan_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    installment_number: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    due_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    expected_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    paid_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_date: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    payment_method: { type: sequelize_1.DataTypes.ENUM(...Sale_1.PAYMENT_METHODS), allowNull: true },
    transaction_id: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
    late_fee: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    remaining_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.EMI_INSTALLMENT_STATUSES), allowNull: false, defaultValue: "Upcoming" },
}, {
    sequelize: database_1.default,
    modelName: "EMIInstallment",
    tableName: "emi_installments",
    indexes: [
        { unique: true, fields: ["emi_plan_id", "installment_number"] },
        { fields: ["due_date"] },
        { fields: ["status"] },
    ],
});
//# sourceMappingURL=EMIInstallment.js.map