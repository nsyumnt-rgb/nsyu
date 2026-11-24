import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

import app from "./app";
import { DataTypes } from "sequelize";
import { sequelize, Product } from "./models";
import { setVisibilityColumnReady } from "./utils/productVisibility";
import { startMessagingWorker } from "./utils/messaging/engine";

const PORT = process.env.PORT || 5000;

async function ensureSingleLedgerSchema() {
  try {
    if (sequelize.getDialect() !== "postgres") return;
    await sequelize.query(`
      ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
      ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS sale_id BIGINT REFERENCES public.sales(id) ON DELETE SET NULL;
      ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL;
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';
      ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(120);
      ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;
      ALTER TABLE public.products ADD COLUMN IF NOT EXISTS live_price NUMERIC(12, 2);
      ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS alias VARCHAR(20);
      CREATE UNIQUE INDEX IF NOT EXISTS sales_unique_order_id_uidx ON public.sales (order_id) WHERE order_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS sales_owner_client_request_uidx ON public.sales (owner_id, client_request_id) WHERE client_request_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS customer_ledger_idempotency_key_uidx ON public.customer_ledger (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS customer_ledger_credit_ref_code_uidx ON public.customer_ledger (owner_id, reference_code) WHERE reference_code IS NOT NULL AND entry_type = 'credit' AND status = 'active';
      ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150);
      ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS supabase_uid UUID;
      CREATE UNIQUE INDEX IF NOT EXISTS customers_owner_email_uidx ON public.customers (owner_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';
      CREATE UNIQUE INDEX IF NOT EXISTS customers_owner_phone_uidx ON public.customers (owner_id, TRIM(phone)) WHERE phone IS NOT NULL AND TRIM(phone) != '';
      ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS supabase_uid UUID;
      CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_owner_email_uidx ON public.customer_accounts (owner_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
          UPDATE public.customer_ledger cl
          SET
            reference_type = CASE WHEN p.sale_id IS NOT NULL THEN 'SalePayment' ELSE 'Payment' END,
            reference_id = COALESCE(p.sale_id, cl.reference_id),
            payment_method = COALESCE(p.method::text, cl.payment_method, 'cash'),
            notes = COALESCE(p.notes, cl.notes),
            reference_code = COALESCE(cl.reference_code, p.reference_code)
          FROM public.payments p
          WHERE cl.reference_type = 'Payment' AND cl.reference_id = p.id;
          DROP TABLE IF EXISTS public.payments CASCADE;
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS public.email_notifications (
        id BIGSERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL,
        shop_id INTEGER,
        customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(150),
        notification_type VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 1,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ,
        error_message TEXT,
        reference_type VARCHAR(50),
        reference_id BIGINT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS email_notif_owner_status_idx ON public.email_notifications (owner_id, status);
      CREATE INDEX IF NOT EXISTS email_notif_customer_idx ON public.email_notifications (customer_id);
      CREATE INDEX IF NOT EXISTS email_notif_type_idx ON public.email_notifications (notification_type);
    `);
    console.log("✅ Single ledger schema verified");
  } catch (err) {
    console.warn("⚠️ Single ledger schema check warning:", err);
  }
}

/**
 * Phase A schema (suppliers, purchases, purchase_items, supplier_ledger).
 * Additive + idempotent — mirrors migrations/04_suppliers_purchases_supplier_ledger.sql.
 */
async function runSqlMigration(file: string, okMessage: string) {
  try {
    if (sequelize.getDialect() !== "postgres") return;
    // tsc doesn't copy .sql into dist/, so look next to this file first, then in src/.
    const candidates = [path.join(__dirname, "migrations", file), path.join(__dirname, "..", "src", "migrations", file)];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) throw new Error(`Migration file not found: ${file}`);
    await sequelize.query(fs.readFileSync(found, "utf8"));
    console.log(`✅ ${okMessage}`);
  } catch (err) {
    console.warn(`⚠️ ${okMessage} — check warning:`, err);
  }
}

