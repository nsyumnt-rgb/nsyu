-- Migration 04: Suppliers, Purchases & Supplier Ledger (BRD §11, §14, §17 — Phase A)
--
-- ADOPTS the legacy tables if they still exist in the database.
-- Supplier/Purchase models were removed from code in commit 325504a, but the
-- tables were not dropped, so production may still hold `suppliers`,
-- `purchases`, `purchase_items` and `supplier_ledger` WITH real data.
--
-- Therefore this migration:
--   • creates each table ONLY if it is missing, using the legacy column layout;
--   • adds the few new columns with ADD COLUMN IF NOT EXISTS (nullable or defaulted);
--   • relaxes one legacy NOT NULL (purchases.payment_method) so unpaid bills need no method;
--   • drops/renames/rewrites NOTHING and touches no existing rows;
--   • adds no UNIQUE index that existing duplicate data could violate.
--
-- Ledger convention is the LEGACY one (kept so old and new rows reconcile):
--   entry_type 'credit' = increases what we owe the supplier (purchase, opening payable)
--   entry_type 'debit'  = decreases it (payment, return, cancellation)
--   running_balance     = payable AFTER the entry
--
-- Runs as a single statement batch → all-or-nothing on PostgreSQL.
-- The same file is executed at API startup (server.ts → ensurePurchaseSchema).

-- 0. Atomic counters used by utils/referenceCode.ts (already present in production; no-op if so)
CREATE TABLE IF NOT EXISTS public.reference_counters (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  scope VARCHAR(80) NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, scope)
);

-- 1. Suppliers ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  address VARCHAR(255),
  gstin VARCHAR(30),
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  reference_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS suppliers_owner_idx ON public.suppliers (owner_id);

-- 2. Purchases -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  purchase_number VARCHAR(40) NOT NULL,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  notes VARCHAR(255),
  cancel_reason VARCHAR(255),
  actor_type VARCHAR(20) NOT NULL,
  actor_id INTEGER NOT NULL,
  reference_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Legacy column was NOT NULL; an unpaid bill has no payment method.
ALTER TABLE public.purchases ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS returned_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(120);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS purchases_owner_shop_idx ON public.purchases (owner_id, shop_id);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON public.purchases (supplier_id);
-- New column, so no existing row can conflict:
CREATE UNIQUE INDEX IF NOT EXISTS purchases_owner_client_request_uidx
  ON public.purchases (owner_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 3. Purchase line items ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  product_id INTEGER NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  sku VARCHAR(60) NOT NULL,
  quantity INTEGER NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  returned_quantity INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON public.purchase_items (purchase_id);

-- 4. Supplier ledger (append-only) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_ledger (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  entry_type VARCHAR(10) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  running_balance NUMERIC(12,2) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id BIGINT,
  description VARCHAR(255) NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  actor_type VARCHAR(20) NOT NULL,
  actor_id INTEGER NOT NULL,
  reference_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.supplier_ledger ADD COLUMN IF NOT EXISTS purchase_id BIGINT;
ALTER TABLE public.supplier_ledger ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE public.supplier_ledger ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(120);
ALTER TABLE public.supplier_ledger ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
ALTER TABLE public.supplier_ledger ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS supplier_ledger_supplier_idx ON public.supplier_ledger (supplier_id, id);
CREATE INDEX IF NOT EXISTS supplier_ledger_owner_shop_idx ON public.supplier_ledger (owner_id, shop_id);
CREATE INDEX IF NOT EXISTS supplier_ledger_purchase_idx ON public.supplier_ledger (purchase_id);
-- New column, so no existing row can conflict:
CREATE UNIQUE INDEX IF NOT EXISTS supplier_ledger_idempotency_uidx
  ON public.supplier_ledger (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
