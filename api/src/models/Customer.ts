import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * Customers are OWNER-level (like Product), not shop-scoped, so the
 * same customer can shop across multiple shops of the same owner and
 * still have ONE ledger / running balance. `current_balance` is a
 * cached read of "the customer's outstanding balance right now" —
 * the CustomerLedger table is the source of truth (see
 * utils/ledger.ts::recordLedgerEntry, which is the ONLY place this
 * column is allowed to change). Positive balance = customer owes the
 * shop money (net debits); negative = shop owes customer (credit/advance).
 */
interface CustomerAttributes {
  id: number;
  owner_id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  opening_balance: number;
  current_balance: number;
  status: "active" | "inactive";
  notes?: string | null;
  reference_code?: string | null;
}

interface CustomerCreationAttributes
  extends Optional<
    CustomerAttributes,
    "id" | "phone" | "email" | "address" | "gstin" | "opening_balance" | "current_balance" | "status" | "notes" | "reference_code"
  > {}

export class Customer
  extends Model<CustomerAttributes, CustomerCreationAttributes>
  implements CustomerAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public phone?: string | null;
  public email?: string | null;
  public address?: string | null;
  public gstin?: string | null;
  public opening_balance!: number;
  public current_balance!: number;
  public status!: "active" | "inactive";
  public notes?: string | null;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Customer.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    address: { type: DataTypes.STRING(255), allowNull: true },
    gstin: { type: DataTypes.STRING(30), allowNull: true },
    opening_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    current_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Customer",
    tableName: "customers",
    indexes: [{ fields: ["owner_id"] }, { fields: ["owner_id", "phone"] }, { fields: ["reference_code"] }],
  }
);
