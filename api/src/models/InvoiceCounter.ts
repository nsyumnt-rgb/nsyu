import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * One row per (owner, shop). Incremented under a row lock inside the
 * same DB transaction as Sale creation (see utils/invoice.ts), so two
 * concurrent sales at the same shop can never be handed the same
 * invoice number.
 */
interface InvoiceCounterAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  last_number: number;
}

interface InvoiceCounterCreationAttributes extends Optional<InvoiceCounterAttributes, "id" | "last_number"> {}

export class InvoiceCounter
  extends Model<InvoiceCounterAttributes, InvoiceCounterCreationAttributes>
  implements InvoiceCounterAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public last_number!: number;
}

InvoiceCounter.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    last_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "InvoiceCounter",
    tableName: "invoice_counters",
    timestamps: false,
    indexes: [{ unique: true, fields: ["owner_id", "shop_id"] }],
  }
);
