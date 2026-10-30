import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
  "converted_to_bill",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  order_number: string;
  order_date: Date;
  expected_delivery_date?: Date | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: OrderStatus;
  remarks?: string | null;
  converted_sale_id?: number | null;
  reference_code?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrderCreationAttributes
  extends Optional<
    OrderAttributes,
    | "id"
    | "subtotal"
    | "discount_amount"
    | "tax_amount"
    | "total_amount"
    | "status"
    | "remarks"
    | "expected_delivery_date"
    | "converted_sale_id"
    | "reference_code"
    | "created_at"
    | "updated_at"
  > {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public customer_id!: number;
  public order_number!: string;
  public order_date!: Date;
  public expected_delivery_date?: Date | null;
  public subtotal!: number;
  public discount_amount!: number;
  public tax_amount!: number;
  public total_amount!: number;
  public status!: OrderStatus;
  public remarks?: string | null;
  public converted_sale_id?: number | null;
  public reference_code?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Order.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    order_number: { type: DataTypes.STRING(40), allowNull: false },
    order_date: { type: DataTypes.DATE, allowNull: false },
    expected_delivery_date: { type: DataTypes.DATE, allowNull: true },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: false, defaultValue: "pending" },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    converted_sale_id: { type: DataTypes.BIGINT, allowNull: true },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
    indexes: [
      { unique: true, fields: ["owner_id", "shop_id", "order_number"] },
      { fields: ["owner_id", "shop_id"] },
      { fields: ["customer_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"] },
    ],
  }
);
