import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { MODULES, ACTIONS } from "../config/permissions";

interface RolePermissionAttributes {
  id: number;
  role_id: number;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface RolePermissionCreationAttributes
  extends Optional<RolePermissionAttributes, "id" | "can_view" | "can_create" | "can_edit" | "can_delete"> {}

export class RolePermission
  extends Model<RolePermissionAttributes, RolePermissionCreationAttributes>
  implements RolePermissionAttributes
{
  public id!: number;
  public role_id!: number;
  public module!: string;
  public can_view!: boolean;
  public can_create!: boolean;
  public can_edit!: boolean;
  public can_delete!: boolean;
}

RolePermission.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    role_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    module: { type: DataTypes.ENUM(...MODULES), allowNull: false },
    can_view: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_create: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_edit: { type: DataTypes.BOOLEAN, defaultValue: false },
    can_delete: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "RolePermission",
    tableName: "role_permissions",
    indexes: [
      { unique: true, fields: ["role_id", "module"] },
      { fields: ["role_id"] },
    ],
  }
);

// Exported for reference in seed / validation logic
export const ALL_ACTIONS = ACTIONS;
