"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopModule = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ShopModule extends sequelize_1.Model {
}
exports.ShopModule = ShopModule;
ShopModule.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    module_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    module_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    is_enabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, {
    sequelize: database_1.default,
    modelName: "ShopModule",
    tableName: "shop_modules",
    timestamps: true,
    underscored: true,
    indexes: [
        { unique: true, fields: ["shop_id", "module_id"] },
    ],
});
//# sourceMappingURL=ShopModule.js.map