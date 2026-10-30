"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductImage = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ProductImage extends sequelize_1.Model {
}
exports.ProductImage = ProductImage;
ProductImage.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    url: { type: sequelize_1.DataTypes.STRING(500), allowNull: false },
    is_primary: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize: database_1.default, modelName: "ProductImage", tableName: "product_images", indexes: [{ fields: ["product_id"] }] });
//# sourceMappingURL=ProductImage.js.map