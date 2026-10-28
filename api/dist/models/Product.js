"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Product extends sequelize_1.Model {
}
exports.Product = Product;
Product.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    sku: { type: sequelize_1.DataTypes.STRING(60), allowNull: false },
    barcode: { type: sequelize_1.DataTypes.STRING(60) },
    category_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    subcategory_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    brand: { type: sequelize_1.DataTypes.STRING(100) },
    description: { type: sequelize_1.DataTypes.TEXT },
    purchase_price: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    selling_price: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    mrp: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    min_stock: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    supplier_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Product",
    tableName: "products",
    indexes: [
        { unique: true, fields: ["owner_id", "sku"] },
        { fields: ["owner_id"] },
        { fields: ["category_id"] },
        { fields: ["supplier_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Product.js.map