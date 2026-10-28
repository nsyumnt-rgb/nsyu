import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const SALE_RETURN_STATUSES = ["completed", "cancelled"] as const;
export type SaleReturnStatus = (typeof SALE_RETURN_STATUSES)[number];

/**
 * A partial or full product return against a Sale. Refunding never
 * moves physical cash automatically — `refund_amount` is always
 * applied as a CustomerLedger credit (reduces what the customer
 * owes / adds shop credit), which is the correct behaviour whether
 * the original sale was paid in full, partially paid, or on EMI.
 * If the owner also wants to hand back cash, that's recorded
 * separately as a Payment(type="refund").
 */
interface SaleReturnAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  sale_id: number;
  customer_id: number;
  return_date: Date;
  reason?: string | null;
  refund_amount: number;
  status: SaleReturnStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface SaleReturnCreationAttributes extends Optional<SaleReturnAttributes, "id" | "reason" | "status" | "reference_code"> {}

export class SaleReturn
  extends Model<SaleReturnAttributes, SaleReturnCreationAttributes>
  implements SaleReturnAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public sale_id!: number;
  public customer_id!: number;
  public return_date!: Date;
  public reason?: string | null;
  public refund_amount!: number;
  public status!: SaleReturnStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

SaleReturn.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sale_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    return_date: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...SALE_RETURN_STATUSES), allowNull: false, defaultValue: "completed" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "SaleReturn",
    tableName: "sale_returns",
    updatedAt: false,
    indexes: [
      { fields: ["sale_id"] },
      { fields: ["customer_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["reference_code"] },
    ],
  }
);

interface SaleReturnItemAttributes {
  id: number;
  sale_return_id: number;
  sale_item_id: number;
  product_id: number;
  quantity: number;
  rate: number;
  refund_amount: number;
}

interface SaleReturnItemCreationAttributes extends Optional<SaleReturnItemAttributes, "id"> {}

export class SaleReturnItem
  extends Model<SaleReturnItemAttributes, SaleReturnItemCreationAttributes>
  implements SaleReturnItemAttributes
{
  public id!: number;
  public sale_return_id!: number;
  public sale_item_id!: number;
  public product_id!: number;
  public quantity!: number;
  public rate!: number;
  public refund_amount!: number;
}

SaleReturnItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    sale_return_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    sale_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  {
    sequelize,
    modelName: "SaleReturnItem",
    tableName: "sale_return_items",
    timestamps: false,
    indexes: [{ fields: ["sale_return_id"] }, { fields: ["sale_item_id"] }],
  }
);
