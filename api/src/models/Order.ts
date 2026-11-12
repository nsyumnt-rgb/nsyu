import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "confirmed",
  "converted_to_bill",
  "BILLED",
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
  status: OrderStatus | string;
  order_type?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_address?: string | null;
  remarks?: string | null;
  converted_sale_id?: number | null;
  billed_bill_id?: number | null;
  billed_at?: Date | null;
  advance_amount?: number;
  placed_by?: "customer" | "staff" | null;
  customer_account_id?: number | null;
  client_request_id?: string | null;
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
    | "order_type"
    | "payment_method"
    | "payment_status"
    | "shipping_address"
    | "remarks"
    | "expected_delivery_date"
    | "converted_sale_id"
    | "billed_bill_id"
    | "billed_at"
    | "placed_by"
    | "customer_account_id"
    | "client_request_id"
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
  public status!: OrderStatus | string;
  public order_type?: string | null;
  public payment_method?: string | null;
  public payment_status?: string | null;
  public shipping_address?: string | null;
  public remarks?: string | null;
  public converted_sale_id?: number | null;
  public billed_bill_id?: number | null;
  public billed_at?: Date | null;
  public advance_amount?: number;
  public placed_by?: "customer" | "staff" | null;
  public customer_account_id?: number | null;
  public client_request_id?: string | null;
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
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "pending" },
    order_type: { type: DataTypes.STRING(50), defaultValue: "Walk-in" },
    payment_method: { type: DataTypes.STRING(50), defaultValue: "Cash" },
    payment_status: { type: DataTypes.STRING(50), defaultValue: "Pending" },
    shipping_address: { type: DataTypes.TEXT, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    converted_sale_id: { type: DataTypes.BIGINT, allowNull: true },
    billed_bill_id: { type: DataTypes.BIGINT, allowNull: true },
    billed_at: { type: DataTypes.DATE, allowNull: true },
    advance_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    placed_by: { type: DataTypes.ENUM("customer", "staff"), allowNull: true, defaultValue: "staff" },
    customer_account_id: { type: DataTypes.BIGINT, allowNull: true },
    client_request_id: { type: DataTypes.STRING(100), allowNull: true },
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
      { fields: ["client_request_id"] },
      { fields: ["reference_code"] },
    ],
  }
);
