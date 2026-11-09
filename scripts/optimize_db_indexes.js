const path = require('path');
const { Client } = require(path.resolve(__dirname, '../api/node_modules/pg'));

const config = {
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
};

const INDEX_STATEMENTS = [
  // Products & Stock
  'CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);',
  'CREATE INDEX IF NOT EXISTS idx_product_stocks_shop_id ON product_stocks(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_product_locations_shop_id ON product_locations(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_shop_id ON inventory_transactions(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_shop_id ON stock_transfers(from_shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_shop_id ON stock_transfers(to_shop_id);',

  // Sales, Billing & Orders
  'CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_sales_shop_status ON sales(shop_id, status);',
  'CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);',
  'CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);',
  'CREATE INDEX IF NOT EXISTS idx_orders_converted_sale_id ON orders(converted_sale_id);',

  // Purchases
  'CREATE INDEX IF NOT EXISTS idx_purchases_shop_id ON purchases(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);',
  'CREATE INDEX IF NOT EXISTS idx_purchases_shop_status ON purchases(shop_id, status);',

  // Accounting & Ledgers
  'CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);',
  'CREATE INDEX IF NOT EXISTS idx_customer_ledger_shop_id ON customer_ledger(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_shop ON customer_ledger(customer_id, shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_supplier_ledger_shop_id ON supplier_ledger(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_shop ON supplier_ledger(supplier_id, shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_emi_plans_shop_id ON emi_plans(shop_id);',

  // HR & Operations
  'CREATE INDEX IF NOT EXISTS idx_attendance_shop_id ON attendance(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_payrolls_shop_id ON payrolls(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_leave_requests_shop_id ON leave_requests(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_employee_advances_shop_id ON employee_advances(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_employee_incentives_shop_id ON employee_incentives(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_employee_ledger_shop_id ON employee_ledger(shop_id);',

  // Roles, Permissions & Tokens
  'CREATE INDEX IF NOT EXISTS idx_roles_owner_id ON roles(owner_id);',
  'CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);',
  'CREATE INDEX IF NOT EXISTS idx_role_permissions_module_id ON role_permissions(module_id);',
  'CREATE INDEX IF NOT EXISTS idx_supplier_payments_shop_id ON supplier_payments(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_permissions_module_id ON permissions(module_id);',
  'CREATE INDEX IF NOT EXISTS idx_shop_modules_module_id ON shop_modules(module_id);',
  'CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);',
  'CREATE INDEX IF NOT EXISTS idx_user_roles_shop_id ON user_roles(shop_id);',
  'CREATE INDEX IF NOT EXISTS idx_employee_shops_role_id ON employee_shops(role_id);',
  'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_owner_id ON refresh_tokens(owner_id);',
  'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_employee_id ON refresh_tokens(employee_id);'
];

async function optimizeIndexes() {
  const client = new Client(config);
  await client.connect();

  console.log(`Applying ${INDEX_STATEMENTS.length} index optimizations to Supabase PostgreSQL...`);

  let appliedCount = 0;
  for (const sql of INDEX_STATEMENTS) {
    try {
      const start = Date.now();
      await client.query(sql);
      const ms = Date.now() - start;
      const match = sql.match(/INDEX IF NOT EXISTS\s+([a-zA-Z0-9_]+)/);
      const name = match ? match[1] : sql;
      console.log(`✅ [${ms}ms] ${name}`);
      appliedCount++;
    } catch (err) {
      console.error(`❌ Failed on "${sql}":`, err.message);
    }
  }

  console.log(`\nOptimization finished. ${appliedCount}/${INDEX_STATEMENTS.length} indexes verified/created.`);
  await client.end();
}

optimizeIndexes().catch(console.error);

