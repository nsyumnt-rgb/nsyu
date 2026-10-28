"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateVisibilitySettings = migrateVisibilitySettings;
const database_1 = __importDefault(require("../config/database"));
async function migrateVisibilitySettings() {
    console.log("Checking visibility_settings table...");
    await database_1.default.query(`
    CREATE TABLE IF NOT EXISTS visibility_settings (
      id SERIAL PRIMARY KEY,
      owner_id INT NOT NULL,
      shop_id INT NOT NULL,
      settings JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_id, shop_id)
    );
  `);
    console.log("Table visibility_settings created or verified.");
    // Seed default settings for owner 1, shop 1 if not exists
    const defaultSettings = {
        // Business Information
        show_purchase_price: true,
        show_margin: true,
        show_cost_price: true,
        show_stock_quantity: true,
        show_customer_outstanding: true,
        show_profit: false, // Hidden by default
        // App Modules
        module_inventory: true,
        module_purchase: true,
        module_sales: true,
        module_billing: true,
        module_customers: true,
        module_suppliers: true,
        module_payments: true,
        module_customer_ledger: true,
        module_emi: false, // Hidden by default
        module_employees: true,
        module_attendance: true,
        module_payroll: true,
        module_reports: true,
        module_shops: true,
        module_roles: true,
        // Product Display
        product_sku: true,
        product_barcode: true,
        product_category_icon: true,
        product_brand: true,
        product_description: false, // Hidden by default
        // Bottom Navigation
        nav_home: true,
        nav_bills: true,
        nav_ledger: true,
        nav_catalog: true,
        nav_orders: true,
    };
    const [existing] = await database_1.default.query(`
    SELECT id FROM visibility_settings WHERE owner_id = 1 AND shop_id = 1
  `);
    if (existing.length === 0) {
        await database_1.default.query(`
      INSERT INTO visibility_settings (owner_id, shop_id, settings, created_at, updated_at)
      VALUES (1, 1, :settings, NOW(), NOW())
    `, {
            replacements: { settings: JSON.stringify(defaultSettings) },
        });
        console.log("Default visibility settings seeded for owner 1, shop 1.");
    }
    else {
        console.log("Visibility settings already exist for owner 1, shop 1.");
    }
}
if (require.main === module) {
    migrateVisibilitySettings()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate_visibility_settings.js.map