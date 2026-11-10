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

async function checkNotifs() {
  const c = new Client(config);
  await c.connect();
  const res = await c.query('SELECT count(*)::int AS count FROM notifications');
  console.log('Notifications count:', res.rows[0].count);
  const sample = await c.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 3');
  console.log('Sample notifications:', sample.rows);
  await c.end();
}
checkNotifs().catch(console.error);

