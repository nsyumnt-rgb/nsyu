const path = require('path');
const fs = require('fs');
const { Client } = require(path.resolve(__dirname, '../api/node_modules/pg'));

const config = {
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const client = new Client(config);
  await client.connect();

  console.log('Connected to PostgreSQL database on Supabase.');

  // 1. All tables and row counts
  const tablesRes = await client.query(`
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `);

  const results = [];
  for (const row of tablesRes.rows) {
    const t = row.table_name;
    const countRes = await client.query(`SELECT count(*)::int AS count FROM "${t}"`);
    const count = countRes.rows[0].count;

    // Get foreign keys referencing this table (incoming)
    const inFkRes = await client.query(`
      SELECT tc.table_name AS from_table, kcu.column_name AS from_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = $1
    `, [t]);

    // Get foreign keys this table has (outgoing)
    const outFkRes = await client.query(`
      SELECT ccu.table_name AS to_table, ccu.column_name AS to_column, kcu.column_name AS from_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [t]);

    results.push({
      table: t,
      rowCount: count,
      inFks: inFkRes.rows.map(r => `${r.from_table}.${r.from_column}`),
      outFks: outFkRes.rows.map(r => `${r.from_column} -> ${r.to_table}.${r.to_column}`)
    });
  }

  // 2. Views
  const viewsRes = await client.query(`
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema = 'public';
  `);

  // 3. Check specific EMI and Return tables
  const emiPlansCount = results.find(r => r.table === 'emi_plans')?.rowCount ?? 'N/A';
  const emiInstCount = results.find(r => r.table === 'emi_installments')?.rowCount ?? 'N/A';
  const saleReturnsCount = results.find(r => r.table === 'sale_returns')?.rowCount ?? 'N/A';
  const saleReturnItemsCount = results.find(r => r.table === 'sale_return_items')?.rowCount ?? 'N/A';
  const supplierReturnsCount = results.find(r => r.table === 'supplier_returns')?.rowCount ?? 'N/A';

  console.log('--- EMI and Returns Row Counts ---');
  console.log(`emi_plans: ${emiPlansCount}`);
  console.log(`emi_installments: ${emiInstCount}`);
  console.log(`sale_returns: ${saleReturnsCount}`);
  console.log(`sale_return_items: ${saleReturnItemsCount}`);
  console.log(`supplier_returns: ${supplierReturnsCount}`);

  // 4. Check core billing tables
  const salesCount = results.find(r => r.table === 'sales')?.rowCount ?? 'N/A';
  const saleItemsCount = results.find(r => r.table === 'sale_items')?.rowCount ?? 'N/A';
  const billsExists = results.some(r => r.table === 'bills') || viewsRes.rows.some(r => r.table_name === 'bills');
  const billItemsExists = results.some(r => r.table === 'bill_items') || viewsRes.rows.some(r => r.table_name === 'bill_items');

  console.log('--- Core Billing Tables ---');
  console.log(`sales: ${salesCount}`);
  console.log(`sale_items: ${saleItemsCount}`);
  console.log(`bills exists: ${billsExists}`);
  console.log(`bill_items exists: ${billItemsExists}`);

  fs.writeFileSync(path.resolve(__dirname, 'detailed_live_db_inventory.json'), JSON.stringify({
    tables: results,
    views: viewsRes.rows
  }, null, 2));

  console.log(`Detailed audit finished for ${results.length} tables and ${viewsRes.rows.length} views.`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

