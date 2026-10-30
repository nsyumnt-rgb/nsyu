"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierPayment = exports.SUPPLIER_PAYMENT_STATUSES = exports.SUPPLIER_PAYMENT_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Sale_1 = require("./Sale");
exports.SUPPLIER_PAYMENT_TYPES = ["purchase_payment", "refund"];
exports.SUPPLIER_PAYMENT_STATUSES = ["completed", "cancelled"];
class SupplierPayment extends sequelize_1.Model {
}
exports.SupplierPayment = SupplierPayment;
SupplierPayment.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    supplier_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    purchase_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    type: { type: sequelize_1.DataTypes.ENUM(...exports.SUPPLIER_PAYMENT_TYPES), allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: sequelize_1.DataTypes.ENUM(...Sale_1.PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
    payment_date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    notes: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.SUPPLIER_PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "SupplierPayment",
    tableName: "supplier_payments",
    indexes: [{ fields: ["owner_id", "shop_id"] }, { fields: ["supplier_id"] }, { fields: ["purchase_id"] }],
});
//# sourceMappingURL=SupplierPayment.js.map