"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductLocation = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ProductLocation extends sequelize_1.Model {
}
exports.ProductLocation = ProductLocation;
ProductLocation.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    rack: { type: sequelize_1.DataTypes.STRING(50) },
    shelf: { type: sequelize_1.DataTypes.STRING(50) },
    bin: { type: sequelize_1.DataTypes.STRING(50) },
    is_current: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    set_by_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    set_by_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "ProductLocation",
    tableName: "product_locations",
    updatedAt: false,
    indexes: [{ fields: ["product_id", "shop_id"] }, { fields: ["product_id", "shop_id", "is_current"] }],
});
//# sourceMappingURL=ProductLocation.js.map