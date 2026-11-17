import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * Staff login account (manager, sales, billing, inventory, accountant…) owned by one Owner.
 * Shop access and the role used in each shop live in `user_roles` (user_type = 'employee').
 * See migrations/07_employee_accounts.sql.
 */
export interface EmployeeAttributes {
  id: number;
  owner_id: number;
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  status: "active" | "inactive";
  created_at?: Date;
  updated_at?: Date;
}

export interface EmployeeCreationAttributes extends Optional<EmployeeAttributes, "id" | "phone" | "status"> {}

export class Employee extends Model<EmployeeAttributes, EmployeeCreationAttributes> implements EmployeeAttributes {
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public email!: string;
  public phone?: string | null;
  public password!: string;
  public status!: "active" | "inactive";
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /** Never serialise the password hash. */
  toJSON() {
    const { password: _omit, ...rest } = super.toJSON() as EmployeeAttributes;
    return rest;
  }
}

Employee.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
  },
  {
    sequelize,
    modelName: "Employee",
    tableName: "employees",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["owner_id"] }, { unique: true, fields: ["email"] }],
  }
);
