"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAccount = exports.CUSTOMER_ACCOUNT_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.CUSTOMER_ACCOUNT_STATUSES = ["pending_approval", "active", "disabled"];
class CustomerAccount extends sequelize_1.Model {
}
exports.CustomerAccount = CustomerAccount;
CustomerAccount.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    customer_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, unique: true },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING(20), allowNull: false },
    status: {
        type: sequelize_1.DataTypes.ENUM(...exports.CUSTOMER_ACCOUNT_STATUSES),
        allowNull: false,
        defaultValue: "active",
    },
    password_hash: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    last_login_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    created_by: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    approved_by: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "CustomerAccount",
    tableName: "customer_accounts",
    indexes: [
        { unique: true, fields: ["customer_id"] },
        { fields: ["shop_id", "phone"] },
        { fields: ["owner_id"] },
        { fields: ["status"] },
    ],
});
exports.default = CustomerAccount;
//# sourceMappingURL=CustomerAccount.js.map