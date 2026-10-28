import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface EmployeeAttributes {
  id: number;
  owner_id: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  status: "active" | "inactive";
  salary_outstanding: number;
  reference_code?: string | null;
}

interface EmployeeCreationAttributes extends Optional<EmployeeAttributes, "id" | "status" | "salary_outstanding" | "reference_code"> {}

export class Employee
  extends Model<EmployeeAttributes, EmployeeCreationAttributes>
  implements EmployeeAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public phone?: string;
  public status!: "active" | "inactive";
  public salary_outstanding!: number;
  public reference_code?: string | null;
}

Employee.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false },
    password: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    // Cached running balance from EmployeeLedger — "net amount the
    // owner currently owes this employee" (salary earned + incentives
    // - deductions - advances - salary payments). See utils/salaryLedger.ts,
    // the only place this column is allowed to change. Added in the
    // Attendance/Payroll pass; defaults to 0 so existing rows are unaffected.
    salary_outstanding: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Employee",
    tableName: "employees",
    indexes: [
      { unique: true, fields: ["owner_id", "email"] }, // email unique per owner, not globally
      { fields: ["owner_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
