import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const ADVANCE_STATUSES = ["outstanding", "partially_recovered", "recovered", "cancelled"] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

/**
 * A salary advance disbursed to an employee. `outstanding_amount`
 * tracks how much of the PRINCIPAL still needs to be recovered
 * through future payroll runs (see utils/payroll.ts) — this is
 * distinct from EmployeeLedger.running_balance, which tracks the net
 * amount owed overall; the two intentionally don't collapse into one
 * number because "how much advance is left to recover" is a separate
 * question from "what's the employee's current payable balance".
 */
interface EmployeeAdvanceAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  amount: number;
  outstanding_amount: number;
  date: Date;
  reason?: string | null;
  method: string; // cash | upi | bank_transfer | cheque | other
  status: AdvanceStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
}

interface EmployeeAdvanceCreationAttributes
  extends Optional<EmployeeAdvanceAttributes, "id" | "outstanding_amount" | "reason" | "status"> {}

export class EmployeeAdvance
  extends Model<EmployeeAdvanceAttributes, EmployeeAdvanceCreationAttributes>
  implements EmployeeAdvanceAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public amount!: number;
  public outstanding_amount!: number;
  public date!: Date;
  public reason?: string | null;
  public method!: string;
  public status!: AdvanceStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmployeeAdvance.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    outstanding_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    date: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    method: { type: DataTypes.STRING(30), allowNull: false },
    status: { type: DataTypes.ENUM(...ADVANCE_STATUSES), allowNull: false, defaultValue: "outstanding" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "EmployeeAdvance",
    tableName: "employee_advances",
    indexes: [{ fields: ["employee_id"] }, { fields: ["owner_id", "shop_id"] }, { fields: ["status"] }],
  }
);
