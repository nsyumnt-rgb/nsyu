import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const EMI_PLAN_STATUSES = ["active", "completed", "cancelled"] as const;
export type EmiPlanStatus = (typeof EMI_PLAN_STATUSES)[number];

/**
 * One EMIPlan per EMI Sale (1:1 with Sale when Sale.is_emi = true).
 *
 *   financed_amount = total_amount - down_payment
 *   interest_amount = financed_amount * interest_percent / 100   (flat/simple interest,
 *                                                                  computed once at creation)
 *   payable_amount  = financed_amount + interest_amount           (split across installments)
 *   outstanding_amount = live sum of remaining_amount across all
 *                         non-cancelled EMIInstallments — kept in
 *                         sync by emiController on every installment
 *                         payment, and mirrored onto Sale.due_amount.
 *
 * late_fee_percent (of an installment's expected_amount) is applied
 * automatically the first time a given installment is paid after its
 * due_date — see emiController.payInstallment.
 */
interface EMIPlanAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  sale_id: number;
  customer_id: number;
  total_amount: number;
  down_payment: number;
  financed_amount: number;
  interest_percent: number;
  interest_amount: number;
  payable_amount: number;
  number_of_installments: number;
  emi_amount: number;
  start_date: Date;
  late_fee_percent: number;
  outstanding_amount: number;
  status: EmiPlanStatus;
  cancel_reason?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface EMIPlanCreationAttributes
  extends Optional<
    EMIPlanAttributes,
    "id" | "interest_percent" | "interest_amount" | "late_fee_percent" | "status" | "cancel_reason" | "reference_code"
  > {}

export class EMIPlan extends Model<EMIPlanAttributes, EMIPlanCreationAttributes> implements EMIPlanAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public sale_id!: number;
  public customer_id!: number;
  public total_amount!: number;
  public down_payment!: number;
  public financed_amount!: number;
  public interest_percent!: number;
  public interest_amount!: number;
  public payable_amount!: number;
  public number_of_installments!: number;
  public emi_amount!: number;
  public start_date!: Date;
  public late_fee_percent!: number;
  public outstanding_amount!: number;
  public status!: EmiPlanStatus;
  public cancel_reason?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EMIPlan.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    sale_id: { type: DataTypes.BIGINT, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    down_payment: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    financed_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    interest_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    interest_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payable_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    number_of_installments: { type: DataTypes.INTEGER, allowNull: false },
    emi_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    late_fee_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    outstanding_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: DataTypes.ENUM(...EMI_PLAN_STATUSES), allowNull: false, defaultValue: "active" },
    cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "EMIPlan",
    tableName: "emi_plans",
    indexes: [
      { unique: true, fields: ["sale_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["customer_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
