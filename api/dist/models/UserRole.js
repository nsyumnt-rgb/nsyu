"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class UserRole extends sequelize_1.Model {
}
exports.UserRole = UserRole;
UserRole.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    user_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    role_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    is_active: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, {
    sequelize: database_1.default,
    modelName: "UserRole",
    tableName: "user_roles",
    timestamps: true,
    underscored: true,
    indexes: [
        { unique: true, fields: ["user_type", "user_id", "role_id", "shop_id"] },
    ],
});
//# sourceMappingURL=UserRole.js.map