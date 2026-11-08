"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerRefreshToken = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class CustomerRefreshToken extends sequelize_1.Model {
}
exports.CustomerRefreshToken = CustomerRefreshToken;
CustomerRefreshToken.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    account_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    token_hash: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    device_info: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    revoked_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "CustomerRefreshToken",
    tableName: "customer_refresh_tokens",
    updatedAt: false,
    indexes: [
        { fields: ["account_id"] },
        { fields: ["token_hash"] },
        { fields: ["expires_at"] },
    ],
});
exports.default = CustomerRefreshToken;
//# sourceMappingURL=CustomerRefreshToken.js.map