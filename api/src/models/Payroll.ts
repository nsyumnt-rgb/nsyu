import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { SalaryType } from "./SalaryConfig";

export const PAYROLL_STATUSES = ["draft", "finalized", "partially_paid", "paid", "cancelled"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/**
 * One payroll run = one employee's salary for one cycle (period_start
 * .. period_end). Computed by utils/payroll.ts from Attendance +
 * SalaryConfig + EmployeeIncentive + EmployeeAdvance for that period,
 * then persisted here so the figures are frozen (re-running payroll
 * for an already-finalized period does not silently change past pay).
 *
 *   gross_salary = prorated_basic + prorated_allowances + overtime_amount + incentive_amount
 *   net_salary   = gross_salary - other_deduction - advance_deduction
 *   due_amount   = net_salary - paid_amount
 *
 * status: draft (calculated, not yet confirmed) -> finalized (confirmed,
 * posts to EmployeeLedger, advance/incentive rows get consumed) ->
 * partially_paid / paid as SalaryPayments are recorded. cancelled
 * reverses the ledger postings rather than deleting the row.
 */
interface PayrollAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  period_start: string; // DATEONLY
  period_end: string; // DATEONLY
  salary_type: SalaryType;
  present_days: number;
  absent_days: number;
  half_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  holiday_days: number;
  week_off_days: number;
  payable_days: number;
  total_days: number;
  overtime_hours: number;
  overtime_amount: number;
  basic_salary: number;
  allowances: number;
  incentive_amount: number;
  gross_salary: number;
  other_deduction: number;
  advance_deduction: number;
  net_salary: number;
  paid_amount: number;
  due_amount: number;
  status: PayrollStatus;
  notes?: string | null;
  cancel_reason?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface PayrollCreationAttributes
  extends Optional<
    PayrollAttributes,
    | "id"
    | "present_days"
    | "absent_days"
    | "half_days"
    | "paid_leave_days"
    | "unpaid_leave_days"
    | "holiday_days"
    | "week_off_days"
    | "overtime_hours"
    | "overtime_amount"
    | "incentive_amount"
    | "other_deduction"
    | "advance_deduction"
    | "paid_amount"
    | "due_amount"
    | "status"
    | "notes"
    | "cancel_reason"
    | "reference_code"
  > {}

export class Payroll extends Model<PayrollAttributes, PayrollCreationAttributes> implements PayrollAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public period_start!: string;
  public period_end!: string;
  public salary_type!: SalaryType;
  public present_days!: number;
  public absent_days!: number;
  public half_days!: number;
  public paid_leave_days!: number;
  public unpaid_leave_days!: number;
  public holiday_days!: number;
  public week_off_days!: number;
  public payable_days!: number;
  public total_days!: number;
  public overtime_hours!: number;
  public overtime_amount!: number;
  public basic_salary!: number;
  public allowances!: number;
  public incentive_amount!: number;
  public gross_salary!: number;
  public other_deduction!: number;
  public advance_deduction!: number;
  public net_salary!: number;
  public paid_amount!: number;
  public due_amount!: number;
  public status!: PayrollStatus;
  public notes?: string | null;
  public cancel_reason?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Payroll.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    period_start: { type: DataTypes.DATEONLY, allowNull: false },
    period_end: { type: DataTypes.DATEONLY, allowNull: false },
    salary_type: { type: DataTypes.ENUM("monthly", "weekly", "daily", "hourly", "commission"), allowNull: false },
    present_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    absent_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    half_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    paid_leave_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    unpaid_leave_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    holiday_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    week_off_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    payable_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    total_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    overtime_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    basic_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allowances: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    incentive_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    gross_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    other_deduction: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    advance_deduction: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    net_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...PAYROLL_STATUSES), allowNull: false, defaultValue: "draft" },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Payroll",
    tableName: "payrolls",
    indexes: [
      { unique: true, fields: ["employee_id", "period_start", "period_end"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
