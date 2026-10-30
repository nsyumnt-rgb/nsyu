"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductStock = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ProductStock extends sequelize_1.Model {
}
exports.ProductStock = ProductStock;
ProductStock.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    current_stock: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    min_stock: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "ProductStock",
    tableName: "product_stocks",
    indexes: [{ unique: true, fields: ["product_id", "shop_id"] }, { fields: ["owner_id", "shop_id"] }],
});
//# sourceMappingURL=ProductStock.js.map