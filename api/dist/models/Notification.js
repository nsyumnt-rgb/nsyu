"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = exports.NOTIFICATION_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.NOTIFICATION_TYPES = [
    "leave_requested",
    "leave_decided",
    "payroll_finalized",
    "payment_received",
    "emi_overdue",
    "low_stock",
    "sale_cancelled",
    "general",
];
class Notification extends sequelize_1.Model {
}
exports.Notification = Notification;
Notification.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    recipient_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    recipient_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    type: { type: sequelize_1.DataTypes.ENUM(...exports.NOTIFICATION_TYPES), allowNull: false },
    title: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    message: { type: sequelize_1.DataTypes.STRING(500), allowNull: false },
    reference_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    reference_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    is_read: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    sequelize: database_1.default,
    modelName: "Notification",
    tableName: "notifications",
    updatedAt: false,
    indexes: [
        { fields: ["owner_id", "recipient_type", "recipient_id"] },
        { fields: ["is_read"] },
    ],
});
//# sourceMappingURL=Notification.js.map