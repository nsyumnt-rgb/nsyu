import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface ShopModuleAttributes {
  id: number;
  shop_id: number;
  module_id: number;
  module_code: string;
  is_enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShopModuleCreationAttributes
  extends Optional<ShopModuleAttributes, "id" | "is_enabled"> {}

export class ShopModule
  extends Model<ShopModuleAttributes, ShopModuleCreationAttributes>
  implements ShopModuleAttributes
{
  public id!: number;
  public shop_id!: number;
  public module_id!: number;
  public module_code!: string;
  public is_enabled!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ShopModule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    module_id: { type: DataTypes.INTEGER, allowNull: false },
    module_code: { type: DataTypes.STRING(50), allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: "ShopModule",
    tableName: "shop_modules",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["shop_id", "module_id"] },
    ],
  }
);
