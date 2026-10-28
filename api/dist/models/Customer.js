"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Customer = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Customer extends sequelize_1.Model {
}
exports.Customer = Customer;
Customer.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING(20), allowNull: true },
    email: { type: sequelize_1.DataTypes.STRING(150), allowNull: true },
    address: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    gstin: { type: sequelize_1.DataTypes.STRING(30), allowNull: true },
    opening_balance: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    current_balance: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Customer",
    tableName: "customers",
    indexes: [{ fields: ["owner_id"] }, { fields: ["owner_id", "phone"] }, { fields: ["reference_code"] }],
});
//# sourceMappingURL=Customer.js.map