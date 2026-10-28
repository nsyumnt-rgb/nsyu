import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/** Mirrors InvoiceCounter exactly, for Purchase numbers instead of Sale invoice numbers. */
interface PurchaseCounterAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  last_number: number;
}
interface PurchaseCounterCreationAttributes extends Optional<PurchaseCounterAttributes, "id" | "last_number"> {}

export class PurchaseCounter
  extends Model<PurchaseCounterAttributes, PurchaseCounterCreationAttributes>
  implements PurchaseCounterAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public last_number!: number;
}

PurchaseCounter.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    last_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "PurchaseCounter",
    tableName: "purchase_counters",
    timestamps: false,
    indexes: [{ unique: true, fields: ["owner_id", "shop_id"] }],
  }
);
