import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../config/database";

export type SupplierLedgerEntryType = "debit" | "credit";

/**
 * APPEND-ONLY supplier ledger (BRD §14, §26) — mirrors CustomerLedger.
 * Rows are never updated or deleted (only `status` may be flagged
 * "reversed" as a read-time annotation); mistakes are corrected with a
 * new offsetting entry.
 *
 * Uses the LEGACY convention of the existing `supplier_ledger` table so
 * historical rows and new rows reconcile:
 *   credit → increases what we owe the supplier (purchase bill, opening payable)
 *   debit  → decreases it (payment made, purchase return, cancellation)
 *
 * running_balance is the payable AFTER this entry; Supplier.current_balance
 * caches the latest one. JSON output also exposes it as `balance_after`
 * for the web Supplier Detail page.
 */
export class SupplierLedger extends Model<InferAttributes<SupplierLedger>, InferCreationAttributes<SupplierLedger>> {
  declare id: CreationOptional<number>;
  declare owner_id: number;
  declare shop_id: number;
  declare supplier_id: number;
  declare purchase_id: CreationOptional<number | null>;
  declare entry_type: SupplierLedgerEntryType;
  declare amount: number;
  declare running_balance: number;
  declare reference_type: string; // Purchase | SupplierPayment | PurchaseReturn | PurchaseCancellation | Opening
  declare reference_id: CreationOptional<number | null>;
  declare reference_code: CreationOptional<string | null>;
  declare description: string;
  declare payment_method: CreationOptional<string | null>;
  declare transaction_id: CreationOptional<string | null>;
  declare idempotency_key: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare entry_date: CreationOptional<Date>;
  declare status: CreationOptional<"active" | "reversed">;
  declare actor_type: "owner" | "employee";
  declare actor_id: number;
  declare readonly created_at: CreationOptional<Date>;

  toJSON() {
    const v: any = super.toJSON();
    v.balance_after = v.running_balance;
    return v;
  }
}

SupplierLedger.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    supplier_id: { type: DataTypes.INTEGER, allowNull: false },
    purchase_id: { type: DataTypes.BIGINT, allowNull: true },
    entry_type: { type: DataTypes.STRING(10), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    running_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: false },
    reference_id: { type: DataTypes.BIGINT, allowNull: true },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: false },
    payment_method: { type: DataTypes.STRING(30), allowNull: true },
    transaction_id: { type: DataTypes.STRING(120), allowNull: true },
    idempotency_key: { type: DataTypes.STRING(120), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    entry_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
    actor_type: { type: DataTypes.STRING(20), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: DataTypes.DATE,
  },
  { sequelize, modelName: "SupplierLedger", tableName: "supplier_ledger", updatedAt: false }
);
