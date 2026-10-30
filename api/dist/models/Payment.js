"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = exports.PAYMENT_STATUSES = exports.PAYMENT_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Sale_1 = require("./Sale");
exports.PAYMENT_TYPES = ["sale_payment", "down_payment", "emi_payment", "refund"];
exports.PAYMENT_STATUSES = ["completed", "cancelled"];
class Payment extends sequelize_1.Model {
}
exports.Payment = Payment;
Payment.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    sale_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    emi_installment_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    type: { type: sequelize_1.DataTypes.ENUM(...exports.PAYMENT_TYPES), allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: sequelize_1.DataTypes.ENUM(...Sale_1.PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
    payment_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Payment",
    tableName: "payments",
    indexes: [
        { fields: ["owner_id", "shop_id"] },
        { fields: ["customer_id"] },
        { fields: ["sale_id"] },
        { fields: ["emi_installment_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Payment.js.map