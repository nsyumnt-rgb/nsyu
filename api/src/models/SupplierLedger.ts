import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const SUPPLIER_LEDGER_ENTRY_TYPES = ["debit", "credit"] as const;
export type SupplierLedgerEntryType = (typeof SUPPLIER_LEDGER_ENTRY_TYPES)[number];
export const SUPPLIER_LEDGER_ENTRY_STATUSES = ["active", "reversed"] as const;
export type SupplierLedgerEntryStatus = (typeof SUPPLIER_LEDGER_ENTRY_STATUSES)[number];

/**
 * Append-only supplier ledger — same design as CustomerLedger, just
 * from the other side of the relationship. running_balance =
 * "Outstanding": what the shop currently owes this supplier.
 *
 * entry_type: "credit" increases what's owed to the supplier (a
 * Purchase); "debit" decreases it (a SupplierPayment, or a
 * PurchaseReturn's refund/adjustment).
 */
interface SupplierLedgerAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  supplier_id: number;
  entry_type: SupplierLedgerEntryType;
  amount: number;
  running_balance: number;
  reference_type: string; // "Purchase" | "SupplierPayment" | "PurchaseReturn" | "PurchaseCancellation"
  reference_id?: number | null;
  description: string;
  entry_date: Date;
  status: SupplierLedgerEntryStatus;
  actor_type: "owner" | "employee";
  actor_id: number;
  reference_code?: string | null;
}

interface SupplierLedgerCreationAttributes
  extends Optional<SupplierLedgerAttributes, "id" | "reference_id" | "status" | "reference_code"> {}

export class SupplierLedger
  extends Model<SupplierLedgerAttributes, SupplierLedgerCreationAttributes>
  implements SupplierLedgerAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public supplier_id!: number;
  public entry_type!: SupplierLedgerEntryType;
  public amount!: number;
  public running_balance!: number;
  public reference_type!: string;
  public reference_id?: number | null;
  public description!: string;
  public entry_date!: Date;
  public status!: SupplierLedgerEntryStatus;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public reference_code?: string | null;
  public readonly created_at!: Date;
}

SupplierLedger.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    entry_type: { type: DataTypes.ENUM(...SUPPLIER_LEDGER_ENTRY_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    running_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: false },
    reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: false },
    entry_date: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM(...SUPPLIER_LEDGER_ENTRY_STATUSES), allowNull: false, defaultValue: "active" },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "SupplierLedger",
    tableName: "supplier_ledger",
    updatedAt: false,
    indexes: [
      { fields: ["supplier_id"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["reference_type", "reference_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
