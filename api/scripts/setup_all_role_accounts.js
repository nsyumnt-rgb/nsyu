const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sequelize = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const CORE_MODULES = [
  "all_shops", "shop_settings", "user_management", "role_permissions",
  "products", "stock_management", "billing", "sales_purchases",
  "customers", "orders", "accounts_expenses", "reports",
  "subscriptions", "system_settings"
];

async function main() {
  await sequelize.authenticate();
  console.log('Database connected.');

  const defaultPassword = 'Password@123';
  const hashed = await bcrypt.hash(defaultPassword, 10);

  const [owners] = await sequelize.query('SELECT id, email FROM owners LIMIT 1');
  const [shops] = await sequelize.query('SELECT id, name FROM shops WHERE owner_id = :ownerId LIMIT 1', {
    replacements: { ownerId: owners[0].id }
  });
  const ownerId = owners[0].id;
  const shopId = shops[0]?.id;

  // Update existing role 13 (Admin) permissions
  await sequelize.query('UPDATE role_permissions SET can_view=true, can_create=true, can_edit=true, can_delete=true WHERE role_id = 13');
  for (const m of CORE_MODULES) {
    await sequelize.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
       VALUES (13, :m, true, true, true, true, NOW(), NOW())
       ON CONFLICT (role_id, module) DO UPDATE SET can_view=true, can_create=true, can_edit=true, can_delete=true;`,
      { replacements: { m } }
    );
  }
  console.log('Admin Role 13 permissions updated.');

  const rolesToSetup = [
    { name: 'Super Admin User', email: 'superadmin@nsyu.com', roleId: 14, roleName: 'Super Admin' },
    { name: 'Admin Manager', email: 'admin@nsyu.com', roleId: 13, roleName: 'Admin' },
    { name: 'Staff User', email: 'staff@nsyu.com', roleId: 16, roleName: 'Staff' },
    { name: 'Portal User', email: 'user@nsyu.com', roleId: 17, roleName: 'User' },
  ];

  for (const r of rolesToSetup) {
    const [empRes] = await sequelize.query(
      `INSERT INTO employees (name, email, password, phone, owner_id, status, created_at, updated_at)
       VALUES (:name, :email, :password, '9876543210', :ownerId, 'active', NOW(), NOW())
       ON CONFLICT (email, owner_id) DO UPDATE SET password = :password, status = 'active'
       RETURNING id;`,
      { replacements: { name: r.name, email: r.email, password: hashed, ownerId } }
    );
    const empId = empRes[0]?.id;
    if (empId && shopId) {
      await sequelize.query(
        `INSERT INTO employee_shops (employee_id, shop_id, role_id, created_at, updated_at)
         VALUES (:empId, :shopId, :roleId, NOW(), NOW())
         ON CONFLICT (employee_id, shop_id) DO UPDATE SET role_id = :roleId;`,
        { replacements: { empId, shopId, roleId: r.roleId } }
      );
      console.log(`Role [${r.roleName}] Account: ${r.email} / ${defaultPassword} (Emp ID: ${empId}, Role ID: ${r.roleId})`);
    }
  }

  await sequelize.close();
  console.log('All role accounts & permissions successfully synced!');
}

main().catch(err => {
  console.error('Error in setup_all_role_accounts:', err);
  process.exit(1);
});
