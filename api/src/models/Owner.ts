import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface OwnerAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  status: "active" | "suspended" | "inactive";
  is_super_admin: boolean;
  role: "super_admin" | "owner";
  reference_code?: string | null;
}

export interface OwnerCreationAttributes
  extends Optional<OwnerAttributes, "id" | "status" | "is_super_admin" | "role" | "reference_code"> {}

export class Owner
  extends Model<OwnerAttributes, OwnerCreationAttributes>
  implements OwnerAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public phone?: string;
  public status!: "active" | "suspended" | "inactive";
  public is_super_admin!: boolean;
  public role!: "super_admin" | "owner";
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Owner.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    status: {
      type: DataTypes.ENUM("active", "suspended", "inactive"),
      defaultValue: "active",
    },
    is_super_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "owner",
    },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Owner",
    tableName: "owners",
    indexes: [{ fields: ["reference_code"] }, { fields: ["email"] }],
  }
);
