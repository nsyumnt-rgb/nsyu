"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ACTIONS = exports.RolePermission = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const permissions_1 = require("../config/permissions");
class RolePermission extends sequelize_1.Model {
}
exports.RolePermission = RolePermission;
RolePermission.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    role_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    module: { type: sequelize_1.DataTypes.ENUM(...permissions_1.MODULES), allowNull: false },
    can_view: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_create: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_edit: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_delete: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, {
    sequelize: database_1.default,
    modelName: "RolePermission",
    tableName: "role_permissions",
    indexes: [
        { unique: true, fields: ["role_id", "module"] },
        { fields: ["role_id"] },
    ],
});
// Exported for reference in seed / validation logic
exports.ALL_ACTIONS = permissions_1.ACTIONS;
//# sourceMappingURL=RolePermission.js.map