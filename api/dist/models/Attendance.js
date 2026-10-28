"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendance = exports.ATTENDANCE_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.ATTENDANCE_STATUSES = [
    "Present",
    "Absent",
    "Half Day",
    "Leave",
    "Holiday",
    "Week Off",
    "Late",
];
class Attendance extends sequelize_1.Model {
}
exports.Attendance = Attendance;
Attendance.init({
    id: { type: sequelize_1.DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    check_in: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    check_out: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    working_hours: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: sequelize_1.DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM(...exports.ATTENDANCE_STATUSES), allowNull: false, defaultValue: "Present" },
    remarks: { type: sequelize_1.DataTypes.STRING(255), allowNull: true },
    marked_by_actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    marked_by_actor_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Attendance",
    tableName: "attendance",
    indexes: [
        { unique: true, fields: ["employee_id", "date"] },
        { fields: ["owner_id", "shop_id", "date"] },
        { fields: ["status"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Attendance.js.map