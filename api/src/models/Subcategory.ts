import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface SubcategoryAttributes {
  id: number;
  owner_id: number;
  category_id: number;
  name: string;
  status: "active" | "inactive";
  reference_code?: string | null;
}

interface SubcategoryCreationAttributes extends Optional<SubcategoryAttributes, "id" | "status" | "reference_code"> {}

export class Subcategory
  extends Model<SubcategoryAttributes, SubcategoryCreationAttributes>
  implements SubcategoryAttributes
{
  public id!: number;
  public owner_id!: number;
  public category_id!: number;
  public name!: string;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
}

Subcategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Subcategory",
    tableName: "subcategories",
    indexes: [
      { unique: true, fields: ["category_id", "name"] },
      { fields: ["owner_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
