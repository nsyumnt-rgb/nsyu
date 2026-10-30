import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { PAYMENT_METHODS, PaymentMethod } from "./Sale";

export const SUPPLIER_PAYMENT_TYPES = ["purchase_payment", "refund"] as const;
export type SupplierPaymentType = (typeof SUPPLIER_PAYMENT_TYPES)[number];
export const SUPPLIER_PAYMENT_STATUSES = ["completed", "cancelled"] as const;
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];

/**
 * Money paid OUT to a supplier — separate from the customer-facing
 * `Payment` model for the same reason `SalaryPayment` is separate
 * from `Payment`: different direction, different parties, different
 * type enum. Never deleted; a mistaken entry is voided via `status`.
 */
interface SupplierPaymentAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  supplier_id: number;
  purchase_id?: number | null;
  type: SupplierPaymentType;
  amount: number;
  method: PaymentMethod;
  transaction_id?: string | null;
  payment_date: Date;
  notes?: string | null;
  status: SupplierPaymentStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
}

interface SupplierPaymentCreationAttributes
  extends Optional<SupplierPaymentAttributes, "id" | "purchase_id" | "transaction_id" | "notes" | "status"> {}

export class SupplierPayment
  extends Model<SupplierPaymentAttributes, SupplierPaymentCreationAttributes>
  implements SupplierPaymentAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public supplier_id!: number;
  public purchase_id?: number | null;
  public type!: SupplierPaymentType;
  public amount!: number;
  public method!: PaymentMethod;
  public transaction_id?: string | null;
  public payment_date!: Date;
  public notes?: string | null;
  public status!: SupplierPaymentStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SupplierPayment.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER, allowNull: false },
    purchase_id: { type: DataTypes.BIGINT, allowNull: true },
    type: { type: DataTypes.ENUM(...SUPPLIER_PAYMENT_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    transaction_id: { type: DataTypes.STRING(100), allowNull: true },
    payment_date: { type: DataTypes.DATE, allowNull: false },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM(...SUPPLIER_PAYMENT_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "SupplierPayment",
    tableName: "supplier_payments",
    indexes: [{ fields: ["owner_id", "shop_id"] }, { fields: ["supplier_id"] }, { fields: ["purchase_id"] }],
  }
);
