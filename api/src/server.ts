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
