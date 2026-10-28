import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const PURCHASE_RETURN_STATUSES = ["completed", "cancelled"] as const;
export type PurchaseReturnStatus = (typeof PURCHASE_RETURN_STATUSES)[number];

/** Mirrors SaleReturn.ts — a return of goods back to a supplier, adjusting inventory down and the supplier ledger down (debit). */
interface PurchaseReturnAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  purchase_id: number;
  supplier_id: number;
  return_date: Date;
  reason?: string | null;
  refund_amount: number;
  status: PurchaseReturnStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}
interface PurchaseReturnCreationAttributes extends Optional<PurchaseReturnAttributes, "id" | "reason" | "status" | "reference_code"> {}

export class PurchaseReturn
  extends Model<PurchaseReturnAttributes, PurchaseReturnCreationAttributes>
  implements PurchaseReturnAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public purchase_id!: number;
  public supplier_id!: number;
  public return_date!: Date;
  public reason?: string | null;
  public refund_amount!: number;
  public status!: PurchaseReturnStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

PurchaseReturn.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    purchase_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    return_date: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...PURCHASE_RETURN_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "PurchaseReturn",
    tableName: "purchase_returns",
    updatedAt: false,
    indexes: [
      { fields: ["purchase_id"] },
      { fields: ["supplier_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["reference_code"] },
    ],
  }
);

interface PurchaseReturnItemAttributes {
  id: number;
  purchase_return_id: number;
  purchase_item_id: number;
  product_id: number;
  quantity: number;
  rate: number;
  refund_amount: number;
}
interface PurchaseReturnItemCreationAttributes extends Optional<PurchaseReturnItemAttributes, "id"> {}

export class PurchaseReturnItem
  extends Model<PurchaseReturnItemAttributes, PurchaseReturnItemCreationAttributes>
  implements PurchaseReturnItemAttributes
{
  public id!: number;
  public purchase_return_id!: number;
  public purchase_item_id!: number;
  public product_id!: number;
  public quantity!: number;
  public rate!: number;
  public refund_amount!: number;
}

PurchaseReturnItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    purchase_return_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    purchase_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  {
    sequelize,
    modelName: "PurchaseReturnItem",
    tableName: "purchase_return_items",
    timestamps: false,
    indexes: [{ fields: ["purchase_return_id"] }, { fields: ["purchase_item_id"] }],
  }
);
