import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface UserRoleAttributes {
  id: number;
  user_type: string; // 'super_admin' | 'owner' | 'employee' | 'customer'
  user_id: number;
  role_id: number;
  shop_id?: number | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserRoleCreationAttributes
  extends Optional<UserRoleAttributes, "id" | "shop_id" | "is_active"> {}

export class UserRole
  extends Model<UserRoleAttributes, UserRoleCreationAttributes>
  implements UserRoleAttributes
{
  public id!: number;
  public user_type!: string;
  public user_id!: number;
  public role_id!: number;
  public shop_id?: number | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

UserRole.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_type: { type: DataTypes.STRING(50), allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: "UserRole",
    tableName: "user_roles",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["user_type", "user_id", "role_id", "shop_id"] },
    ],
  }
);
