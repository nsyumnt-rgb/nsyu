// scripts/audit_db_tables.js
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

async function audit() {
  const client = new Client(config);
  await client.connect();

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Auditing ${tables.length} tables in PostgreSQL...`);

  // Scan api models directory
  const modelFiles = fs.readdirSync(path.resolve(__dirname, '../api/src/models'));
  const modelTableMap = {};
  for (const f of modelFiles) {
    if (!f.endsWith('.ts') || f === 'index.ts') continue;
    const content = fs.readFileSync(path.resolve(__dirname, '../api/src/models', f), 'utf8');
    const tableMatch = content.match(/tableName:\s*["']([^"']+)["']/);
    if (tableMatch) {
      modelTableMap[tableMatch[1]] = f;
    }
  }

  // Check FK dependencies
  const fkRes = await client.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
  `);

  const fks = fkRes.rows;

  const results = [];
  for (const t of tables) {
    const rowCountRes = await client.query(`SELECT COUNT(*) FROM "${t}"`);
    const count = Number(rowCountRes.rows[0].count);
    const model = modelTableMap[t] || null;
    const incomingFks = fks.filter(f => f.target_table === t).map(f => `${f.source_table}.${f.source_column}`);
    const outgoingFks = fks.filter(f => f.source_table === t).map(f => `${f.target_table}.${f.target_column}`);

    results.push({
      table: t,
      rowCount: count,
      model: model || '(None/Untyped)',
      hasModel: !!model,
      incomingFkCount: incomingFks.length,
      incomingFks,
      outgoingFkCount: outgoingFks.length,
      outgoingFks
    });
  }

  await client.end();

  console.log('\n--- TABLES WITH NO MODEL AT ALL ---');
  const noModel = results.filter(r => !r.hasModel);
  console.table(noModel.map(r => ({ table: r.table, rows: r.rowCount, incomingFks: r.incomingFkCount, outgoingFks: r.outgoingFkCount })));

  console.log('\n--- EMPTY TABLES (0 ROWS) ---');
  const emptyTables = results.filter(r => r.rowCount === 0);
  console.log(`Found ${emptyTables.length} empty tables.`);

  console.log('\n--- TABLES WITH ACTIVE MASTER / RETAINED DATA ---');
  const activeTables = results.filter(r => r.rowCount > 0);
  console.table(activeTables.map(r => ({ table: r.table, rows: r.rowCount, model: r.model })));

  fs.writeFileSync(path.resolve(__dirname, 'db_table_audit_report.json'), JSON.stringify(results, null, 2));
  console.log('Saved full report to scripts/db_table_audit_report.json');
}

audit().catch(console.error);

