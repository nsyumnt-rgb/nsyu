"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sale = exports.SALE_STATUSES = exports.PAYMENT_METHODS = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"];
exports.SALE_STATUSES = [
    "unpaid",
    "partially_paid",
    "paid",
    "cancelled",
    "returned",
    "partially_returned",
];
class Sale extends sequelize_1.Model {
}
exports.Sale = Sale;
Sale.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    invoice_number: { type: sequelize_1.DataTypes.STRING(40), allowNull: false },
    invoice_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    subtotal: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: sequelize_1.DataTypes.ENUM(...exports.PAYMENT_METHODS), allowNull: false },
    is_emi: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.SALE_STATUSES), allowNull: false, defaultValue: "unpaid" },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Sale",
    tableName: "sales",
    indexes: [
        { unique: true, fields: ["owner_id", "shop_id", "invoice_number"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["customer_id"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Sale.js.map