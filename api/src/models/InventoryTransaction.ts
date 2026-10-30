import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "sale",
  "customer_return",
  "purchase_return", // goods physically leaving to go back to a supplier — added for the Purchase module, decreasing
  "damage",
  "adjustment",
  "transfer_in",
  "transfer_out",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Append-only ledger — this table is never updated or deleted from.
 * Every row records: what happened, how much, and what the resulting
 * balance was. ProductStock.current_stock is a cached read of
 * "balance_after of the latest row for this (product, shop)" — the
 * ledger is the actual source of truth, the cache just avoids
 * summing the whole table on every read.
 *
 * signed_quantity is positive for stock-increasing movements
 * (opening, purchase, customer_return, transfer_in, positive
 * adjustment) and negative for stock-decreasing movements (sale,
 * damage, transfer_out, negative adjustment) — this is what makes
 * "current stock must always remain consistent with stock
 * movements" a simple running sum rather than type-specific logic
 * scattered across the codebase.
 */
interface InventoryTransactionAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  product_id: number;
  type: MovementType;
  signed_quantity: number; // + or -
  balance_after: number;
  reference_type?: string | null; // e.g. "StockTransfer", "Sale"
  reference_id?: number | null;
  notes?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface InventoryTransactionCreationAttributes
  extends Optional<InventoryTransactionAttributes, "id" | "reference_type" | "reference_id" | "notes" | "reference_code"> {}

export class InventoryTransaction
  extends Model<InventoryTransactionAttributes, InventoryTransactionCreationAttributes>
  implements InventoryTransactionAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public product_id!: number;
  public type!: MovementType;
  public signed_quantity!: number;
  public balance_after!: number;
  public reference_type?: string | null;
  public reference_id?: number | null;
  public notes?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

InventoryTransaction.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM(...MOVEMENT_TYPES), allowNull: false },
    signed_quantity: { type: DataTypes.INTEGER, allowNull: false },
    balance_after: { type: DataTypes.INTEGER, allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: true },
    reference_id: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "InventoryTransaction",
    tableName: "inventory_transactions",
    updatedAt: false,
    indexes: [
      { fields: ["product_id", "shop_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["type"] },
      { fields: ["reference_type", "reference_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
