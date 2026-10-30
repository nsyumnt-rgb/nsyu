"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Role extends sequelize_1.Model {
}
exports.Role = Role;
Role.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true, unique: true },
    name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    is_system: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, {
    sequelize: database_1.default,
    modelName: "Role",
    tableName: "roles",
    timestamps: true,
    underscored: true,
});
//# sourceMappingURL=Role.js.map