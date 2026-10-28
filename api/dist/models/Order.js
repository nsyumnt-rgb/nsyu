"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = exports.ORDER_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.ORDER_STATUSES = [
    "pending",
    "confirmed",
    "delivered",
    "cancelled",
    "converted_to_bill",
];
class Order extends sequelize_1.Model {
}
exports.Order = Order;
Order.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    order_number: { type: sequelize_1.DataTypes.STRING(40), allowNull: false },
    order_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    expected_delivery_date: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    subtotal: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.ORDER_STATUSES), allowNull: false, defaultValue: "pending" },
    remarks: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    converted_sale_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: true },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Order",
    tableName: "orders",
    indexes: [
        { unique: true, fields: ["owner_id", "shop_id", "order_number"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["customer_id"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Order.js.map