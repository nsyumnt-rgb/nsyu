"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Permission extends sequelize_1.Model {
}
exports.Permission = Permission;
Permission.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    module_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    module_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    code: { type: sequelize_1.DataTypes.STRING(100), allowNull: false, unique: true },
    action: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Permission",
    tableName: "permissions",
    timestamps: true,
    underscored: true,
});
//# sourceMappingURL=Permission.js.map