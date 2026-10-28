"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRequest = exports.LEAVE_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"];
class LeaveRequest extends sequelize_1.Model {
}
exports.LeaveRequest = LeaveRequest;
LeaveRequest.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    leave_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    start_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    end_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    days: { type: sequelize_1.DataTypes.DECIMAL(5, 1), allowNull: false },
    reason: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    is_paid: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.LEAVE_STATUSES), allowNull: false, defaultValue: "Pending" },
    approved_by_actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: true },
    approved_by_actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: true },
    decision_note: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    decided_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "LeaveRequest",
    tableName: "leave_requests",
    indexes: [
        { fields: ["employee_id"] },
        { fields: ["owner_id", "shop_id"] },
        { fields: ["status"] },
        { fields: ["start_date", "end_date"] },
    ],
});
//# sourceMappingURL=LeaveRequest.js.map