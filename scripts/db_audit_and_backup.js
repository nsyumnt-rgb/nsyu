// scripts/db_audit_and_backup.js
// NSYU Complete Database Audit and Backup Tool

const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../api/node_modules/pg'));

const config = {
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
};

const backupDir = path.join(__dirname, '..', 'backups', `db_backup_${Date.now()}`);

async function runAuditAndBackup() {
  console.log('Connecting to Supabase PostgreSQL database...');
  const client = new Client(config);
  await client.connect();
  console.log('Connected successfully.\n');

  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Created backup directory: ${backupDir}\n`);

  // 1. Get all user tables in public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables in schema 'public'.\n`);

  // 2. Get Foreign Key dependencies
  const fkRes = await client.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      rc.delete_rule AS on_delete
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  fs.writeFileSync(
    path.join(backupDir, 'foreign_keys.json'),
    JSON.stringify(fkRes.rows, null, 2)
  );

  // 3. Count rows, fetch data, and create backup per table
  const auditReport = [];
  const fullBackup = {};

  for (const table of tables) {
    try {
      const countRes = await client.query(`SELECT COUNT(*) AS total FROM "${table}"`);
      const rowCount = parseInt(countRes.rows[0].total, 10);

      // Fetch all rows for backup
      const dataRes = await client.query(`SELECT * FROM "${table}"`);
      const rows = dataRes.rows;

      fullBackup[table] = rows;
      fs.writeFileSync(
        path.join(backupDir, `${table}.json`),
        JSON.stringify(rows, null, 2)
      );

      // Inspect sample data for classification
      const sample = rows.slice(0, 3);

      auditReport.push({
        table,
        rowCount,
        sample
      });

      console.log(`✔ [${table}]: ${rowCount} rows backed up`);
    } catch (err) {
      console.error(`❌ Failed to backup table [${table}]:`, err.message);
      auditReport.push({
        table,
        rowCount: -1,
        error: err.message
      });
    }
  }

  // Save complete consolidated backup metadata
  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      database: config.database,
      host: config.host,
      tableCount: tables.length,
      auditReport: auditReport.map(a => ({ table: a.table, rowCount: a.rowCount }))
    }, null, 2)
  );

  console.log(`\n====================================================`);
  console.log(`COMPLETE DATABASE BACKUP CREATED AT:`);
  console.log(`${backupDir}`);
  console.log(`====================================================\n`);

  // 4. Generate Markdown Summary for review
  let summaryMd = `# Database Audit & Row Count Report\n\n`;
  summaryMd += `**Date:** ${new Date().toISOString()}\n`;
  summaryMd += `**Total Tables Audited:** ${tables.length}\n`;
  summaryMd += `**Backup Location:** \`${backupDir}\`\n\n`;
  summaryMd += `| # | Table Name | Total Rows | Classification | Retain Target |\n`;
  summaryMd += `|---|---|---|---|---|\n`;

  let idx = 1;
  for (const item of auditReport) {
    summaryMd += `| ${idx++} | \`${item.table}\` | ${item.rowCount} | Pending | Pending |\n`;
  }

  fs.writeFileSync(path.join(backupDir, 'audit_summary.md'), summaryMd);

  await client.end();
  return { backupDir, auditReport, fkList: fkRes.rows };
}

runAuditAndBackup().catch(err => {
  console.error('Fatal error during audit and backup:', err);
  process.exit(1);
});
