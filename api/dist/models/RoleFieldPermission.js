"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleFieldPermission = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const permissions_1 = require("../config/permissions");
class RoleFieldPermission extends sequelize_1.Model {
}
exports.RoleFieldPermission = RoleFieldPermission;
RoleFieldPermission.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    field: { type: sequelize_1.DataTypes.ENUM(...permissions_1.SENSITIVE_FIELDS), allowNull: false },
    allowed: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, {
    sequelize: database_1.default,
    modelName: "RoleFieldPermission",
    tableName: "role_field_permissions",
    indexes: [
        { unique: true, fields: ["role_id", "field"] },
        { fields: ["role_id"] },
    ],
});
//# sourceMappingURL=RoleFieldPermission.js.map