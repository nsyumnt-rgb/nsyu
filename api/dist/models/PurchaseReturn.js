"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseReturnItem = exports.PurchaseReturn = exports.PURCHASE_RETURN_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.PURCHASE_RETURN_STATUSES = ["completed", "cancelled"];
class PurchaseReturn extends sequelize_1.Model {
}
exports.PurchaseReturn = PurchaseReturn;
PurchaseReturn.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    purchase_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    supplier_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    return_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    refund_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.PURCHASE_RETURN_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "PurchaseReturn",
    tableName: "purchase_returns",
    updatedAt: false,
    indexes: [
        { fields: ["purchase_id"] },
        { fields: ["supplier_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["reference_code"] },
    ],
});
class PurchaseReturnItem extends sequelize_1.Model {
}
exports.PurchaseReturnItem = PurchaseReturnItem;
PurchaseReturnItem.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    purchase_return_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    purchase_item_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    rate: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    refund_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "PurchaseReturnItem",
    tableName: "purchase_return_items",
    timestamps: false,
    indexes: [{ fields: ["purchase_return_id"] }, { fields: ["purchase_item_id"] }],
});
//# sourceMappingURL=PurchaseReturn.js.map