async function ensurePurchaseSchema() {
  await runSqlMigration("04_suppliers_purchases_supplier_ledger.sql", "Supplier & purchase schema verified");
}

/** MultiShop: customer identity groups (additive, idempotent). */
async function ensureIdentitySchema() {
  await runSqlMigration("05_customer_identity_groups.sql", "Customer identity schema verified");
}

/** MultiShop: shop admin approval status (additive, idempotent). */
async function ensureShopApprovalSchema() {
  await runSqlMigration("06_shop_approval.sql", "Shop approval schema verified");
}

/** Staff accounts: employees table + user_roles assignments (additive, idempotent). */
async function ensureEmployeeSchema() {
  await runSqlMigration("07_employee_accounts.sql", "Employee accounts schema verified");
}

/** Shop store policies: privacy policy, terms, return policy (additive, idempotent). */
async function ensureShopPoliciesSchema() {
  await runSqlMigration("08_shop_policies.sql", "Shop policies schema verified");
}

/** Promotional announcements and supplier authentication (additive, idempotent). */
async function ensurePromotionsAndSuppliersSchema() {
  await runSqlMigration("09_promotions_and_suppliers.sql", "Promotions and supplier auth schema verified");
}

/** Complete Returns Workflow (B2C & B2B) (additive, idempotent). */
async function ensureReturnsSchema() {
  await runSqlMigration("10_returns_workflow.sql", "Returns workflow schema verified");
}

/** Stock transfers between an owner's shops (adopts the legacy table; additive, idempotent). */
async function ensureStockTransferSchema() {
  if (sequelize.getDialect() === "postgres") {
    await runSqlMigration("13_stock_transfers.sql", "Stock transfer schema verified");
    return;
  }
  try {
    const { StockTransfer } = await import("./models/StockTransfer");
    await StockTransfer.sync();
    console.log("✅ Stock transfer schema verified");
  } catch (err) {
    console.warn("⚠️ Stock transfer schema — check warning:", err);
  }
}

/** WhatsApp + Email messaging tables (additive, idempotent). */
async function ensureMessagingSchema() {
  if (sequelize.getDialect() === "postgres") {
    await runSqlMigration("12_messaging.sql", "Messaging schema verified");
    return;
  }
  try {
    const { MessagingSettings, MessageTemplate, MessageCampaign, MessageDelivery, CustomerMessagePreference } = await import("./models/Messaging");
    for (const m of [MessagingSettings, MessageTemplate, MessageCampaign, MessageDelivery, CustomerMessagePreference]) await m.sync();
    console.log("✅ Messaging schema verified");
  } catch (err) {
    console.warn("⚠️ Messaging schema — check warning:", err);
  }
}

/**
 * products.visibility (both | marketplace | pos | hidden). Works on MySQL,
 * Postgres and SQLite. If the column can't be added, the attribute is dropped
 * from the model so product queries keep working without it.
 */
async function ensureProductVisibilitySchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const cols = await qi.describeTable("products");
    if (!cols.visibility) {
      await qi.addColumn("products", "visibility", {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: "both",
      });
      console.log("✅ products.visibility column added");
    }
    setVisibilityColumnReady(true);
  } catch (err) {
    setVisibilityColumnReady(false);
    Product.removeAttribute("visibility");
    console.warn("⚠️ products.visibility unavailable — product visibility rules are off:", err);
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    await ensureSingleLedgerSchema();
    await ensurePurchaseSchema();
    await ensureIdentitySchema();
    await ensureShopApprovalSchema();
    await ensureEmployeeSchema();
    await ensureShopPoliciesSchema();
    await ensurePromotionsAndSuppliersSchema();
    await ensureReturnsSchema();
    await ensureProductVisibilitySchema();
    await ensureMessagingSchema();
    await ensureStockTransferSchema();

    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`🚀 NSYU Business API running on port ${PORT} (0.0.0.0)`);
      startMessagingWorker();
    });
  } catch (err) {
    console.error("❌ Unable to start server:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ Uncaught Exception thrown:", error);
});

start();
