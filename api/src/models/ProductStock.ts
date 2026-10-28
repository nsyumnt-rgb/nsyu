import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * One row per (product, shop) — this is what "Shop A has 100 units"
 * means concretely. current_stock is only ever changed through
 * utils/inventory.ts::recordStockMovement(), which also writes the
 * matching InventoryTransaction row in the same DB transaction, so
 * current_stock and the transaction ledger can never drift apart.
 *
 * Never update current_stock directly from a controller.
 */
interface ProductStockAttributes {
  id: number;
  owner_id: number;
  product_id: number;
  shop_id: number;
  current_stock: number;
  min_stock?: number | null; // shop-specific override of Product.min_stock; null = use product default
}

interface ProductStockCreationAttributes
  extends Optional<ProductStockAttributes, "id" | "current_stock" | "min_stock"> {}

export class ProductStock
  extends Model<ProductStockAttributes, ProductStockCreationAttributes>
  implements ProductStockAttributes
{
  public id!: number;
  public owner_id!: number;
  public product_id!: number;
  public shop_id!: number;
  public current_stock!: number;
  public min_stock?: number | null;
}

ProductStock.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    current_stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    min_stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  {
    sequelize,
    modelName: "ProductStock",
    tableName: "product_stocks",
    indexes: [{ unique: true, fields: ["product_id", "shop_id"] }, { fields: ["owner_id", "shop_id"] }],
  }
);
