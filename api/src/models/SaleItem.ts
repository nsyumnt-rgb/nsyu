import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * Line item of a Sale. Product name/sku/rate/discount/tax are
 * SNAPSHOTTED at sale time (not live-joined from Product) so a bill
 * always prints/PDFs exactly what the customer was actually charged,
 * even if the product's catalog price changes later.
 *
 * returned_quantity accumulates across SaleReturns against this line
 * (never exceeds quantity) — see SaleReturnItem.
 */
interface SaleItemAttributes {
  id: number;
  sale_id: number;
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

interface SaleItemCreationAttributes extends Optional<SaleItemAttributes, "id" | "returned_quantity"> {}

export class SaleItem
  extends Model<SaleItemAttributes, SaleItemCreationAttributes>
  implements SaleItemAttributes
{
  public id!: number;
  public sale_id!: number;
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

SaleItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    sale_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
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
    modelName: "SaleItem",
    tableName: "sale_items",
    timestamps: false,
    indexes: [{ fields: ["sale_id"] }, { fields: ["product_id"] }],
  }
);
