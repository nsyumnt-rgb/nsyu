"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Supplier = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Supplier extends sequelize_1.Model {
}
exports.Supplier = Supplier;
Supplier.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING(20) },
    email: { type: sequelize_1.DataTypes.STRING(150) },
    address: { type: sequelize_1.DataTypes.STRING(255) },
    gstin: { type: sequelize_1.DataTypes.STRING(30), allowNull: true },
    current_balance: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, { sequelize: database_1.default, modelName: "Supplier", tableName: "suppliers", indexes: [{ fields: ["owner_id"] }, { fields: ["reference_code"] }] });
//# sourceMappingURL=Supplier.js.map