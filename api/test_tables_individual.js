const { Client } = require('pg');
const client = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tables = ['products', 'product_stocks', 'categories', 'customers', 'owners', 'shops', 'orders', 'customer_ledger', 'inventory_transactions', 'sales', 'sale_items', 'payments', 'notifications'];
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*)::int AS c FROM "${t}"`);
      console.log(`${t}: ${res.rows[0].c}`);
    } catch (e) {
      console.log(`${t}: ERROR: ${e.message}`);
    }
  }
  await client.end();
}
main();
