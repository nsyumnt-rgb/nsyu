import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface RoleAttributes {
  id: number;
  owner_id?: number | null;
  code?: string | null;
  name: string;
  description?: string | null;
  is_system: boolean; // system roles (Super Admin, Owner, Staff, User) can't be deleted
  created_at?: Date;
  updated_at?: Date;
}

export interface RoleCreationAttributes
  extends Optional<RoleAttributes, "id" | "owner_id" | "code" | "description" | "is_system"> {}

export class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes
{
  public id!: number;
  public owner_id?: number | null;
  public code?: string | null;
  public name!: string;
  public description?: string | null;
  public is_system!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Role.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: true },
    code: { type: DataTypes.STRING(50), allowNull: true, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Role",
    tableName: "roles",
    timestamps: true,
    underscored: true,
  }
);
