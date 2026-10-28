import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { PAYMENT_METHODS, PaymentMethod } from "./Sale";

export const EMI_INSTALLMENT_STATUSES = [
  "Upcoming",
  "Due",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
] as const;
export type EmiInstallmentStatus = (typeof EMI_INSTALLMENT_STATUSES)[number];

/**
 * One row per scheduled installment of an EMIPlan.
 *
 *   remaining_amount = (expected_amount + late_fee) - paid_amount
 *
 * `status` is persisted (not purely computed) but is kept fresh by
 * utils/emi.ts::refreshInstallmentStatus, which every read path
 * (emiController list/get) calls before returning data, and every
 * write path (payInstallment) calls after applying a payment. This
 * keeps "Overdue" accurate against the current date without needing
 * a cron job, while still letting other tables filter/join on a
 * real, indexed status column.
 */
interface EMIInstallmentAttributes {
  id: number;
  emi_plan_id: number;
  installment_number: number;
  due_date: Date;
  expected_amount: number;
  paid_amount: number;
  payment_date?: Date | null;
  payment_method?: PaymentMethod | null;
  transaction_id?: string | null;
  late_fee: number;
  remaining_amount: number;
  status: EmiInstallmentStatus;
}

interface EMIInstallmentCreationAttributes
  extends Optional<
    EMIInstallmentAttributes,
    "id" | "paid_amount" | "payment_date" | "payment_method" | "transaction_id" | "late_fee" | "status"
  > {}

export class EMIInstallment
  extends Model<EMIInstallmentAttributes, EMIInstallmentCreationAttributes>
  implements EMIInstallmentAttributes
{
  public id!: number;
  public emi_plan_id!: number;
  public installment_number!: number;
  public due_date!: Date;
  public expected_amount!: number;
  public paid_amount!: number;
  public payment_date?: Date | null;
  public payment_method?: PaymentMethod | null;
  public transaction_id?: string | null;
  public late_fee!: number;
  public remaining_amount!: number;
  public status!: EmiInstallmentStatus;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EMIInstallment.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    emi_plan_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    installment_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    due_date: { type: DataTypes.DATEONLY, allowNull: false },
    expected_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_date: { type: DataTypes.DATE, allowNull: true },
    payment_method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: true },
    transaction_id: { type: DataTypes.STRING(100), allowNull: true },
    late_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    remaining_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: DataTypes.ENUM(...EMI_INSTALLMENT_STATUSES), allowNull: false, defaultValue: "Upcoming" },
  },
  {
    sequelize,
    modelName: "EMIInstallment",
    tableName: "emi_installments",
    indexes: [
      { unique: true, fields: ["emi_plan_id", "installment_number"] },
      { fields: ["due_date"] },
      { fields: ["status"] },
    ],
  }
);
