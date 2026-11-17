import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../config/database";

export const PURCHASE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "partially_returned",
  "returned",
  "cancelled",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/** Derives the bill status from its money/return state. Cancelled is terminal and set explicitly. */
export function computePurchaseStatus(p: {
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  returned_amount: number;
}): PurchaseStatus {
  const total = Number(p.total_amount);
  const returned = Number(p.returned_amount);
  if (returned > 0 && returned >= total - 0.005) return "returned";
  if (returned > 0) return "partially_returned";
  if (Number(p.due_amount) <= 0.005) return "paid";
  if (Number(p.paid_amount) > 0) return "partially_paid";
  return "unpaid";
}

/**
 * A supplier bill (BRD §14, §16). Stock-in happens on creation; the
 * payable is posted to supplier_ledger. Never hard-deleted — cancel and
 * return post offsetting stock movements and ledger credits.
 */
export class Purchase extends Model<InferAttributes<Purchase>, InferCreationAttributes<Purchase>> {
  declare id: CreationOptional<number>;
  declare owner_id: number;
  declare shop_id: number;
  declare supplier_id: number;
  declare purchase_number: string;
  declare purchase_date: CreationOptional<Date>;
  declare subtotal: CreationOptional<number>;
  declare discount_amount: CreationOptional<number>;
  declare tax_amount: CreationOptional<number>;
  declare total_amount: CreationOptional<number>;
  declare paid_amount: CreationOptional<number>;
  declare due_amount: CreationOptional<number>;
  declare returned_amount: CreationOptional<number>;
  declare payment_method: CreationOptional<string | null>;
  declare status: CreationOptional<PurchaseStatus>;
  declare notes: CreationOptional<string | null>;
  declare client_request_id: CreationOptional<string | null>;
  declare cancel_reason: CreationOptional<string | null>;
  declare cancelled_at: CreationOptional<Date | null>;
  declare actor_type: "owner" | "employee";
  declare actor_id: number;
  declare readonly created_at: CreationOptional<Date>;
  declare readonly updated_at: CreationOptional<Date>;
}

Purchase.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER, allowNull: false },
    purchase_number: { type: DataTypes.STRING(40), allowNull: false },
    purchase_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    due_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    returned_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING(30), allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "unpaid" },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    client_request_id: { type: DataTypes.STRING(120), allowNull: true },
    cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    actor_type: { type: DataTypes.STRING(20), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, modelName: "Purchase", tableName: "purchases" }
);

/** Line item — product name/sku/rate/tax are SNAPSHOTTED at purchase time. */
export class PurchaseItem extends Model<InferAttributes<PurchaseItem>, InferCreationAttributes<PurchaseItem>> {
  declare id: CreationOptional<number>;
  declare purchase_id: number;
  declare product_id: number;
  declare product_name: string;
  declare sku: CreationOptional<string | null>;
  declare quantity: number;
  declare returned_quantity: CreationOptional<number>;
  declare rate: number;
  declare discount_amount: CreationOptional<number>;
  declare tax_percent: CreationOptional<number>;
  declare tax_amount: CreationOptional<number>;
  declare total_amount: CreationOptional<number>;
}

PurchaseItem.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    purchase_id: { type: DataTypes.BIGINT, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    product_name: { type: DataTypes.STRING(150), allowNull: false },
    sku: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "" },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    returned_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  },
  // Legacy table has no created_at/updated_at columns.
  { sequelize, modelName: "PurchaseItem", tableName: "purchase_items", timestamps: false }
);
