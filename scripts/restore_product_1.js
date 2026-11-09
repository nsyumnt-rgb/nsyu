const path = require('path');
const { Client } = require(path.resolve(__dirname, '../api/node_modules/pg'));
const fs = require('fs');

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
  const products = JSON.parse(fs.readFileSync('backups/db_backup_1794165380111/products.json'));
  const p = products[0];
  console.log('Inserting product:', p.id, p.name);

  await client.query(`
    INSERT INTO products (
      id, owner_id, name, sku, barcode, category_id, brand, description,
      purchase_price, selling_price, mrp, discount, tax_percent, min_stock,
      supplier_id, status, reference_code, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      purchase_price = EXCLUDED.purchase_price,
      selling_price = EXCLUDED.selling_price;
  `, [
    p.id, p.owner_id, p.name, p.sku, p.barcode, p.category_id, p.brand, p.description,
    p.purchase_price, p.selling_price, p.mrp, p.discount, p.tax_percent, p.min_stock,
    p.supplier_id, p.status, p.reference_code
  ]);

  await client.query(`
    INSERT INTO product_stocks (id, owner_id, product_id, shop_id, current_stock, min_stock, created_at, updated_at)
    VALUES (1, 1, 1, 1, 10000, 5, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET current_stock = 10000;
  `);

  // Ensure sequence is aligned
  await client.query(`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));`);
  await client.query(`SELECT setval('product_stocks_id_seq', (SELECT MAX(id) FROM product_stocks));`);

  const r = await client.query('SELECT id, name, sku, purchase_price FROM products WHERE id = 1');
  console.log('Restored product in DB:', r.rows[0]);
  const s = await client.query('SELECT * FROM product_stocks WHERE product_id = 1');
  console.log('Restored stock in DB:', s.rows[0]);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
