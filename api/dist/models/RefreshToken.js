"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshToken = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class RefreshToken extends sequelize_1.Model {
}
exports.RefreshToken = RefreshToken;
RefreshToken.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    token: { type: sequelize_1.DataTypes.STRING(500), allowNull: false, unique: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    revoked: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize: database_1.default, modelName: "RefreshToken", tableName: "refresh_tokens" });
//# sourceMappingURL=RefreshToken.js.map