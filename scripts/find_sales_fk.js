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

async function check() {
  const c = new Client(config);
  await c.connect();

  const res = await c.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%sale%' OR table_name ILIKE '%bill%'
    ORDER BY table_schema, table_name;
  `);
  console.log('Tables matching sale/bill across all schemas:');
  console.log(res.rows);

  const saleItemsFk = await c.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='sale_items';
  `);
  console.log('sale_items foreign keys:');
  console.log(saleItemsFk.rows);

  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name='sale_items' 
    ORDER BY ordinal_position;
  `);
  console.log('sale_items columns:');
  console.log(cols.rows);

  await c.end();
}
check().catch(console.error);
