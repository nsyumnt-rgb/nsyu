import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const LEDGER_ENTRY_TYPES = ["debit", "credit"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_ENTRY_STATUSES = ["active", "reversed"] as const;
export type LedgerEntryStatus = (typeof LEDGER_ENTRY_STATUSES)[number];

/**
 * Append-only customer ledger — mirrors utils/inventory.ts's design
 * philosophy exactly. This table is never updated or deleted from
 * (aside from flipping `status` to "reversed" as an annotation, see
 * below). Customer.current_balance is a cached read of the latest
 * row's running_balance; the ledger is the source of truth.
 *
 * entry_type: "debit" increases what the customer owes (a Sale, or a
 * late fee); "credit" decreases it (a Payment, a Return refund).
 * running_balance is the balance AFTER this entry is applied.
 *
 * Cancellations/reversals never delete a row: they post a NEW
 * offsetting entry (e.g. a credit that undoes an earlier debit) that
 * references the original via reference_type/reference_id, AND flip
 * the original row's `status` to "reversed" purely as a read-time
 * annotation so UIs can grey it out — running_balance history stays
 * intact and replayable either way.
 */
interface CustomerLedgerAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  entry_type: LedgerEntryType;
  amount: number;
  running_balance: number;
  reference_type: string; // "Sale" | "Payment" | "EMIInstallment" | "SaleReturn" | "Opening" | "Adjustment"
  reference_id?: number | null;
  description: string;
  entry_date: Date;
  status: LedgerEntryStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface CustomerLedgerCreationAttributes
  extends Optional<CustomerLedgerAttributes, "id" | "reference_id" | "status" | "reference_code"> {}

export class CustomerLedger
  extends Model<CustomerLedgerAttributes, CustomerLedgerCreationAttributes>
  implements CustomerLedgerAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public customer_id!: number;
  public entry_type!: LedgerEntryType;
  public amount!: number;
  public running_balance!: number;
  public reference_type!: string;
  public reference_id?: number | null;
  public description!: string;
  public entry_date!: Date;
  public status!: LedgerEntryStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

CustomerLedger.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    entry_type: { type: DataTypes.ENUM(...LEDGER_ENTRY_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    running_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: false },
    reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: false },
    entry_date: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM(...LEDGER_ENTRY_STATUSES), allowNull: false, defaultValue: "active" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "CustomerLedger",
    tableName: "customer_ledger",
    updatedAt: false,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["reference_type", "reference_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
