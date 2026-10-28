import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const INCENTIVE_TYPES = ["fixed", "percentage"] as const;
export type IncentiveType = (typeof INCENTIVE_TYPES)[number];

export const INCENTIVE_BASES = ["sales", "profit", "product", "category", "other"] as const;
export type IncentiveBasis = (typeof INCENTIVE_BASES)[number];

export const INCENTIVE_STATUSES = ["pending", "included_in_payroll", "paid", "cancelled"] as const;
export type IncentiveStatus = (typeof INCENTIVE_STATUSES)[number];

/**
 * A one-off incentive/commission entry for an employee, covering a
 * period (e.g. a month). Two shapes:
 *
 *  - type="fixed": `computed_amount` = `amount` directly.
 *  - type="percentage": owner/manager supplies `base_amount` (the
 *    sales/profit/product/category total this commission is computed
 *    against — pulled from Sales reports outside this module and
 *    entered here) and `percent`; `computed_amount` = base_amount *
 *    percent / 100. `basis` just labels what base_amount represents,
 *    for the payslip/ledger description.
 *
 * Once a payroll run includes this incentive in its gross_salary
 * calculation, status flips to "included_in_payroll" (see
 * utils/payroll.ts) so it can't be double-counted in a later run.
 */
interface EmployeeIncentiveAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  type: IncentiveType;
  basis: IncentiveBasis;
  base_amount: number; // only meaningful for type="percentage"
  percent: number; // only meaningful for type="percentage"
  amount: number; // only meaningful for type="fixed"
  computed_amount: number;
  period_start: string; // DATEONLY
  period_end: string; // DATEONLY
  description?: string | null;
  status: IncentiveStatus;
  payroll_id?: number | null;
  actor_type: "owner" | "employee";
  actor_id: number;
}

interface EmployeeIncentiveCreationAttributes
  extends Optional<
    EmployeeIncentiveAttributes,
    "id" | "base_amount" | "percent" | "amount" | "description" | "status" | "payroll_id"
  > {}

export class EmployeeIncentive
  extends Model<EmployeeIncentiveAttributes, EmployeeIncentiveCreationAttributes>
  implements EmployeeIncentiveAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public type!: IncentiveType;
  public basis!: IncentiveBasis;
  public base_amount!: number;
  public percent!: number;
  public amount!: number;
  public computed_amount!: number;
  public period_start!: string;
  public period_end!: string;
  public description?: string | null;
  public status!: IncentiveStatus;
  public payroll_id?: number | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmployeeIncentive.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.ENUM(...INCENTIVE_TYPES), allowNull: false },
    basis: { type: DataTypes.ENUM(...INCENTIVE_BASES), allowNull: false, defaultValue: "other" },
    base_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    computed_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    period_start: { type: DataTypes.DATEONLY, allowNull: false },
    period_end: { type: DataTypes.DATEONLY, allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM(...INCENTIVE_STATUSES), allowNull: false, defaultValue: "pending" },
    payroll_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  {
    sequelize,
    modelName: "EmployeeIncentive",
    tableName: "employee_incentives",
    indexes: [
      { fields: ["employee_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["status"] },
      { fields: ["period_start", "period_end"] },
    ],
  }
);
