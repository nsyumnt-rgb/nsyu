-- Migration 03: Customer Management & Self-Service Portal Auth
-- Adds shop_name and supabase_uid to customers and customer_accounts
-- Enforces unique email and phone constraints per owner

-- 1. Update customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS supabase_uid UUID;

-- Ensure email is trimmed and lowercased for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS customers_owner_email_uidx
  ON public.customers (owner_id, LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) != '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_owner_phone_uidx
  ON public.customers (owner_id, TRIM(phone))
  WHERE phone IS NOT NULL AND TRIM(phone) != '';

-- 2. Update customer_accounts table
ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supabase_uid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_owner_email_uidx
  ON public.customer_accounts (owner_id, LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) != '';

-- Backfill emails into customer_accounts from customers if missing
UPDATE public.customer_accounts ca
SET email = c.email
FROM public.customers c
WHERE ca.customer_id = c.id
  AND (ca.email IS NULL OR ca.email = '')
  AND c.email IS NOT NULL AND c.email != '';

