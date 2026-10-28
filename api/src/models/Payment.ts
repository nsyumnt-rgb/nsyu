import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { PAYMENT_METHODS, PaymentMethod } from "./Sale";

export const PAYMENT_TYPES = ["sale_payment", "down_payment", "emi_payment", "refund"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ["completed", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Every rupee that moves between customer and shop — sale payments
 * (full or partial), EMI installment payments, down payments, and
 * refunds — is one row here. Payments are never deleted; a mistaken
 * payment is voided by setting status="cancelled" and posting a
 * reversing CustomerLedger entry (see utils/ledger.ts), so the
 * audit trail (who received what, when, how) is permanent.
 */
interface PaymentAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  sale_id?: number | null;
  emi_installment_id?: number | null;
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  transaction_id?: string | null;
  payment_date: Date;
  notes?: string | null;
  status: PaymentStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface PaymentCreationAttributes
  extends Optional<
    PaymentAttributes,
    "id" | "sale_id" | "emi_installment_id" | "transaction_id" | "notes" | "status" | "reference_code"
  > {}

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public customer_id!: number;
  public sale_id?: number | null;
  public emi_installment_id?: number | null;
  public type!: PaymentType;
  public amount!: number;
  public method!: PaymentMethod;
  public transaction_id?: string | null;
  public payment_date!: Date;
  public notes?: string | null;
  public status!: PaymentStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Payment.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sale_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    emi_installment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    type: { type: DataTypes.ENUM(...PAYMENT_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: DataTypes.STRING(100), allowNull: true },
    payment_date: { type: DataTypes.DATE, allowNull: false },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM(...PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Payment",
    tableName: "payments",
    indexes: [
      { fields: ["owner_id", "shop_id"] },
      { fields: ["customer_id"] },
      { fields: ["sale_id"] },
      { fields: ["emi_installment_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
