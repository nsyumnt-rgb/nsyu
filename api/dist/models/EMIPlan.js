"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMIPlan = exports.EMI_PLAN_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.EMI_PLAN_STATUSES = ["active", "completed", "cancelled"];
class EMIPlan extends sequelize_1.Model {
}
exports.EMIPlan = EMIPlan;
EMIPlan.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sale_id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, allowNull: false },
    customer_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    total_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    down_payment: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    financed_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    interest_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    interest_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payable_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    number_of_installments: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    emi_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    start_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    late_fee_percent: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    outstanding_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.EMI_PLAN_STATUSES), allowNull: false, defaultValue: "active" },
    cancel_reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "EMIPlan",
    tableName: "emi_plans",
    indexes: [
        { unique: true, fields: ["sale_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["customer_id"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=EMIPlan.js.map