import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * Supplier record: catalog reference for Products, plus (added in
 * the Purchase module pass) a running payable balance — mirrors
 * Customer.current_balance's role exactly. See utils/supplierLedger.ts,
 * the only place this column is allowed to change.
 */
interface SupplierAttributes {
  id: number;
  owner_id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string | null;
  current_balance: number;
  status: "active" | "inactive";
  reference_code?: string | null;
}

interface SupplierCreationAttributes extends Optional<SupplierAttributes, "id" | "gstin" | "current_balance" | "status" | "reference_code"> {}

export class Supplier
  extends Model<SupplierAttributes, SupplierCreationAttributes>
  implements SupplierAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public phone?: string;
  public email?: string;
  public address?: string;
  public gstin?: string | null;
  public current_balance!: number;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
}

Supplier.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(150) },
    address: { type: DataTypes.STRING(255) },
    gstin: { type: DataTypes.STRING(30), allowNull: true },
    current_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  { sequelize, modelName: "Supplier", tableName: "suppliers", indexes: [{ fields: ["owner_id"] }, { fields: ["reference_code"] }] }
);
