import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { ACTIONS } from "../config/permissions";

export interface RolePermissionAttributes {
  id: number;
  role_id: number;
  module_id?: number | null;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  scope?: string; // 'all' | 'shop' | 'self'
  created_at?: Date;
  updated_at?: Date;
}

export interface RolePermissionCreationAttributes
  extends Optional<
    RolePermissionAttributes,
    "id" | "module_id" | "can_view" | "can_create" | "can_edit" | "can_delete" | "scope"
  > {}

export class RolePermission
  extends Model<RolePermissionAttributes, RolePermissionCreationAttributes>
  implements RolePermissionAttributes
{
  public id!: number;
  public role_id!: number;
  public module_id?: number | null;
  public module!: string;
  public can_view!: boolean;
  public can_create!: boolean;
  public can_edit!: boolean;
  public can_delete!: boolean;
  public scope?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

RolePermission.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    module_id: { type: DataTypes.INTEGER, allowNull: true },
    module: { type: DataTypes.STRING(100), allowNull: false },
    can_view: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_create: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_edit: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_delete: { type: DataTypes.BOOLEAN, defaultValue: false },
    scope: { type: DataTypes.STRING(50), defaultValue: "shop" },
  },
  {
    sequelize,
    modelName: "RolePermission",
    tableName: "role_permissions",
    timestamps: true,
    underscored: true,
  }
);

export const ALL_ACTIONS = ACTIONS;
