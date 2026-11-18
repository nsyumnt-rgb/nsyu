-- Migration 08: Shop policies (Privacy Policy, Terms & Conditions, Return Policy)
-- Additive + idempotent. Adds policy columns to shop_portal_settings.

ALTER TABLE public.shop_portal_settings
  ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS return_policy TEXT;
