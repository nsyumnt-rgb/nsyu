import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export const NOTIFICATION_TYPES = [
  "leave_requested",
  "leave_decided",
  "payroll_finalized",
  "payment_received",
  "emi_overdue",
  "low_stock",
  "sale_cancelled",
  "order_placed",
  "order_status_changed",
  "order_updated",
  "bill_created",
  "bill_cancelled",
  "approval_needed",
  "general",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number] | string;

export type RecipientType = "owner" | "employee" | "customer";

/**
 * A persisted, per-recipient notification. Recipients are either the
 * Owner (recipient_type="owner"), a specific Employee
 * (recipient_type="employee", recipient_id=that employee's id), or a
 * Customer (recipient_type="customer", recipient_id=customerId).
 */
interface NotificationAttributes {
  id: number;
  owner_id: number;
  shop_id?: number | null;
  recipient_type: RecipientType;
  recipient_id: number;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: string | null;
  reference_id?: number | null;
  is_read: boolean;
}

interface NotificationCreationAttributes
  extends Optional<NotificationAttributes, "id" | "shop_id" | "reference_type" | "reference_id" | "is_read"> {}

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id?: number | null;
  public recipient_type!: RecipientType;
  public recipient_id!: number;
  public type!: NotificationType;
  public title!: string;
  public message!: string;
  public reference_type?: string | null;
  public reference_id?: number | null;
  public is_read!: boolean;
  public readonly created_at!: Date;
}

Notification.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    recipient_type: { type: DataTypes.STRING(20), allowNull: false },
    recipient_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(150), allowNull: false },
    message: { type: DataTypes.STRING(500), allowNull: false },
    reference_type: { type: DataTypes.STRING(50), allowNull: true },
    reference_id: { type: DataTypes.BIGINT, allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    updatedAt: false,
    indexes: [
      { fields: ["owner_id", "recipient_type", "recipient_id"] },
      { fields: ["is_read"] },
    ],
  }
);
