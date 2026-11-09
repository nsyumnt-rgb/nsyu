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

async function checkIndexes() {
  const client = new Client(config);
  await client.connect();

  console.log("Checking indexes in Supabase PostgreSQL...");

  // 1. Total indexes count
  const { rows: indexRows } = await client.query(`
    SELECT tablename, indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY tablename, indexname;
  `);

  console.log(`Found ${indexRows.length} indexes in public schema.`);

  // 2. Foreign keys without an index on the referencing columns
  const { rows: missingFkIndexes } = await client.query(`
    SELECT
      c.conrelid::regclass AS table_name,
      c.conname AS fk_name,
      pg_get_constraintdef(c.oid) AS fk_def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::int[])[0:cardinality(c.conkey)-1] = c.conkey::int[]
      );
  `);

  console.log(`\nForeign keys without index: ${missingFkIndexes.length}`);
  missingFkIndexes.forEach(r => {
    console.log(`  Table: ${r.table_name} | FK: ${r.fk_name} -> ${r.fk_def}`);
  });

  await client.end();
}

checkIndexes().catch(console.error);
