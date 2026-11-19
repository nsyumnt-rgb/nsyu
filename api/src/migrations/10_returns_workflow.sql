-- Migration 10: Complete Returns Workflow (B2C & B2B)
-- Ensures sale_returns, sale_return_items, and returned_amount columns are fully defined with indexes and constraints.

-- 1. Ensure returned_amount exists on sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS returned_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. Ensure returned_quantity exists on sale_items table
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

-- 3. Sale Returns header table
CREATE TABLE IF NOT EXISTS public.sale_returns (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id BIGINT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason VARCHAR(255),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  actor_type VARCHAR(20) NOT NULL,
  actor_id INTEGER NOT NULL,
  reference_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Sale Return line items table
CREATE TABLE IF NOT EXISTS public.sale_return_items (
  id BIGSERIAL PRIMARY KEY,
  sale_return_id BIGINT NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id BIGINT NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL
);

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON public.sale_returns (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer_id ON public.sale_returns (customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_owner_shop ON public.sale_returns (owner_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_reference_code ON public.sale_returns (reference_code);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_return_id ON public.sale_return_items (sale_return_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item_id ON public.sale_return_items (sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_product_id ON public.sale_return_items (product_id);
