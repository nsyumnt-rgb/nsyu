const { sequelize } = require('./dist/models');

async function syncMissing() {
  await sequelize.authenticate();
  console.log('Synchronizing missing models (CREATE TABLE IF NOT EXISTS)...');
  await sequelize.sync({ alter: false, force: false });
  console.log('✅ Synchronization completed successfully!');
  
  const [tables] = await sequelize.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Total tables in public schema:', tables.length);
  console.log(tables.map(t => t.table_name).join(', '));
}

syncMissing().catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
