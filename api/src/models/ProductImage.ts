import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface ProductImageAttributes {
  id: number;
  product_id: number;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

interface ProductImageCreationAttributes
  extends Optional<ProductImageAttributes, "id" | "is_primary" | "sort_order"> {}

export class ProductImage
  extends Model<ProductImageAttributes, ProductImageCreationAttributes>
  implements ProductImageAttributes
{
  public id!: number;
  public product_id!: number;
  public url!: string;
  public is_primary!: boolean;
  public sort_order!: number;
}

ProductImage.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    is_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  },
  { sequelize, modelName: "ProductImage", tableName: "product_images", indexes: [{ fields: ["product_id"] }] }
);
