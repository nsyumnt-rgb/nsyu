"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseItem = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class PurchaseItem extends sequelize_1.Model {
}
exports.PurchaseItem = PurchaseItem;
PurchaseItem.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    purchase_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    product_name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    sku: { type: sequelize_1.DataTypes.STRING(60), allowNull: false },
    quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    rate: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    discount_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    returned_quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
    sequelize: database_1.default,
    modelName: "PurchaseItem",
    tableName: "purchase_items",
    timestamps: false,
    indexes: [{ fields: ["purchase_id"] }, { fields: ["product_id"] }],
});
//# sourceMappingURL=PurchaseItem.js.map