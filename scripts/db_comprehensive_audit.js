// scripts/db_comprehensive_audit.js
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

const SEARCH_DIRS = [
  { name: 'api', dir: path.resolve(__dirname, '../api/src') },
  { name: 'web', dir: path.resolve(__dirname, '../web/src') },
  { name: 'app', dir: path.resolve(__dirname, '../App/lib') }
];

function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.dart', '.sql']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (['node_modules', '.git', 'build', 'dist', '.dart_tool'].includes(item.name)) continue;
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.some(ext => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function searchCodebaseForTable(tableName, files) {
  const matches = [];
  // Variations to match: "table_name", 'table_name', `table_name`, from('table_name'), tableName
  const regexes = [
    new RegExp(`\\b${tableName}\\b`, 'i'),
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Check if line contains tableName as exact word or quoted
      if (regexes.some(r => r.test(line))) {
        // Exclude common false positives if table name is short English word
        const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
        matches.push({
          file: relPath,
          line: index + 1,
          snippet: line.trim().slice(0, 80)
        });
      }
    });
  }
  return matches;
}

async function runAudit() {
  console.log('🔍 Connecting to Supabase PostgreSQL for Phase 1 Read-Only Audit...');
  const client = new Client(config);
  await client.connect();

  try {
    // 1. Fetch Tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // 2. Fetch Views
    const viewsRes = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const views = viewsRes.rows;

    // 3. Fetch Enums
    const enumsRes = await client.query(`
      SELECT t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    const enums = enumsRes.rows;

    // 4. Fetch Functions
    const functionsRes = await client.query(`
      SELECT 
        p.proname AS function_name,
        pg_get_function_arguments(p.oid) AS arguments,
        t.typname AS return_type,
        p.prosecdef AS is_security_definer
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type t ON t.oid = p.prorettype
      WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%'
      ORDER BY p.proname;
    `);
    const functions = functionsRes.rows;

    // 5. Fetch Triggers
    const triggersRes = await client.query(`
      SELECT 
        event_object_table AS table_name,
        trigger_name,
        event_manipulation AS event,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `);
    const triggers = triggersRes.rows;

    // 6. Fetch Indexes
    const indexesRes = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    const indexes = indexesRes.rows;

    // 7. Fetch RLS Policies
    const rlsRes = await client.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    const rlsPolicies = rlsRes.rows;

    // 8. Foreign Keys
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

    // 9. Scan Codebase
    console.log('📂 Scanning codebase across api, web, and App...');
    const allCodeFiles = [];
    for (const d of SEARCH_DIRS) {
      allCodeFiles.push(...getAllFiles(d.dir));
    }
    console.log(`Found ${allCodeFiles.length} source code files.`);

    // 10. Audit each table
    const tableAudit = [];
    for (const t of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      const rowCount = Number(countRes.rows[0].count);

      const incoming = fks.filter(f => f.target_table === t).map(f => `${f.source_table}.${f.source_column}`);
      const outgoing = fks.filter(f => f.source_table === t).map(f => `${f.target_table}.${f.target_column}`);

      const codeMatches = searchCodebaseForTable(t, allCodeFiles);

      tableAudit.push({
        table: t,
        rowCount,
        incomingFks: incoming,
        outgoingFks: outgoing,
        codeRefMatchCount: codeMatches.length,
        sampleRefs: codeMatches.slice(0, 5)
      });
    }

    const auditOutput = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTables: tables.length,
        totalViews: views.length,
        totalEnums: enums.length,
        totalFunctions: functions.length,
        totalTriggers: triggers.length,
        totalIndexes: indexes.length,
        totalRlsPolicies: rlsPolicies.length
      },
      tables: tableAudit,
      views,
      enums,
      functions,
      triggers,
      indexes,
      rlsPolicies
    };

    const outPath = path.resolve(__dirname, 'db_audit_comprehensive_result.json');
    fs.writeFileSync(outPath, JSON.stringify(auditOutput, null, 2));
    console.log(`✔ Phase 1 read-only audit complete. Output written to ${outPath}`);

  } finally {
    await client.end();
  }
}

runAudit().catch(err => {
  console.error('❌ Audit script failed:', err);
  process.exit(1);
});

