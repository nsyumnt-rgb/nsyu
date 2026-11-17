-- Migration 05: Customer identity groups (MultiShop phase 1, step 3)
-- ADDITIVE and idempotent: one nullable column + index; no existing row changes.
--
-- A customer who shops at several shops has one CustomerAccount per shop (each
-- with its own khata). Accounts that belong to the same person share an
-- identity_group, which is set ONLY when the signed-in customer adds an item
-- from a new shop themself (never by matching phone numbers automatically).
-- NULL means "not linked yet" — the account is its own group.
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS identity_group VARCHAR(64);
CREATE INDEX IF NOT EXISTS customer_accounts_identity_group_idx ON public.customer_accounts (identity_group);
