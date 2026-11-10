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
  const products = await client.query('SELECT id, sku FROM products WHERE owner_id = 1;');
  console.log(`Found ${products.rows.length} products for Owner 1`);

  let inserted = 0;
  for (const p of products.rows) {
    let stock = 100;
    if (p.sku === 'edenic') stock = 999;
    else if (p.sku === 'oud-2') stock = 996;

    const res = await client.query(`
      INSERT INTO product_stocks (owner_id, product_id, shop_id, current_stock, min_stock, created_at, updated_at)
      VALUES (1, $1, 1, $2, 10, NOW(), NOW())
      ON CONFLICT (product_id, shop_id) DO UPDATE SET current_stock = EXCLUDED.current_stock
      RETURNING id;
    `, [p.id, stock]);
    inserted++;
  }

  console.log(`Successfully populated/updated ${inserted} stock records in product_stocks for Shop 1.`);
  await client.end();
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
