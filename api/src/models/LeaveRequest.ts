import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * A leave request raised by an employee (self-service) and
 * approved/rejected by an owner or a manager holding "leave" edit
 * permission. `is_paid` decides whether the days it covers count as
 * Paid Leave or Unpaid Leave in payroll (see utils/payroll.ts) — set
 * by the approver at approval time, defaulting to the leave type's
 * usual convention (e.g. "Unpaid" type defaults unpaid) but always
 * overridable.
 *
 * Approving a leave also stamps matching Attendance rows for each
 * date in the range with status="Leave" (see leaveController), so
 * attendance and leave never disagree about a given day.
 */
interface LeaveRequestAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  leave_type: string; // e.g. "Casual", "Sick", "Paid", "Unpaid" — free-form, owner-defined
  start_date: string; // DATEONLY
  end_date: string; // DATEONLY
  days: number;
  reason?: string | null;
  is_paid: boolean;
  status: LeaveStatus;
  approved_by_actor_type?: "owner" | "employee" | null;
  approved_by_actor_id?: number | null;
  decision_note?: string | null;
  decided_at?: Date | null;
}

interface LeaveRequestCreationAttributes
  extends Optional<
    LeaveRequestAttributes,
    | "id"
    | "reason"
    | "is_paid"
    | "status"
    | "approved_by_actor_type"
    | "approved_by_actor_id"
    | "decision_note"
    | "decided_at"
  > {}

export class LeaveRequest
  extends Model<LeaveRequestAttributes, LeaveRequestCreationAttributes>
  implements LeaveRequestAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public leave_type!: string;
  public start_date!: string;
  public end_date!: string;
  public days!: number;
  public reason?: string | null;
  public is_paid!: boolean;
  public status!: LeaveStatus;
  public approved_by_actor_type?: "owner" | "employee" | null;
  public approved_by_actor_id?: number | null;
  public decision_note?: string | null;
  public decided_at?: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

LeaveRequest.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    leave_type: { type: DataTypes.STRING(50), allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    days: { type: DataTypes.DECIMAL(5, 1), allowNull: false },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    is_paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM(...LEAVE_STATUSES), allowNull: false, defaultValue: "Pending" },
    approved_by_actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: true },
    approved_by_actor_id: { type: DataTypes.INTEGER, allowNull: true },
    decision_note: { type: DataTypes.STRING(255), allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "LeaveRequest",
    tableName: "leave_requests",
    indexes: [
      { fields: ["employee_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["status"] },
      { fields: ["start_date", "end_date"] },
    ],
  }
);
