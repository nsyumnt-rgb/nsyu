const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function migrate() {
  await sequelize.authenticate();
  console.log('Connected to Supabase PostgreSQL!');

  const t = await sequelize.transaction();
  try {
    // 1. modules table
    console.log('Creating modules table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction: t });

    // 2. permissions table
    console.log('Creating permissions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
        module_code VARCHAR(50) NOT NULL,
        code VARCHAR(100) UNIQUE NOT NULL,
        action VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction: t });

    // 3. update roles table
    console.log('Updating roles table...');
    await sequelize.query(`
      ALTER TABLE roles ALTER COLUMN owner_id DROP NOT NULL;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS roles_code_idx ON roles(code) WHERE code IS NOT NULL;
    `, { transaction: t });

    // 4. update role_permissions table
    console.log('Updating role_permissions table...');
    await sequelize.query(`
      ALTER TABLE role_permissions ALTER COLUMN module TYPE VARCHAR(100) USING module::text;
      ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE;
      ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'shop';
    `, { transaction: t });

    // 5. shop_modules table
    console.log('Creating shop_modules table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS shop_modules (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        module_code VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(shop_id, module_id)
      );
    `, { transaction: t });

    // 6. user_roles table
    console.log('Creating user_roles table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_type VARCHAR(50) NOT NULL,
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction: t });

    await t.commit();
    console.log('Migration completed successfully!');
  } catch (error) {
    await t.rollback();
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();

