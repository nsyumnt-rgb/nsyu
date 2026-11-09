import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface PlatformAuditLogAttributes {
  id: number;
  super_admin_id: number;
  super_admin_email: string;
  action: string;
  target_type: string;
  target_id?: number | null;
  target_name?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  created_at?: Date;
}

export interface PlatformAuditLogCreationAttributes
  extends Optional<
    PlatformAuditLogAttributes,
    "id" | "target_id" | "target_name" | "details" | "ip_address" | "created_at"
  > {}

export class PlatformAuditLog
  extends Model<PlatformAuditLogAttributes, PlatformAuditLogCreationAttributes>
  implements PlatformAuditLogAttributes
{
  public id!: number;
  public super_admin_id!: number;
  public super_admin_email!: string;
  public action!: string;
  public target_type!: string;
  public target_id?: number | null;
  public target_name?: string | null;
  public details?: Record<string, any> | null;
  public ip_address?: string | null;
  public readonly created_at!: Date;
}

PlatformAuditLog.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    super_admin_id: { type: DataTypes.INTEGER, allowNull: false },
    super_admin_email: { type: DataTypes.STRING(150), allowNull: false },
    action: { type: DataTypes.STRING(100), allowNull: false },
    target_type: { type: DataTypes.STRING(50), allowNull: false },
    target_id: { type: DataTypes.INTEGER, allowNull: true },
    target_name: { type: DataTypes.STRING(150), allowNull: true },
    details: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    ip_address: { type: DataTypes.STRING(50), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: "PlatformAuditLog",
    tableName: "platform_audit_log",
    timestamps: false,
    indexes: [
      { fields: ["super_admin_id"] },
      { fields: ["action"] },
      { fields: ["created_at"] },
    ],
  }
);

export default PlatformAuditLog;
