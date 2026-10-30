import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { SENSITIVE_FIELDS } from "../config/permissions";

interface RoleFieldPermissionAttributes {
  id: number;
  role_id: number;
  field: string;
  allowed: boolean;
}

interface RoleFieldPermissionCreationAttributes
  extends Optional<RoleFieldPermissionAttributes, "id" | "allowed"> {}

export class RoleFieldPermission
  extends Model<RoleFieldPermissionAttributes, RoleFieldPermissionCreationAttributes>
  implements RoleFieldPermissionAttributes
{
  public id!: number;
  public role_id!: number;
  public field!: string;
  public allowed!: boolean;
}

RoleFieldPermission.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    field: { type: DataTypes.ENUM(...SENSITIVE_FIELDS), allowNull: false },
    allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "RoleFieldPermission",
    tableName: "role_field_permissions",
    indexes: [
      { unique: true, fields: ["role_id", "field"] },
      { fields: ["role_id"] },
    ],
  }
);
