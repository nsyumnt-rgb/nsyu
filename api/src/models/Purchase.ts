import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { PAYMENT_METHODS, PaymentMethod } from "./Sale";

export const PURCHASE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "cancelled",
  "returned",
  "partially_returned",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * Purchase header — mirrors Sale.ts exactly (same money-field
 * invariants, same transaction/audit/never-delete discipline), just
 * flowing the other direction: Supplier -> Shop -> Product -> Cart ->
 * Discount -> Tax -> Payment -> Save -> INCREASE inventory -> Supplier
 * ledger -> Outstanding update. See purchaseController.ts.
 *
 *   total_amount = subtotal - discount_amount + tax_amount
 *   paid_amount  = sum of non-cancelled SupplierPayment rows against this purchase
 *   due_amount   = total_amount - paid_amount
 */
interface PurchaseAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  supplier_id: number;
  purchase_number: string;
  purchase_date: Date;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method: PaymentMethod;
  status: PurchaseStatus;
  notes?: string | null;
  cancel_reason?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface PurchaseCreationAttributes
  extends Optional<
    PurchaseAttributes,
    "id" | "subtotal" | "discount_amount" | "tax_amount" | "paid_amount" | "due_amount" | "status" | "notes" | "cancel_reason" | "reference_code"
  > {}

export class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public supplier_id!: number;
  public purchase_number!: string;
  public purchase_date!: Date;
  public subtotal!: number;
  public discount_amount!: number;
  public tax_amount!: number;
  public total_amount!: number;
  public paid_amount!: number;
  public due_amount!: number;
  public payment_method!: PaymentMethod;
  public status!: PurchaseStatus;
  public notes?: string | null;
  public cancel_reason?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Purchase.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    purchase_number: { type: DataTypes.STRING(40), allowNull: false },
    purchase_date: { type: DataTypes.DATE, allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    status: { type: DataTypes.ENUM(...PURCHASE_STATUSES), allowNull: false, defaultValue: "unpaid" },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Purchase",
    tableName: "purchases",
    indexes: [
      { unique: true, fields: ["owner_id", "shop_id", "purchase_number"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["supplier_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
