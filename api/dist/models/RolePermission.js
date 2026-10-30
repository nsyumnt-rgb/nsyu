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
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    module_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    module: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    can_view: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_create: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_edit: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    can_delete: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    scope: { type: sequelize_1.DataTypes.STRING(50), defaultValue: "shop" },
}, {
    sequelize: database_1.default,
    modelName: "RolePermission",
    tableName: "role_permissions",
    timestamps: true,
    underscored: true,
});
exports.ALL_ACTIONS = permissions_1.ACTIONS;
//# sourceMappingURL=RolePermission.js.map