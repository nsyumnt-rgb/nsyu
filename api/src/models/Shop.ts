import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface ShopAttributes {
  id: number;
  owner_id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  status: "active" | "inactive";
  reference_code?: string | null;
}

interface ShopCreationAttributes extends Optional<ShopAttributes, "id" | "status" | "reference_code"> {}

export class Shop
  extends Model<ShopAttributes, ShopCreationAttributes>
  implements ShopAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public code!: string;
  public address?: string;
  public phone?: string;
  public email?: string;
  public logo?: string;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
}

Shop.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(30), allowNull: false },
    address: { type: DataTypes.STRING(255) },
    phone: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(150) },
    logo: { type: DataTypes.STRING(255) },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Shop",
    tableName: "shops",
    indexes: [
      { unique: true, fields: ["owner_id", "code"] }, // shop code unique per owner
      { fields: ["owner_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
