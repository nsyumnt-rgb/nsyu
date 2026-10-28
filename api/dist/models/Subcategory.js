"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subcategory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Subcategory extends sequelize_1.Model {
}
exports.Subcategory = Subcategory;
Subcategory.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    category_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Subcategory",
    tableName: "subcategories",
    indexes: [
        { unique: true, fields: ["category_id", "name"] },
        { fields: ["owner_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Subcategory.js.map