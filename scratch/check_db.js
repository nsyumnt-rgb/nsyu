const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../api/.env');
const env = fs.readFileSync(envPath, 'utf8');
env.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[match[1]] = val;
  }
});

const dbPath = path.resolve(__dirname, '../api/dist/config/database.js');
const dbModule = require(dbPath);
const db = dbModule.default || dbModule;

async function check() {
  try {
    const [tables] = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Public Tables:', tables.map(t => t.table_name));
    process.exit(0);
  } catch (err) {
    console.error('DB query error:', err.message);
    process.exit(1);
  }
}
check();
