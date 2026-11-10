const { sequelize } = require('./dist/models');

async function check() {
  await sequelize.authenticate();
  console.log('Sequelize connected successfully to:', sequelize.config.host, sequelize.config.database);
}
check().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
