import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const EMPLOYEE_LEDGER_ENTRY_TYPES = ["credit", "debit"] as const;
export type EmployeeLedgerEntryType = (typeof EMPLOYEE_LEDGER_ENTRY_TYPES)[number];

export const EMPLOYEE_LEDGER_ENTRY_STATUSES = ["active", "reversed"] as const;
export type EmployeeLedgerEntryStatus = (typeof EMPLOYEE_LEDGER_ENTRY_STATUSES)[number];

/**
 * Append-only employee salary ledger — same design as CustomerLedger.
 * running_balance = "Outstanding": the net amount the owner currently
 * owes this employee (negative would mean the employee owes the shop,
 * e.g. an unrecovered advance exceeding what they've earned since).
 *
 * entry_type: "credit" increases what's owed to the employee (Salary
 * earned, Incentive); "debit" decreases it (Advance given, Advance
 * Recovery, Deduction, Salary Payment).
 *
 * reference_type is one of: "Salary" | "Advance" | "AdvanceRecovery" |
 * "Incentive" | "Deduction" | "SalaryPayment" — matching the spec's
 * required ledger line types exactly. See utils/salaryLedger.ts.
 */
interface EmployeeLedgerAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  entry_type: EmployeeLedgerEntryType;
  amount: number;
  running_balance: number;
  reference_type: string;
  reference_id?: number | null;
  description: string;
  entry_date: Date;
  status: EmployeeLedgerEntryStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface EmployeeLedgerCreationAttributes
  extends Optional<EmployeeLedgerAttributes, "id" | "reference_id" | "status" | "reference_code"> {}

export class EmployeeLedger
  extends Model<EmployeeLedgerAttributes, EmployeeLedgerCreationAttributes>
  implements EmployeeLedgerAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public entry_type!: EmployeeLedgerEntryType;
  public amount!: number;
  public running_balance!: number;
  public reference_type!: string;
  public reference_id?: number | null;
  public description!: string;
  public entry_date!: Date;
  public status!: EmployeeLedgerEntryStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

EmployeeLedger.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    entry_type: { type: DataTypes.ENUM(...EMPLOYEE_LEDGER_ENTRY_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    running_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: false },
    reference_id: { type: DataTypes.BIGINT, allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: false },
    entry_date: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM(...EMPLOYEE_LEDGER_ENTRY_STATUSES), allowNull: false, defaultValue: "active" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "EmployeeLedger",
    tableName: "employee_ledger",
    updatedAt: false,
    indexes: [
      { fields: ["employee_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["reference_type", "reference_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
