import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface VisibilitySettingsMap {
  // Business Information
  show_purchase_price: boolean;
  show_margin: boolean;
  show_cost_price: boolean;
  show_stock_quantity: boolean;
  show_customer_outstanding: boolean;
  show_profit: boolean;

  // App Modules
  module_inventory: boolean;
  module_purchase: boolean;
  module_sales: boolean;
  module_billing: boolean;
  module_customers: boolean;
  module_suppliers: boolean;
  module_payments: boolean;
  module_customer_ledger: boolean;
  module_emi: boolean;
  module_employees: boolean;
  module_attendance: boolean;
  module_payroll: boolean;
  module_reports: boolean;
  module_shops: boolean;
  module_roles: boolean;

  // Product Display
  product_sku: boolean;
  product_barcode: boolean;
  product_category_icon: boolean;
  product_brand: boolean;
  product_description: boolean;

  // Bottom Navigation
  nav_home: boolean;
  nav_bills: boolean;
  nav_ledger: boolean;
  nav_catalog: boolean;
  nav_orders: boolean;
}

export const DEFAULT_VISIBILITY_SETTINGS: VisibilitySettingsMap = {
  show_purchase_price: true,
  show_margin: true,
  show_cost_price: true,
  show_stock_quantity: true,
  show_customer_outstanding: true,
  show_profit: false,

  module_inventory: true,
  module_purchase: true,
  module_sales: true,
  module_billing: true,
  module_customers: true,
  module_suppliers: true,
  module_payments: true,
  module_customer_ledger: true,
  module_emi: false,
  module_employees: true,
  module_attendance: true,
  module_payroll: true,
  module_reports: true,
  module_shops: true,
  module_roles: true,

  product_sku: true,
  product_barcode: true,
  product_category_icon: true,
  product_brand: true,
  product_description: false,

  nav_home: true,
  nav_bills: true,
  nav_ledger: true,
  nav_catalog: true,
  nav_orders: true,
};

interface VisibilitySettingsAttributes {
  id: number;
  owner_id: number;
  shop_id: number;
  settings: VisibilitySettingsMap;
  created_at?: Date;
  updated_at?: Date;
}

interface VisibilitySettingsCreationAttributes
  extends Optional<VisibilitySettingsAttributes, "id" | "created_at" | "updated_at"> {}

export class VisibilitySettings
  extends Model<VisibilitySettingsAttributes, VisibilitySettingsCreationAttributes>
  implements VisibilitySettingsAttributes
{
  public id!: number;
  public owner_id!: number;
  public shop_id!: number;
  public settings!: VisibilitySettingsMap;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

VisibilitySettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: DEFAULT_VISIBILITY_SETTINGS,
    },
  },
  {
    sequelize,
    modelName: "VisibilitySettings",
    tableName: "visibility_settings",
    indexes: [{ unique: true, fields: ["owner_id", "shop_id"] }],
    underscored: true,
  }
);
