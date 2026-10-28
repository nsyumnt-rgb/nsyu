"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItem = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class OrderItem extends sequelize_1.Model {
}
exports.OrderItem = OrderItem;
OrderItem.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    order_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: true },
    product_name: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    sku: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    available_stock: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    rate: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
}, {
    sequelize: database_1.default,
    modelName: "OrderItem",
    tableName: "order_items",
    indexes: [{ fields: ["order_id"] }, { fields: ["product_id"] }],
});
//# sourceMappingURL=OrderItem.js.map