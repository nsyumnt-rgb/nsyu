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
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    is_system: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, {
    sequelize: database_1.default,
    modelName: "Role",
    tableName: "roles",
    indexes: [
        { unique: true, fields: ["owner_id", "name"] },
        { fields: ["owner_id"] },
    ],
});
//# sourceMappingURL=Role.js.map