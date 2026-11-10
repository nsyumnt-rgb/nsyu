const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'api/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const info = await client.query('SELECT NOW() as now, current_database(), current_user;');
  console.log('PostgreSQL Connected:', info.rows[0]);

  const counts = await client.query(`
    SELECT 'products' as tbl, count(*)::int as count from public.products
    UNION ALL SELECT 'product_stocks', count(*)::int from public.product_stocks
    UNION ALL SELECT 'categories', count(*)::int from public.categories
    UNION ALL SELECT 'customers', count(*)::int from public.customers
    UNION ALL SELECT 'owners', count(*)::int from public.owners
    UNION ALL SELECT 'shops', count(*)::int from public.shops
    UNION ALL SELECT 'orders', count(*)::int from public.orders
    UNION ALL SELECT 'customer_ledger', count(*)::int from public.customer_ledger
    UNION ALL SELECT 'inventory_transactions', count(*)::int from public.inventory_transactions;
  `);
  console.log('Key table counts:');
  console.table(counts.rows);
  await client.end();
}

main().catch(err => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
