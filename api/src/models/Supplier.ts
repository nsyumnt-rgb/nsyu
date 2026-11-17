import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../config/database";

/**
 * A vendor the shop buys stock from (BRD §14). Owner-level directory,
 * like Customer. `current_balance` is a CACHED read of the latest
 * supplier_ledger.balance_after — positive = we owe the supplier
 * (payable), negative = advance paid / supplier owes us.
 * supplier_ledger is the source of truth.
 */
export class Supplier extends Model<InferAttributes<Supplier>, InferCreationAttributes<Supplier>> {
  declare id: CreationOptional<number>;
  declare owner_id: number;
  declare name: string;
  declare phone: CreationOptional<string | null>;
  declare email: CreationOptional<string | null>;
  declare address: CreationOptional<string | null>;
  declare gstin: CreationOptional<string | null>;
  declare status: CreationOptional<"active" | "inactive">;
  declare opening_balance: CreationOptional<number>;
  declare current_balance: CreationOptional<number>;
  declare reference_code: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare readonly created_at: CreationOptional<Date>;
  declare readonly updated_at: CreationOptional<Date>;
}

Supplier.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    gstin: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
    opening_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    current_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    reference_code: { type: DataTypes.STRING(30), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, modelName: "Supplier", tableName: "suppliers" }
);
