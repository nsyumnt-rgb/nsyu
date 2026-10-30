const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function verify() {
  await sequelize.authenticate();
  const [roles] = await sequelize.query('SELECT id, code, name, is_system FROM roles ORDER BY id');
  console.log('Roles in DB:');
  console.table(roles);

  const [modules] = await sequelize.query('SELECT id, code, name, sort_order FROM modules ORDER BY sort_order');
  console.log('Modules in DB:');
  console.table(modules);

  const [rolePerms] = await sequelize.query(`
    SELECT r.code as role, rp.module, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete, rp.scope
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    ORDER BY r.id, rp.module;
  `);
  console.log(`Total role_permissions rows: ${rolePerms.length}`);
  
  // Matrix preview
  const matrix = {};
  for (const row of rolePerms) {
    if (!matrix[row.module]) matrix[row.module] = {};
    const check = (row.can_view ? 'V' : '') + (row.can_create ? 'C' : '') + (row.can_edit ? 'E' : '') + (row.can_delete ? 'D' : '');
    matrix[row.module][row.role] = check || '—';
  }
  console.log('Role Permission Matrix:');
  console.table(matrix);

  const [shopModules] = await sequelize.query('SELECT shop_id, module_code, is_enabled FROM shop_modules LIMIT 5');
  console.log('Sample shop_modules:', shopModules);

  const [userRoles] = await sequelize.query('SELECT ur.id, ur.user_type, ur.user_id, r.name as role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id');
  console.log('user_roles:', userRoles);

  await sequelize.close();
}

verify();
