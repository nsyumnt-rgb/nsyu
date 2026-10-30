import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const SALARY_TYPES = ["monthly", "weekly", "daily", "hourly", "commission"] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export const SALARY_CYCLES = ["monthly", "weekly", "daily"] as const;
export type SalaryCycle = (typeof SALARY_CYCLES)[number];

/**
 * An employee's salary structure. Kept as an append-only, date-effective
 * history (never edited in place) so past payroll runs always reflect
 * the rules that were actually in force at the time — changing an
 * employee's salary creates a NEW row with a later effective_date and
 * marks the old one inactive, rather than mutating history.
 *
 * `basic_salary`'s unit depends on salary_type: monthly = per month,
 * weekly = per week, daily = per day, hourly = per hour worked,
 * commission = base retainer (can be 0) with earnings driven by
 * EmployeeIncentive commission entries instead.
 */
interface SalaryConfigAttributes {
  id: number;
  owner_id: number;
  employee_id: number;
  salary_type: SalaryType;
  basic_salary: number;
  allowances: number;
  overtime_rate: number; // per overtime hour
  incentive: number; // default fixed incentive per cycle, if any (on top of ad-hoc EmployeeIncentive rows)
  commission_percent: number; // default commission %, used when type = commission and no per-incentive override given
  deductions: number; // default recurring deduction per cycle (e.g. uniform, mess) — separate from advance recovery
  salary_cycle: SalaryCycle;
  effective_date: string; // DATEONLY
  is_active: boolean;
  notes?: string | null;
}

interface SalaryConfigCreationAttributes
  extends Optional<
    SalaryConfigAttributes,
    "id" | "allowances" | "overtime_rate" | "incentive" | "commission_percent" | "deductions" | "is_active" | "notes"
  > {}

export class SalaryConfig
  extends Model<SalaryConfigAttributes, SalaryConfigCreationAttributes>
  implements SalaryConfigAttributes
{
  public id!: number;
  public owner_id!: number;
  public employee_id!: number;
  public salary_type!: SalaryType;
  public basic_salary!: number;
  public allowances!: number;
  public overtime_rate!: number;
  public incentive!: number;
  public commission_percent!: number;
  public deductions!: number;
  public salary_cycle!: SalaryCycle;
  public effective_date!: string;
  public is_active!: boolean;
  public notes?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SalaryConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    salary_type: { type: DataTypes.ENUM(...SALARY_TYPES), allowNull: false },
    basic_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allowances: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    overtime_rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    incentive: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    commission_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    deductions: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    salary_cycle: { type: DataTypes.ENUM(...SALARY_CYCLES), allowNull: false, defaultValue: "monthly" },
    effective_date: { type: DataTypes.DATEONLY, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    modelName: "SalaryConfig",
    tableName: "salary_configs",
    indexes: [{ fields: ["employee_id"] }, { fields: ["employee_id", "effective_date"] }, { fields: ["owner_id"] }],
  }
);
