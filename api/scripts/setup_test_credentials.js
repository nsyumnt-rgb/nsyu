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

async function main() {
  await sequelize.authenticate();
  console.log('Database connected successfully.');

  // Check Owners
  const [owners] = await sequelize.query('SELECT id, name, email, status FROM owners;');
  console.log('Existing Owners:', owners);

  // Set known password for primary owner (nsyu.mnt@gmail.com or id=1)
  const defaultPassword = 'Password@123';
  const hashed = await bcrypt.hash(defaultPassword, 10);

  if (owners.length > 0) {
    const ownerEmail = owners[0].email;
    await sequelize.query('UPDATE owners SET password = :password, status = \'active\' WHERE id = :id', {
      replacements: { password: hashed, id: owners[0].id }
    });
    console.log(`Updated Owner (${ownerEmail}) password to: "${defaultPassword}"`);
  }

  // Check Employees
  const [employees] = await sequelize.query('SELECT id, name, email, owner_id, status FROM employees;');
  console.log('Existing Employees:', employees);

  if (employees.length > 0) {
    await sequelize.query('UPDATE employees SET password = :password, status = \'active\' WHERE id = :id', {
      replacements: { password: hashed, id: employees[0].id }
    });
    console.log(`Updated Employee (${employees[0].email}) password to: "${defaultPassword}"`);
  } else {
    // Create a demo staff employee under owner 1
    const [roles] = await sequelize.query('SELECT id, name FROM roles WHERE name ILIKE \'%staff%\' OR code = \'staff\' LIMIT 1;');
    const [shops] = await sequelize.query('SELECT id, name FROM shops WHERE owner_id = :ownerId LIMIT 1;', {
      replacements: { ownerId: owners[0].id }
    });

    if (shops.length > 0) {
      const [empRes] = await sequelize.query(
        `INSERT INTO employees (name, email, password, phone, owner_id, status, created_at, updated_at)
         VALUES ('Staff User', 'staff@nsyu.com', :password, '9876543210', :ownerId, 'active', NOW(), NOW())
         ON CONFLICT (email, owner_id) DO UPDATE SET password = :password, status = 'active'
         RETURNING id;`,
        { replacements: { password: hashed, ownerId: owners[0].id } }
      );
      const empId = empRes[0]?.id;
      if (empId && roles.length > 0) {
        await sequelize.query(
          `INSERT INTO employee_shops (employee_id, shop_id, role_id, created_at, updated_at)
           VALUES (:empId, :shopId, :roleId, NOW(), NOW())
           ON CONFLICT DO NOTHING;`,
          { replacements: { empId, shopId: shops[0].id, roleId: roles[0].id } }
        );
      }
      console.log('Created/Updated Demo Staff employee: staff@nsyu.com / ' + defaultPassword);
    }
  }

  await sequelize.close();
  console.log('Credential setup completed successfully.');
}

main().catch(err => {
  console.error('Error setting test credentials:', err);
  process.exit(1);
});
