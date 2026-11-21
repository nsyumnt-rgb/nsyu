import { Sequelize } from "sequelize";

// Source: Supabase PostgreSQL (read-only)
const pgSequelize = new Sequelize(
  "postgres",
  "postgres.lggjtxzannywecuvwqbl",
  "Nsyu@8800503662",
  {
    host: "aws-0-ap-south-1.pooler.supabase.com",
    port: 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

// Target: Hostinger MySQL
const mysqlSequelize = new Sequelize(
  "u166803992_nsyu",
  "u166803992_support",
  "Nsyu@8800503662",
  {
    host: "srv1952.hstgr.io",
    port: 3306,
    dialect: "mysql",
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

// Order of tables to ensure proper dependencies
const migrationTables = [
  "owners",
  "shops",
  "roles",
  "modules",
  "permissions",
  "shop_modules",
  "role_permissions",
  "role_field_permissions",
  "user_roles",
  "employees",
  "categories",
  "subcategories",
  "suppliers",
  "products",
  "product_images",
  "product_stocks",
  "inventory_transactions",
  "customers",
  "customer_accounts",
  "customer_otps",
  "customer_refresh_tokens",
  "customer_carts",
  "customer_cart_items",
  "customer_ledger",
  "purchases",
  "purchase_items",
  "supplier_ledger",
  "orders",
  "order_items",
  "order_status_histories",
  "sales",
  "sale_items",
  "sale_returns",
  "sale_return_items",
  "invoice_counters",
  "visibility_settings",
  "shop_portal_settings",
  "status_histories",
  "notifications",
  "email_notifications",
  "audit_logs",
  "platform_audit_logs",
  "refresh_tokens"
];

async function migrate() {
  console.log("⏳ Connecting to Supabase PostgreSQL and Hostinger MySQL...");
  await pgSequelize.authenticate();
  console.log("✅ Supabase PostgreSQL connected.");
  await mysqlSequelize.authenticate();
  console.log("✅ Hostinger MySQL connected.");

  // Import models compiled with MySQL
  // First, set process.env variables so models bind to MySQL
  process.env.DB_DIALECT = "mysql";
  process.env.DB_HOST = "srv1952.hstgr.io";
  process.env.DB_PORT = "3306";
  process.env.DB_NAME = "u166803992_nsyu";
  process.env.DB_USER = "u166803992_support";
  process.env.DB_PASS = "Nsyu@8800503662";

  const { sequelize: targetSequelize } = await import("../src/models");

  console.log("⏳ Syncing MySQL schema (creating all tables)...");
  await targetSequelize.sync({ force: true });
  console.log("✅ All tables created in Hostinger MySQL!");

  await mysqlSequelize.query("SET FOREIGN_KEY_CHECKS = 0;");

  const [pgTables]: any = await pgSequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const existingPgTables = new Set(pgTables.map((r: any) => r.table_name));

  const tablesToMigrate = migrationTables.filter((t) => existingPgTables.has(t));
  // Add any extra tables that exist in PG but not in list
  for (const t of existingPgTables) {
    if (!tablesToMigrate.includes(t as string)) {
      tablesToMigrate.push(t as string);
    }
  }

  console.log(`\n📦 Migrating data for ${tablesToMigrate.length} tables...`);

  for (const table of tablesToMigrate) {
    try {
      // Check if table exists in MySQL
      const [mysqlCheck]: any = await mysqlSequelize.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'u166803992_nsyu' AND TABLE_NAME = '${table}';`
      );
      if (mysqlCheck.length === 0) {
        console.log(`  ⏩ Skipping table '${table}' (not mapped in MySQL models)`);
        continue;
      }

      // Read rows from Postgres
      const [rows]: any = await pgSequelize.query(`SELECT * FROM public."${table}";`);
      if (rows.length === 0) {
        console.log(`  ⚪ '${table}': 0 rows`);
        continue;
      }

      // Convert boolean/object fields for MySQL compatibility if needed
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (row[key] !== null && typeof row[key] === "object" && !(row[key] instanceof Date)) {
            row[key] = JSON.stringify(row[key]);
          } else if (typeof row[key] === "boolean") {
            row[key] = row[key] ? 1 : 0;
          }
        }
      }

      // Batch insert into MySQL
      const BATCH_SIZE = 100;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const columns = Object.keys(batch[0]);
        const quotedCols = columns.map((c) => `\`${c}\``).join(", ");
        const placeholders = `(${columns.map(() => "?").join(", ")})`;
        const allPlaceholders = batch.map(() => placeholders).join(", ");
        const flatValues = batch.flatMap((r: any) => columns.map((c) => r[c]));

        const insertSql = `INSERT INTO \`${table}\` (${quotedCols}) VALUES ${allPlaceholders};`;
        await mysqlSequelize.query(insertSql, { replacements: flatValues });
      }

      console.log(`  ✅ '${table}': ${rows.length} rows migrated`);
    } catch (err: any) {
      console.error(`  ❌ Error migrating table '${table}':`, err.message);
    }
  }

  await mysqlSequelize.query("SET FOREIGN_KEY_CHECKS = 1;");

  console.log("\n🔍 Verification of table row counts in Hostinger MySQL:");
  for (const table of tablesToMigrate) {
    try {
      const [res]: any = await mysqlSequelize.query(`SELECT COUNT(*) as count FROM \`${table}\`;`);
      const count = res[0]?.count ?? res[0]?.COUNT;
      console.log(`  📊 ${table}: ${count} rows`);
    } catch {
      // ignore
    }
  }

  console.log("\n🎉 Full migration to Hostinger MySQL completed successfully!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
