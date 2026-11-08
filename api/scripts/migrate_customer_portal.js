const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com';
const DB_USER = process.env.DB_USER || 'postgres.lggjtxzannywecuvwqbl';
const DB_PASS = process.env.DB_PASS || 'Nsyu@8800503662';
const DB_NAME = process.env.DB_NAME || 'postgres';
const DB_PORT = Number(process.env.DB_PORT) || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function migrate() {
  await sequelize.authenticate();
  console.log('✅ Connected to Supabase PostgreSQL database.');

  const t = await sequelize.transaction();
  try {
    // 1. customer_accounts
    console.log('Creating customer_accounts table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id BIGSERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        password_hash VARCHAR(255),
        last_login_at TIMESTAMPTZ,
        created_by INTEGER,
        approved_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customer_accounts_shop_phone ON customer_accounts(shop_id, phone);
      CREATE INDEX IF NOT EXISTS idx_customer_accounts_owner ON customer_accounts(owner_id);
      CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(status);
    `, { transaction: t });

    // 2. customer_otps
    console.log('Creating customer_otps table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_otps (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT,
        phone VARCHAR(20) NOT NULL,
        shop_id INTEGER NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customer_otps_phone_shop ON customer_otps(phone, shop_id);
      CREATE INDEX IF NOT EXISTS idx_customer_otps_account ON customer_otps(account_id);
      CREATE INDEX IF NOT EXISTS idx_customer_otps_expires ON customer_otps(expires_at);
    `, { transaction: t });

    // 3. customer_refresh_tokens
    console.log('Creating customer_refresh_tokens table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_refresh_tokens (
        id BIGSERIAL PRIMARY KEY,
        account_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        device_info VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customer_refresh_tokens_account ON customer_refresh_tokens(account_id);
      CREATE INDEX IF NOT EXISTS idx_customer_refresh_tokens_hash ON customer_refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_customer_refresh_tokens_expires ON customer_refresh_tokens(expires_at);
    `, { transaction: t });

    // 4. customer_carts
    console.log('Creating customer_carts table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_carts (
        id BIGSERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        shop_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_customer_cart_shop UNIQUE (customer_id, shop_id)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_carts_customer ON customer_carts(customer_id);
    `, { transaction: t });

    // 5. customer_cart_items
    console.log('Creating customer_cart_items table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_cart_items (
        id BIGSERIAL PRIMARY KEY,
        cart_id BIGINT NOT NULL REFERENCES customer_carts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_cart_product UNIQUE (cart_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_cart_items_cart ON customer_cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_customer_cart_items_product ON customer_cart_items(product_id);
    `, { transaction: t });

    // 6. order_status_history
    console.log('Creating order_status_history table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status VARCHAR(50) NOT NULL,
        to_status VARCHAR(50) NOT NULL,
        changed_by_type VARCHAR(50) NOT NULL,
        changed_by_id BIGINT NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_status_history_created ON order_status_history(created_at);
    `, { transaction: t });

    // 7. shop_portal_settings
    console.log('Creating shop_portal_settings table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS shop_portal_settings (
        id BIGSERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
        show_stock_qty BOOLEAN NOT NULL DEFAULT false,
        allow_self_registration BOOLEAN NOT NULL DEFAULT false,
        allow_orders BOOLEAN NOT NULL DEFAULT true,
        min_order_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
        allow_customer_cancel BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction: t });

    // 8. orders table workflow extensions
    console.log('Adding portal columns to orders table...');
    await sequelize.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS placed_by VARCHAR(50) DEFAULT 'staff';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_account_id BIGINT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(100);
    `, { transaction: t });

    // 9. Auto-create customer_accounts for existing customers so they can immediately log in
    console.log('Enabling portal accounts for existing active customers...');
    await sequelize.query(`
      INSERT INTO customer_accounts (customer_id, shop_id, owner_id, phone, status, created_at, updated_at)
      SELECT c.id, s.id, c.owner_id, c.phone, 'active', NOW(), NOW()
      FROM customers c
      CROSS JOIN LATERAL (
        SELECT id FROM shops WHERE owner_id = c.owner_id ORDER BY id ASC LIMIT 1
      ) s
      WHERE c.phone IS NOT NULL AND c.phone != ''
      ON CONFLICT (customer_id) DO NOTHING;
    `, { transaction: t });

    await t.commit();
    console.log('🎉 Customer Portal database migration completed successfully!');
  } catch (err) {
    await t.rollback();
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();

