import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface ModuleAttributes {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ModuleCreationAttributes
  extends Optional<ModuleAttributes, "id" | "description" | "icon" | "sort_order" | "is_active"> {}

export class Module
  extends Model<ModuleAttributes, ModuleCreationAttributes>
  implements ModuleAttributes
{
  public id!: number;
  public code!: string;
  public name!: string;
  public description?: string;
  public icon?: string;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Module.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    icon: { type: DataTypes.STRING(100), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: "Module",
    tableName: "modules",
    timestamps: true,
    underscored: true,
  }
);

