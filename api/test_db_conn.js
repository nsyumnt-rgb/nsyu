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
  const info = await client.query('SELECT NOW() as now, current_database(), current_user;');
  console.log('PostgreSQL Connected:', info.rows[0]);

  const counts = await client.query(`
    SELECT 'products' as tbl, count(*)::int as count from "products"
    UNION ALL SELECT 'product_stocks', count(*)::int from "product_stocks"
    UNION ALL SELECT 'categories', count(*)::int from "categories"
    UNION ALL SELECT 'customers', count(*)::int from "customers"
    UNION ALL SELECT 'owners', count(*)::int from "owners"
    UNION ALL SELECT 'shops', count(*)::int from "shops"
    UNION ALL SELECT 'orders', count(*)::int from "orders"
    UNION ALL SELECT 'customer_ledger', count(*)::int from "customer_ledger"
    UNION ALL SELECT 'inventory_transactions', count(*)::int from "inventory_transactions";
  `);
  console.log('Key table counts:');
  console.table(counts.rows);
  await client.end();
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
