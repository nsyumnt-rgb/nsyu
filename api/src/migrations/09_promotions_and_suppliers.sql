-- Migration 09: Promotional Announcements & Supplier Self-Service Authentication
-- Additive & idempotent.

ALTER TABLE public.shop_portal_settings
  ADD COLUMN IF NOT EXISTS announcement_banner TEXT,
  ADD COLUMN IF NOT EXISTS announcement_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS suppliers_owner_phone_idx ON public.suppliers (owner_id, TRIM(phone)) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_owner_email_idx ON public.suppliers (owner_id, LOWER(TRIM(email))) WHERE email IS NOT NULL;
