"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleReturnItem = exports.SaleReturn = exports.SALE_RETURN_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.SALE_RETURN_STATUSES = ["completed", "cancelled"];
class SaleReturn extends sequelize_1.Model {
}
exports.SaleReturn = SaleReturn;
SaleReturn.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sale_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    return_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    refund_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.SALE_RETURN_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "SaleReturn",
    tableName: "sale_returns",
    updatedAt: false,
    indexes: [
        { fields: ["sale_id"] },
        { fields: ["customer_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["reference_code"] },
    ],
});
class SaleReturnItem extends sequelize_1.Model {
}
exports.SaleReturnItem = SaleReturnItem;
SaleReturnItem.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    sale_return_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    sale_item_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    rate: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    refund_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "SaleReturnItem",
    tableName: "sale_return_items",
    timestamps: false,
    indexes: [{ fields: ["sale_return_id"] }, { fields: ["sale_item_id"] }],
});
//# sourceMappingURL=SaleReturn.js.map