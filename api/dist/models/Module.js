"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Module = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Module extends sequelize_1.Model {
}
exports.Module = Module;
Module.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: sequelize_1.DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    icon: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, {
    sequelize: database_1.default,
    modelName: "Module",
    tableName: "modules",
    timestamps: true,
    underscored: true,
});
//# sourceMappingURL=Module.js.map