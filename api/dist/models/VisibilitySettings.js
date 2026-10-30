"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisibilitySettings = exports.DEFAULT_VISIBILITY_SETTINGS = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
exports.DEFAULT_VISIBILITY_SETTINGS = {
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
class VisibilitySettings extends sequelize_1.Model {
}
exports.VisibilitySettings = VisibilitySettings;
VisibilitySettings.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    settings: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: exports.DEFAULT_VISIBILITY_SETTINGS,
    },
}, {
    sequelize: database_1.default,
    modelName: "VisibilitySettings",
    tableName: "visibility_settings",
    indexes: [{ unique: true, fields: ["owner_id", "shop_id"] }],
    underscored: true,
});
//# sourceMappingURL=VisibilitySettings.js.map