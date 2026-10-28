"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTransaction = exports.MOVEMENT_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.MOVEMENT_TYPES = [
    "opening",
    "purchase",
    "sale",
    "customer_return",
    "purchase_return", // goods physically leaving to go back to a supplier — added for the Purchase module, decreasing
    "damage",
    "adjustment",
    "transfer_in",
    "transfer_out",
];
class InventoryTransaction extends sequelize_1.Model {
}
exports.InventoryTransaction = InventoryTransaction;
InventoryTransaction.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: sequelize_1.DataTypes.ENUM(...exports.MOVEMENT_TYPES), allowNull: false },
    signed_quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    balance_after: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reference_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    reference_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "InventoryTransaction",
    tableName: "inventory_transactions",
    updatedAt: false,
    indexes: [
        { fields: ["product_id", "shop_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["type"] },
        { fields: ["reference_type", "reference_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=InventoryTransaction.js.map