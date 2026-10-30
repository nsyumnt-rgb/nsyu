import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface AuditLogAttributes {
  id: number;
  owner_id: number;
  shop_id?: number | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  module: string;
  action: string; // e.g. "create", "update", "delete", "login"
  entity_type?: string | null; // e.g. "Product", "Sale"
  entity_id?: number | null;
  old_value?: string | null; // JSON snapshot of the changed field(s) before the write
  new_value?: string | null; // JSON snapshot of the changed field(s) after the write
  details?: string | null; // JSON string of any extra context
  ip_address?: string | null;
}

interface AuditLogCreationAttributes
  extends Optional<
    AuditLogAttributes,
    "id" | "shop_id" | "entity_type" | "entity_id" | "old_value" | "new_value" | "details" | "ip_address"
  > {}

export class AuditLog
  extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id?: number | null;
  public actor_type!: "owner" | "employee";
  public actor_id!: number;
  public module!: string;
  public action!: string;
  public entity_type?: string | null;
  public entity_id?: number | null;
  public old_value?: string | null;
  public new_value?: string | null;
  public details?: string | null;
  public ip_address?: string | null;
  public readonly created_at!: Date;
}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_type: { type: DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: false },
    module: { type: DataTypes.STRING(50), allowNull: false },
    action: { type: DataTypes.STRING(50), allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: true },
    entity_id: { type: DataTypes.INTEGER, allowNull: true },
    old_value: { type: DataTypes.TEXT, allowNull: true },
    new_value: { type: DataTypes.TEXT, allowNull: true },
    details: { type: DataTypes.TEXT, allowNull: true },
    ip_address: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "AuditLog",
    tableName: "audit_logs",
    updatedAt: false, // logs are immutable, created_at only
    indexes: [
      { fields: ["owner_id"] },
      { fields: ["shop_id"] },
      { fields: ["module"] },
    ],
  }
);
