import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * CHANGED from the foundation pass: Product is now an OWNER-LEVEL
 * catalog entry (no shop_id on this table) instead of being scoped
 * to a single shop.
 *
 * Why this had to change: the spec requires transferring stock
 * between shops for "the same product" (Shop A: 100 -> transfer 20
 * -> Shop A: 80, Shop B: 20). That's only coherent if there is ONE
 * catalog record and stock is tracked per shop — see ProductStock.ts.
 * If Product stayed shop-scoped, a transfer would mean matching or
 * duplicating a SKU row in the destination shop, which is fragile
 * and duplicates catalog data (images, description, pricing) per shop.
 *
 * purchase_price / selling_price / mrp here are the catalog's
 * default prices. If a future requirement needs shop-specific
 * pricing overrides, add optional columns to ProductStock — this
 * schema doesn't need to change for that.
 */
interface ProductAttributes {
  id: number;
  owner_id: number;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  brand?: string;
  description?: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  discount: number; // percentage, 0-100
  tax_percent: number; // GST %, 0 if not applicable
  min_stock: number; // default reorder threshold; ProductStock can override per shop
  supplier_id?: number | null;
  status: "active" | "inactive";
  reference_code?: string | null;
}

interface ProductCreationAttributes
  extends Optional<
    ProductAttributes,
    | "id"
    | "barcode"
    | "category_id"
    | "subcategory_id"
    | "brand"
    | "description"
    | "discount"
    | "tax_percent"
    | "min_stock"
    | "supplier_id"
    | "status"
    | "reference_code"
  > {}

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  public id!: number;
  public owner_id!: number;
  public name!: string;
  public sku!: string;
  public barcode?: string;
  public category_id?: number | null;
  public subcategory_id?: number | null;
  public brand?: string;
  public description?: string;
  public purchase_price!: number;
  public selling_price!: number;
  public mrp!: number;
  public discount!: number;
  public tax_percent!: number;
  public min_stock!: number;
  public supplier_id?: number | null;
  public status!: "active" | "inactive";
  public reference_code?: string | null;
}

Product.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    sku: { type: DataTypes.STRING(60), allowNull: false },
    barcode: { type: DataTypes.STRING(60) },
    category_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    subcategory_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    brand: { type: DataTypes.STRING(100) },
    description: { type: DataTypes.TEXT },
    purchase_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    selling_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    mrp: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    min_stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    supplier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "products",
    indexes: [
      { unique: true, fields: ["owner_id", "sku"] },
      { fields: ["owner_id"] },
      { fields: ["category_id"] },
      { fields: ["supplier_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
