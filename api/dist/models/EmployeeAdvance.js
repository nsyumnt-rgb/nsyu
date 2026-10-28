"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeAdvance = exports.ADVANCE_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.ADVANCE_STATUSES = ["outstanding", "partially_recovered", "recovered", "cancelled"];
class EmployeeAdvance extends sequelize_1.Model {
}
exports.EmployeeAdvance = EmployeeAdvance;
EmployeeAdvance.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false },
    outstanding_amount: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    date: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    method: { type: sequelize_1.DataTypes.STRING(30), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.ADVANCE_STATUSES), allowNull: false, defaultValue: "outstanding" },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "EmployeeAdvance",
    tableName: "employee_advances",
    indexes: [{ fields: ["employee_id"] }, { fields: ["owner_id", "shop_id"] }, { fields: ["status"] }],
});
//# sourceMappingURL=EmployeeAdvance.js.map