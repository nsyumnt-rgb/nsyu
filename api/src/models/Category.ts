import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface CategoryAttributes {
  id: number;
  owner_id: number;
  name: string;
  status: "active" | "inactive";
  reference_code?: string | null;
  image_url?: string | null;
  icon?: string | null;
  alias?: string | null;
}

interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, "id" | "status" | "reference_code" | "image_url" | "icon" | "alias"> {}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
  public image_url?: string | null;
  public icon?: string | null;
  public alias?: string | null;
}

Category.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
    image_url: { type: DataTypes.TEXT, allowNull: true },
    icon: { type: DataTypes.STRING(100), allowNull: true },
    alias: { type: DataTypes.STRING(20), allowNull: true },
  },
  {
    sequelize,
    modelName: "Category",
    tableName: "categories",
    indexes: [
      { unique: true, fields: ["owner_id", "name"] },
      { fields: ["owner_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
