import sequelize from "../config/database";

async function run() {
  console.log("Checking and migrating stock_transfers table...");
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS transfer_no VARCHAR(50);`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS items JSONB DEFAULT NULL;`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) DEFAULT NULL;`);
  await sequelize.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);

  // Allow product_id to be nullable if multiple items are stored in items JSONB
  await sequelize.query(`ALTER TABLE stock_transfers ALTER COLUMN product_id DROP NOT NULL;`);
  await sequelize.query(`ALTER TABLE stock_transfers ALTER COLUMN quantity DROP NOT NULL;`);

  const desc = await sequelize.getQueryInterface().describeTable("stock_transfers");
  console.log("Updated columns:", Object.keys(desc));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
