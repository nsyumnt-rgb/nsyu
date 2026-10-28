import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "cancelled",
  "returned",
  "partially_returned",
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/**
 * A Sale is the Bill/Invoice header. Line items live in SaleItem.
 * Money fields here are always kept in sync with reality by the
 * sale/payment/return/EMI controllers — they never get written to
 * directly from anywhere else:
 *
 *   total_amount = subtotal - discount_amount + tax_amount   (frozen at creation, only ever
 *                                                              reduced by an approved return)
 *   paid_amount  = sum of all non-cancelled Payment rows against this sale
 *   due_amount   = total_amount - paid_amount                (>= 0; for EMI sales this mirrors
 *                                                              the linked EMIPlan.outstanding_amount)
 *
 * Every Sale creates exactly one debit CustomerLedger entry for
 * total_amount at creation time (see utils/ledger.ts). Nothing here
 * is ever hard-deleted — cancellation flips `status` and reverses
 * stock/ledger with new offsetting entries, per spec.
 */
interface SaleAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  invoice_number: string;
  invoice_date: Date;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method: PaymentMethod;
  is_emi: boolean;
  status: SaleStatus;
  notes?: string | null;
  cancel_reason?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface SaleCreationAttributes
  extends Optional<
    SaleAttributes,
    | "id"
    | "subtotal"
    | "discount_amount"
    | "tax_amount"
    | "paid_amount"
    | "due_amount"
    | "is_emi"
    | "status"
    | "notes"
    | "cancel_reason"
    | "reference_code"
  > {}

export class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public customer_id!: number;
  public invoice_number!: string;
  public invoice_date!: Date;
  public subtotal!: number;
  public discount_amount!: number;
  public tax_amount!: number;
  public total_amount!: number;
  public paid_amount!: number;
  public due_amount!: number;
  public payment_method!: PaymentMethod;
  public is_emi!: boolean;
  public status!: SaleStatus;
  public notes?: string | null;
  public cancel_reason?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Sale.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    invoice_number: { type: DataTypes.STRING(40), allowNull: false },
    invoice_date: { type: DataTypes.DATE, allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    is_emi: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM(...SALE_STATUSES), allowNull: false, defaultValue: "unpaid" },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Sale",
    tableName: "sales",
    indexes: [
      { unique: true, fields: ["owner_id", "shop_id", "invoice_number"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["customer_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
