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
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products'
    ORDER BY ordinal_position;
  `);
  console.log('Columns of products:');
  console.table(res.rows);

  const sample = await client.query('SELECT id, name, sku, purchase_price, selling_price FROM products LIMIT 5;');
  console.log('Sample products:');
  console.table(sample.rows);

  await client.end();
}
main();
