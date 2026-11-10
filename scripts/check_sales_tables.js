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
    SELECT table_schema, table_name, table_type 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%sale%' OR table_name ILIKE '%bill%' OR table_name ILIKE '%invoice%'
    ORDER BY table_name;
  `);
  console.log('Tables matching sale/bill/invoice:');
  console.log(res.rows);

  // Check all tables in public schema
  const allTables = await c.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('All public tables count:', allTables.rows.length);
  const names = allTables.rows.map(r => r.table_name);
  console.log('Has sales?', names.includes('sales'));
  console.log('Has sale_items?', names.includes('sale_items'));
  console.log('Has bills?', names.includes('bills'));
  console.log('Has bill_items?', names.includes('bill_items'));

  // Also check if sales is spelled differently or in another schema
  const anySales = await c.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name = 'sales' OR table_name = 'bills';
  `);
  console.log('Any table named sales or bills:', anySales.rows);

  await c.end();
}
check().catch(console.error);
