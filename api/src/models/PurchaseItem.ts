import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/** Line item of a Purchase — mirrors SaleItem.ts (snapshotted product name/sku/rate/discount/tax at purchase time). */
interface PurchaseItemAttributes {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  returned_quantity: number;
}

interface PurchaseItemCreationAttributes extends Optional<PurchaseItemAttributes, "id" | "returned_quantity"> {}

export class PurchaseItem
  extends Model<PurchaseItemAttributes, PurchaseItemCreationAttributes>
  implements PurchaseItemAttributes
{
  public id!: number;
  public purchase_id!: number;
  public product_id!: number;
  public product_name!: string;
  public sku!: string;
  public quantity!: number;
  public rate!: number;
  public discount_percent!: number;
  public discount_amount!: number;
  public tax_percent!: number;
  public tax_amount!: number;
  public total_amount!: number;
  public returned_quantity!: number;
}

PurchaseItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    purchase_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_name: { type: DataTypes.STRING(150), allowNull: false },
    sku: { type: DataTypes.STRING(60), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    returned_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "PurchaseItem",
    tableName: "purchase_items",
    timestamps: false,
    indexes: [{ fields: ["purchase_id"] }, { fields: ["product_id"] }],
  }
);
