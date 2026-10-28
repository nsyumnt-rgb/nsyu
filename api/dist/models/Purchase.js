"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Purchase = exports.PURCHASE_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Sale_1 = require("./Sale");
exports.PURCHASE_STATUSES = [
    "unpaid",
    "partially_paid",
    "paid",
    "cancelled",
    "returned",
    "partially_returned",
];
class Purchase extends sequelize_1.Model {
}
exports.Purchase = Purchase;
Purchase.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    supplier_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    purchase_number: { type: sequelize_1.DataTypes.STRING(40), allowNull: false },
    purchase_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    subtotal: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: sequelize_1.DataTypes.ENUM(...Sale_1.PAYMENT_METHODS), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.PURCHASE_STATUSES), allowNull: false, defaultValue: "unpaid" },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Purchase",
    tableName: "purchases",
    indexes: [
        { unique: true, fields: ["owner_id", "shop_id", "purchase_number"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["supplier_id"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Purchase.js.map