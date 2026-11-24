-- Migration 12: Centralised WhatsApp + Email messaging (additive, idempotent).
-- New tables only; no existing table or row is changed. Customers are referenced, never copied.

CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL UNIQUE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  wa_phone_number_id VARCHAR(64),
  wa_business_account_id VARCHAR(64),
  wa_display_number VARCHAR(32),
  wa_access_token_enc TEXT,
  wa_app_secret_enc TEXT,
  wa_webhook_verify_token VARCHAR(128),
  wa_api_version VARCHAR(10),
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_sender_name VARCHAR(120),
  email_sender_address VARCHAR(160),
  email_reply_to VARCHAR(160),
  automations JSON,
  festivals JSON,
  credit_days INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messaging_settings_owner_idx ON public.messaging_settings (owner_id);
CREATE INDEX IF NOT EXISTS messaging_settings_wa_phone_idx ON public.messaging_settings (wa_phone_number_id);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  message_type VARCHAR(20) NOT NULL DEFAULT 'transactional',
  whatsapp_body TEXT,
  wa_template_name VARCHAR(120),
  wa_template_language VARCHAR(12),
  wa_template_params JSON,
  email_subject VARCHAR(255),
  email_html TEXT,
  attachments JSON,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS message_templates_owner_shop_idx ON public.message_templates (owner_id, shop_id);

CREATE TABLE IF NOT EXISTS public.message_campaigns (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  created_by_type VARCHAR(20) NOT NULL DEFAULT 'owner',
  created_by_id INTEGER,
  kind VARCHAR(20) NOT NULL DEFAULT 'single',
  title VARCHAR(160),
  message_type VARCHAR(20) NOT NULL DEFAULT 'transactional',
  channels VARCHAR(10) NOT NULL,
  template_id INTEGER,
  whatsapp_body TEXT,
  email_subject VARCHAR(255),
  email_html TEXT,
  attachments JSON,
  variables JSON,
  audience JSON,
  event_type VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  scheduled_at TIMESTAMPTZ,
  recurrence JSON,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS message_campaigns_owner_shop_idx ON public.message_campaigns (owner_id, shop_id);
CREATE INDEX IF NOT EXISTS message_campaigns_status_next_idx ON public.message_campaigns (status, next_run_at);

CREATE TABLE IF NOT EXISTS public.message_deliveries (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  campaign_id INTEGER,
  customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
  channel VARCHAR(10) NOT NULL,
  recipient VARCHAR(255),
  recipient_name VARCHAR(150),
  message_type VARCHAR(20) NOT NULL DEFAULT 'transactional',
  event_type VARCHAR(40),
  template_id INTEGER,
  subject VARCHAR(255),
  body TEXT,
  html TEXT,
  attachments JSON,
  wa_template JSON,
  status VARCHAR(12) NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(160),
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dedupe_key VARCHAR(200),
  reference_type VARCHAR(40),
  reference_id BIGINT,
  log JSON,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS message_deliveries_owner_shop_created_idx ON public.message_deliveries (owner_id, shop_id, created_at);
CREATE INDEX IF NOT EXISTS message_deliveries_campaign_idx ON public.message_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS message_deliveries_status_next_idx ON public.message_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS message_deliveries_provider_idx ON public.message_deliveries (provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_dedupe_uidx ON public.message_deliveries (shop_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_message_preferences (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  allow_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  allow_email BOOLEAN NOT NULL DEFAULT TRUE,
  promo_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  promo_email BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_number VARCHAR(20),
  date_of_birth DATE,
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
  last_inbound_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_message_prefs_owner_customer_uidx ON public.customer_message_preferences (owner_id, customer_id);
