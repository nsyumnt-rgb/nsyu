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

async function inspectKeyTables() {
  const c = new Client(config);
  await c.connect();

  console.log('=== OWNERS ===');
  const owners = await c.query('SELECT id, name, email, phone, role FROM owners');
  console.log(owners.rows);

  console.log('=== SHOPS ===');
  const shops = await c.query('SELECT id, owner_id, name, code, phone, address FROM shops');
  console.log(shops.rows);

  console.log('=== CUSTOMERS ===');
  const customers = await c.query('SELECT id, owner_id, name, phone, email, current_balance FROM customers');
  console.log(customers.rows);

  console.log('=== PRODUCTS (Sample 3) ===');
  const prods = await c.query('SELECT id, owner_id, sku, name, purchase_price, selling_price, min_stock FROM products LIMIT 3');
  console.log(prods.rows);

  console.log('=== PRODUCT STOCKS (Sample 3) ===');
  const stocks = await c.query('SELECT id, product_id, shop_id, current_stock FROM product_stocks LIMIT 3');
  console.log(stocks.rows);

  await c.end();
}
inspectKeyTables().catch(console.error);
