import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface CategoryAttributes {
  id: number;
  owner_id: number;
  name: string;
  status: "active" | "inactive";
  reference_code?: string | null;
}

interface CategoryCreationAttributes extends Optional<CategoryAttributes, "id" | "status" | "reference_code"> {}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
}

Category.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
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
