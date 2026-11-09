import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface StatusHistoryAttributes {
  id: number;
  shop_id: number;
  entity_type: string; // 'bill', 'order', 'payment', 'shop', 'customer'
  entity_id: number;
  old_status?: string | null;
  new_status: string;
  changed_by_id?: number | null;
  changed_by_role?: string | null;
  reason?: string | null;
  created_at?: Date;
}

export interface StatusHistoryCreationAttributes
  extends Optional<
    StatusHistoryAttributes,
    "id" | "old_status" | "changed_by_id" | "changed_by_role" | "reason" | "created_at"
  > {}

export class StatusHistory
  extends Model<StatusHistoryAttributes, StatusHistoryCreationAttributes>
  implements StatusHistoryAttributes
{
  public id!: number;
  public shop_id!: number;
  public entity_type!: string;
  public entity_id!: number;
  public old_status?: string | null;
  public new_status!: string;
  public changed_by_id?: number | null;
  public changed_by_role?: string | null;
  public reason?: string | null;
  public readonly created_at!: Date;
}

StatusHistory.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: false },
    entity_id: { type: DataTypes.BIGINT, allowNull: false },
    old_status: { type: DataTypes.STRING(50), allowNull: true },
    new_status: { type: DataTypes.STRING(50), allowNull: false },
    changed_by_id: { type: DataTypes.INTEGER, allowNull: true },
    changed_by_role: { type: DataTypes.STRING(50), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: "StatusHistory",
    tableName: "status_history",
    timestamps: false,
    indexes: [
      { fields: ["shop_id"] },
      { fields: ["entity_type", "entity_id"] },
      { fields: ["created_at"] },
    ],
  }
);

export default StatusHistory;

