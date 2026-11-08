import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface OrderStatusHistoryAttributes {
  id: number;
  order_id: number;
  from_status: string;
  to_status: string;
  changed_by_type: "customer" | "user" | "owner" | "employee";
  changed_by_id: number;
  note?: string | null;
  created_at?: Date;
}

export interface OrderStatusHistoryCreationAttributes
  extends Optional<OrderStatusHistoryAttributes, "id" | "note" | "created_at"> {}

export class OrderStatusHistory
  extends Model<OrderStatusHistoryAttributes, OrderStatusHistoryCreationAttributes>
  implements OrderStatusHistoryAttributes
{
  public id!: number;
  public order_id!: number;
  public from_status!: string;
  public to_status!: string;
  public changed_by_type!: "customer" | "user" | "owner" | "employee";
  public changed_by_id!: number;
  public note?: string | null;
  public readonly created_at!: Date;
}

OrderStatusHistory.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.BIGINT, allowNull: false },
    from_status: { type: DataTypes.STRING(50), allowNull: false },
    to_status: { type: DataTypes.STRING(50), allowNull: false },
    changed_by_type: {
      type: DataTypes.ENUM("customer", "user", "owner", "employee"),
      allowNull: false,
    },
    changed_by_id: { type: DataTypes.BIGINT, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "OrderStatusHistory",
    tableName: "order_status_history",
    updatedAt: false,
    indexes: [
      { fields: ["order_id"] },
      { fields: ["created_at"] },
    ],
  }
);

export default OrderStatusHistory;

