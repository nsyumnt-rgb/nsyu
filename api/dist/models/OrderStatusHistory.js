"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusHistory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class OrderStatusHistory extends sequelize_1.Model {
}
exports.OrderStatusHistory = OrderStatusHistory;
OrderStatusHistory.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    order_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    from_status: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    to_status: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    changed_by_type: {
        type: sequelize_1.DataTypes.ENUM("customer", "user", "owner", "employee"),
        allowNull: false,
    },
    changed_by_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    note: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "OrderStatusHistory",
    tableName: "order_status_history",
    updatedAt: false,
    indexes: [
        { fields: ["order_id"] },
        { fields: ["created_at"] },
    ],
});
exports.default = OrderStatusHistory;
//# sourceMappingURL=OrderStatusHistory.js.map