import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface OrderItemAttributes {
  id: number;
  order_id: number;
  product_id?: number | null;
  product_name: string;
  sku: string;
  available_stock: number;
  quantity: number;
  rate: number;
  discount_percent: number;
  amount: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, "id" | "product_id" | "created_at" | "updated_at"> {}

export class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public order_id!: number;
  public product_id?: number | null;
  public product_name!: string;
  public sku!: string;
  public available_stock!: number;
  public quantity!: number;
  public rate!: number;
  public discount_percent!: number;
  public amount!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

OrderItem.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.BIGINT, allowNull: false },
    product_id: { type: DataTypes.BIGINT, allowNull: true },
    product_name: { type: DataTypes.STRING(255), allowNull: false },
    sku: { type: DataTypes.STRING(100), allowNull: false },
    available_stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "OrderItem",
    tableName: "order_items",
    indexes: [{ fields: ["order_id"] }, { fields: ["product_id"] }],
  }
);
