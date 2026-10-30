import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * A transfer creates exactly two InventoryTransaction rows (transfer_out
 * at from_shop, transfer_in at to_shop), both tagged
 * reference_type="StockTransfer", reference_id=this.id — this row is
 * the human-readable summary of that pair ("20 units, Shop A -> Shop B,
 * by X, on Y").
 */
export interface StockTransferItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
}

export type StockTransferStatus = "pending" | "in_transit" | "completed" | "cancelled";

interface StockTransferAttributes {
  id: number;
  owner_id: number;
  product_id?: number | null;
  from_shop_id: number;
  to_shop_id: number;
  quantity?: number | null;
  notes?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  transfer_no?: string | null;
  status: StockTransferStatus;
  items?: StockTransferItem[] | null;
  received_at?: Date | null;
  cancelled_at?: Date | null;
  cancellation_reason?: string | null;
  reference_code?: string | null;
}

interface StockTransferCreationAttributes
  extends Optional<
    StockTransferAttributes,
    "id" | "notes" | "transfer_no" | "items" | "received_at" | "cancelled_at" | "cancellation_reason" | "product_id" | "quantity" | "reference_code"
  > {}

export class StockTransfer
  extends Model<StockTransferAttributes, StockTransferCreationAttributes>
  implements StockTransferAttributes
{
  public id!: number;
  public owner_id!: number;
  public product_id?: number | null;
  public from_shop_id!: number;
  public to_shop_id!: number;
  public quantity?: number | null;
  public notes?: string | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public transfer_no?: string | null;
  public status!: StockTransferStatus;
  public items?: StockTransferItem[] | null;
  public received_at?: Date | null;
  public cancelled_at?: Date | null;
  public cancellation_reason?: string | null;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

StockTransfer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: true },
    from_shop_id: { type: DataTypes.INTEGER, allowNull: false },
    to_shop_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    transfer_no: { type: DataTypes.STRING(50), allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "completed",
    },
    items: { type: DataTypes.JSONB, allowNull: true },
    received_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancellation_reason: { type: DataTypes.STRING(255), allowNull: true },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "StockTransfer",
    tableName: "stock_transfers",
    updatedAt: "updated_at",
    createdAt: "created_at",
    indexes: [
      { fields: ["product_id"] },
      { fields: ["owner_id"] },
      { fields: ["transfer_no"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
