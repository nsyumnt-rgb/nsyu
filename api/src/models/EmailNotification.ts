import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export type EmailNotificationType =
  | "bill_created"
  | "payment_received"
  | "payment_reminder"
  | "otp"
  | "general";

export type EmailStatus = "pending" | "delivered" | "failed" | "skipped";

interface EmailNotificationAttributes {
  id: number;
  owner_id: number;
  shop_id?: number | null;
  customer_id?: number | null;
  recipient_email: string;
  recipient_name?: string | null;
  notification_type: EmailNotificationType;
  subject: string;
  status: EmailStatus;
  attempts: number;
  max_attempts: number;
  last_attempt_at: Date;
  sent_at?: Date | null;
  error_message?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  payload?: any;
}

interface EmailNotificationCreationAttributes
  extends Optional<
    EmailNotificationAttributes,
    | "id"
    | "shop_id"
    | "customer_id"
    | "recipient_name"
    | "attempts"
    | "max_attempts"
    | "last_attempt_at"
    | "sent_at"
    | "error_message"
    | "reference_type"
    | "reference_id"
    | "payload"
  > {}

export class EmailNotification
  extends Model<EmailNotificationAttributes, EmailNotificationCreationAttributes>
  implements EmailNotificationAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id?: number | null;
  public customer_id?: number | null;
  public recipient_email!: string;
  public recipient_name?: string | null;
  public notification_type!: EmailNotificationType;
  public subject!: string;
  public status!: EmailStatus;
  public attempts!: number;
  public max_attempts!: number;
  public last_attempt_at!: Date;
  public sent_at?: Date | null;
  public error_message?: string | null;
  public reference_type?: string | null;
  public reference_id?: number | null;
  public payload?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmailNotification.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: true },
    recipient_email: { type: DataTypes.STRING(255), allowNull: false },
    recipient_name: { type: DataTypes.STRING(150), allowNull: true },
    notification_type: { type: DataTypes.STRING(50), allowNull: false },
    subject: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    last_attempt_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    reference_type: { type: DataTypes.STRING(50), allowNull: true },
    reference_id: { type: DataTypes.BIGINT, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    sequelize,
    modelName: "EmailNotification",
    tableName: "email_notifications",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["owner_id", "status"] },
      { fields: ["customer_id"] },
      { fields: ["notification_type"] },
      { fields: ["reference_type", "reference_id"] },
    ],
  }
);
