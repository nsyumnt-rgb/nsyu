"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockTransfer = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class StockTransfer extends sequelize_1.Model {
}
exports.StockTransfer = StockTransfer;
StockTransfer.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    from_shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    to_shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    transfer_no: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    status: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "completed",
    },
    items: { type: sequelize_1.DataTypes.JSONB, allowNull: true },
    received_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    cancelled_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    cancellation_reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "StockTransfer",
    tableName: "stock_transfers",
    updatedAt: "updated_at",
    createdAt: "created_at",
    indexes: [
        { fields: ["product_id"] },
        { fields: ["owner_id"] },
        { fields: ["transfer_no"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=StockTransfer.js.map