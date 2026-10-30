import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * Every row is a historical fact — "as of this date, this product's
 * location in this shop was Rack X / Shelf Y / Bin Z". We never
 * UPDATE a row in place; setting a new location INSERTS a new row
 * and flips is_current on the old one to false, in the same DB
 * transaction (see productController.setProductLocation). This is
 * what "maintain location history" means concretely — a full
 * timeline, not just the latest value.
 */
interface ProductLocationAttributes {
  id: number;
  product_id: number;
  shop_id: number;
  rack?: string;
  shelf?: string;
  bin?: string;
  is_current: boolean;
  set_by_type: "owner" | "employee";
  set_by_id: number;
}

interface ProductLocationCreationAttributes
  extends Optional<ProductLocationAttributes, "id" | "rack" | "shelf" | "bin" | "is_current"> {}

export class ProductLocation
  extends Model<ProductLocationAttributes, ProductLocationCreationAttributes>
  implements ProductLocationAttributes
{
  public id!: number;
  public product_id!: number;
  public shop_id!: number;
  public rack?: string;
  public shelf?: string;
  public bin?: string;
  public is_current!: boolean;
  public set_by_type!: "owner" | "employee";
  public set_by_id!: number;
  public readonly created_at!: Date;
}

ProductLocation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    rack: { type: DataTypes.STRING(50) },
    shelf: { type: DataTypes.STRING(50) },
    bin: { type: DataTypes.STRING(50) },
    is_current: { type: DataTypes.BOOLEAN, defaultValue: true },
    set_by_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    set_by_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "ProductLocation",
    tableName: "product_locations",
    updatedAt: false,
    indexes: [{ fields: ["product_id", "shop_id"] }, { fields: ["product_id", "shop_id", "is_current"] }],
  }
);
