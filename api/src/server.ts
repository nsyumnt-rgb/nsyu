import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { sequelize } from "./models";

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

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    await ensureSingleLedgerSchema();

    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`🚀 NSYU Business API running on port ${PORT} (0.0.0.0)`);
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
