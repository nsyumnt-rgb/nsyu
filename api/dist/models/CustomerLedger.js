"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerLedger = exports.LEDGER_ENTRY_STATUSES = exports.LEDGER_ENTRY_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.LEDGER_ENTRY_TYPES = ["debit", "credit"];
exports.LEDGER_ENTRY_STATUSES = ["active", "reversed"];
class CustomerLedger extends sequelize_1.Model {
}
exports.CustomerLedger = CustomerLedger;
CustomerLedger.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    entry_type: { type: sequelize_1.DataTypes.ENUM(...exports.LEDGER_ENTRY_TYPES), allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    running_balance: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    reference_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    reference_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    description: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    entry_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.LEDGER_ENTRY_STATUSES), allowNull: false, defaultValue: "active" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "CustomerLedger",
    tableName: "customer_ledger",
    updatedAt: false,
    indexes: [
        { fields: ["customer_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["reference_type", "reference_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=CustomerLedger.js.map