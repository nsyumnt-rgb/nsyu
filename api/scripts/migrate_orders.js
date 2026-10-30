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
  console.log('Connected to PostgreSQL for orders enhancement migration!');

  const t = await sequelize.transaction();
  try {
    // 1. Convert status to VARCHAR(50) so all workflow statuses are supported
    console.log('Altering orders.status to VARCHAR(50)...');
    await sequelize.query(`
      ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
    `, { transaction: t });

    // 2. Add extra workflow columns to orders
    console.log('Adding workflow columns to orders...');
    await sequelize.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'Walk-in';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
    `, { transaction: t });

    // 3. Add GST & tax columns to order_items
    console.log('Adding GST columns to order_items...');
    await sequelize.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) DEFAULT 18.00;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
    `, { transaction: t });

    await t.commit();
    console.log('Orders table enhanced successfully!');
  } catch (err) {
    await t.rollback();
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();

