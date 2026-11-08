import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface ShopPortalSettingsAttributes {
  id: number;
  shop_id: number;
  show_stock_qty: boolean;
  allow_self_registration: boolean;
  allow_orders: boolean;
  min_order_value: number;
  allow_customer_cancel: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShopPortalSettingsCreationAttributes
  extends Optional<
    ShopPortalSettingsAttributes,
    | "id"
    | "show_stock_qty"
    | "allow_self_registration"
    | "allow_orders"
    | "min_order_value"
    | "allow_customer_cancel"
    | "created_at"
    | "updated_at"
  > {}

export class ShopPortalSettings
  extends Model<ShopPortalSettingsAttributes, ShopPortalSettingsCreationAttributes>
  implements ShopPortalSettingsAttributes
{
  public id!: number;
  public shop_id!: number;
  public show_stock_qty!: boolean;
  public allow_self_registration!: boolean;
  public allow_orders!: boolean;
  public min_order_value!: number;
  public allow_customer_cancel!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ShopPortalSettings.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    shop_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    show_stock_qty: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_self_registration: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_orders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    min_order_value: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allow_customer_cancel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "ShopPortalSettings",
    tableName: "shop_portal_settings",
    indexes: [{ unique: true, fields: ["shop_id"] }],
  }
);

export default ShopPortalSettings;

