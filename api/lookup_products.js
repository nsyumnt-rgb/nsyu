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
  const res = await client.query("SELECT id, name, sku, purchase_price, selling_price FROM products WHERE name ILIKE '%edenic%' OR name ILIKE '%oud%' LIMIT 5;");
  console.table(res.rows);
  await client.end();
}
main();
