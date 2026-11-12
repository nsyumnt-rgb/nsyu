-- Migration 02: Automatic Bill Payment, Single Ledger & One-Time Order Conversion Workflow
-- Safe, idempotent migration for PostgreSQL / Supabase

-- 1. Sales (Bills) enhancements: source order FK + unique constraint, normalized payment_status, client_request_id
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(120);

UPDATE public.sales
SET payment_status = CASE
  WHEN status = 'paid' THEN 'PAID'
  WHEN status = 'partially_paid' THEN 'PARTIAL'
  WHEN status = 'cancelled' THEN 'CANCELLED'
  ELSE 'UNPAID'
END;

UPDATE public.sales s
SET order_id = o.id
FROM public.orders o
WHERE (o.converted_sale_id = s.id OR o.billed_bill_id = s.id)
  AND s.order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_unique_order_id_uidx
  ON public.sales (order_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_owner_client_request_uidx
  ON public.sales (owner_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- 2. Orders enhancements: billed_at timestamp, BILLED status enum value, unique link to converted bill
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_status') THEN
    ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'BILLED';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_converted_sale_id_uidx
  ON public.orders (converted_sale_id)
  WHERE converted_sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_billed_bill_id_uidx
  ON public.orders (billed_bill_id)
  WHERE billed_bill_id IS NOT NULL;

-- 3. Customer Ledger (Single Ledger) enhancements: sale_id FK, idempotency_key, unique constraints
ALTER TABLE public.customer_ledger
  ADD COLUMN IF NOT EXISTS sale_id BIGINT REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.customer_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

UPDATE public.customer_ledger cl
SET sale_id = cl.reference_id
FROM public.sales s
WHERE cl.sale_id IS NULL
  AND cl.reference_id = s.id
  AND cl.reference_type IN ('Sale', 'SalePayment', 'SaleCancellation', 'SaleReturn');

CREATE INDEX IF NOT EXISTS customer_ledger_sale_id_idx
  ON public.customer_ledger (sale_id);

CREATE UNIQUE INDEX IF NOT EXISTS customer_ledger_idempotency_key_uidx
  ON public.customer_ledger (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_ledger_credit_ref_code_uidx
  ON public.customer_ledger (owner_id, reference_code)
  WHERE reference_code IS NOT NULL AND entry_type = 'credit' AND status = 'active';

