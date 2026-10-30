import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const SALARY_PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "cheque", "other"] as const;
export type SalaryPaymentMethod = (typeof SALARY_PAYMENT_METHODS)[number];

export const SALARY_PAYMENT_STATUSES = ["completed", "cancelled"] as const;
export type SalaryPaymentStatus = (typeof SALARY_PAYMENT_STATUSES)[number];

/**
 * A cash-out event against a finalized Payroll (a salary payment).
 * Cash/UPI/Bank Transfer/Cheque/Other — no "card" (salary isn't
 * typically card-paid; keep this list distinct from Sale's
 * PAYMENT_METHODS on purpose).
 */
interface SalaryPaymentAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  payroll_id: number;
  amount: number;
  method: SalaryPaymentMethod;
  transaction_id?: string | null;
  payment_date: Date;
  notes?: string | null;
  status: SalaryPaymentStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
}

interface SalaryPaymentCreationAttributes
  extends Optional<SalaryPaymentAttributes, "id" | "transaction_id" | "notes" | "status"> {}

export class SalaryPayment
  extends Model<SalaryPaymentAttributes, SalaryPaymentCreationAttributes>
  implements SalaryPaymentAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public employee_id!: number;
  public payroll_id!: number;
  public amount!: number;
  public method!: SalaryPaymentMethod;
  public transaction_id?: string | null;
  public payment_date!: Date;
  public notes?: string | null;
  public status!: SalaryPaymentStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SalaryPayment.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    payroll_id: { type: DataTypes.BIGINT, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: DataTypes.ENUM(...SALARY_PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: DataTypes.STRING(100), allowNull: true },
    payment_date: { type: DataTypes.DATE, allowNull: false },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM(...SALARY_PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "SalaryPayment",
    tableName: "salary_payments",
    indexes: [{ fields: ["employee_id"] }, { fields: ["payroll_id"] }, { fields: ["owner_id", "shop_id"] }],
  }
);
