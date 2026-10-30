import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface PermissionAttributes {
  id: number;
  module_id: number;
  module_code: string;
  code: string;
  action: string;
  name: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PermissionCreationAttributes
  extends Optional<PermissionAttributes, "id" | "description"> {}

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes
{
  public id!: number;
  public module_id!: number;
  public module_code!: string;
  public code!: string;
  public action!: string;
  public name!: string;
  public description?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Permission.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    module_id: { type: DataTypes.INTEGER, allowNull: false },
    module_code: { type: DataTypes.STRING(50), allowNull: false },
    code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    action: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "Permission",
    tableName: "permissions",
    timestamps: true,
    underscored: true,
  }
);
