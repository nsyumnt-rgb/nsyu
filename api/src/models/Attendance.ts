import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "Leave",
  "Holiday",
  "Week Off",
  "Late",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * One row per (employee, date). check_in/check_out are self-service
 * (an employee punches their own), while `status`/`remarks` can also
 * be set/overridden by an owner/manager (e.g. marking a Holiday or
 * Week Off in bulk, or correcting a missed punch) — see
 * attendanceController for exactly which fields each caller may touch.
 *
 * working_hours is computed from check_in/check_out whenever both are
 * present (see utils/attendance.ts), and is what payroll's Hourly
 * salary type and Overtime calculations read from.
 */
interface AttendanceAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  date: string; // DATEONLY, "YYYY-MM-DD"
  check_in?: Date | null;
  check_out?: Date | null;
  working_hours: number;
  overtime_hours: number;
  status: AttendanceStatus;
  remarks?: string | null;
  marked_by_actor_type: "owner" | "employee";
  marked_by_actor_id: number;
  reference_code?: string | null;
}

interface AttendanceCreationAttributes
  extends Optional<
    AttendanceAttributes,
    "id" | "check_in" | "check_out" | "working_hours" | "overtime_hours" | "remarks" | "reference_code"
  > {}

export class Attendance
  extends Model<AttendanceAttributes, AttendanceCreationAttributes>
  implements AttendanceAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public date!: string;
  public check_in?: Date | null;
  public check_out?: Date | null;
  public working_hours!: number;
  public overtime_hours!: number;
  public status!: AttendanceStatus;
  public remarks?: string | null;
  public marked_by_actor_type!: "owner" | "employee";
  public marked_by_actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Attendance.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    check_in: { type: DataTypes.DATE, allowNull: true },
    check_out: { type: DataTypes.DATE, allowNull: true },
    working_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...ATTENDANCE_STATUSES), allowNull: false, defaultValue: "Present" },
    remarks: { type: DataTypes.STRING(255), allowNull: true },
    marked_by_actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    marked_by_actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Attendance",
    tableName: "attendance",
    indexes: [
      { unique: true, fields: ["employee_id", "date"] },
      { fields: ["owner_id", "shop_id", "date"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
