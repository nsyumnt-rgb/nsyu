import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface RoleAttributes {
  id: number;
  owner_id: number;
  name: string;
  is_system: boolean; // system roles (Owner, Manager...) can't be deleted
}

interface RoleCreationAttributes extends Optional<RoleAttributes, "id" | "is_system"> {}

export class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public is_system!: boolean;
}

Role.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Role",
    tableName: "roles",
    indexes: [
      { unique: true, fields: ["owner_id", "name"] },
      { fields: ["owner_id"] },
    ],
  }
);
