-- Migration 13: Stock transfers between shops of the same owner (re-enabled).
--
-- The StockTransfer model was removed from code in commit 325504a, but the
-- table was not dropped, so production may still hold `stock_transfers` rows.
-- This migration therefore ADOPTS the legacy table:
--   • creates it only if missing, using the legacy column layout;
--   • adds later columns with ADD COLUMN IF NOT EXISTS (nullable or defaulted);
--   • relaxes the legacy NOT NULLs on product_id / quantity (multi-item transfers keep items in JSONB);
--   • drops, renames or rewrites nothing and touches no existing rows.
--
-- Executed at API startup (server.ts → ensureStockTransferSchema). Idempotent.

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  product_id INTEGER NULL,
  from_shop_id INTEGER NOT NULL,
  to_shop_id INTEGER NOT NULL,
  quantity INTEGER NULL,
  notes VARCHAR(255) NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS transfer_no VARCHAR(50);
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS items JSONB DEFAULT NULL;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS reference_code VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.stock_transfers ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.stock_transfers ALTER COLUMN quantity DROP NOT NULL;

CREATE INDEX IF NOT EXISTS stock_transfers_owner_id ON public.stock_transfers (owner_id);
CREATE INDEX IF NOT EXISTS stock_transfers_status ON public.stock_transfers (status);
CREATE INDEX IF NOT EXISTS stock_transfers_transfer_no ON public.stock_transfers (transfer_no);
CREATE INDEX IF NOT EXISTS stock_transfers_from_shop_id ON public.stock_transfers (from_shop_id);
CREATE INDEX IF NOT EXISTS stock_transfers_to_shop_id ON public.stock_transfers (to_shop_id);
