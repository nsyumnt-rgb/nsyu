"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerOtp = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class CustomerOtp extends sequelize_1.Model {
}
exports.CustomerOtp = CustomerOtp;
CustomerOtp.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    account_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    phone: { type: sequelize_1.DataTypes.STRING(20), allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    otp_hash: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    attempts: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    used_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "CustomerOtp",
    tableName: "customer_otps",
    updatedAt: false,
    indexes: [
        { fields: ["phone", "shop_id"] },
        { fields: ["account_id"] },
        { fields: ["expires_at"] },
    ],
});
exports.default = CustomerOtp;
//# sourceMappingURL=CustomerOtp.js.map