-- Migration 07: Employee (staff) accounts
-- Additive + idempotent. Adds the `employees` login table and makes sure the existing
-- `user_roles` assignment table (already modelled in models/UserRole.ts) exists.
-- An employee is assigned a role per shop through user_roles (user_type = 'employee').

CREATE TABLE IF NOT EXISTS public.employees (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(30),
  password    VARCHAR(255) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email is the login identifier: unique across employees (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_uq ON public.employees (LOWER(email));
CREATE INDEX IF NOT EXISTS employees_owner_idx ON public.employees (owner_id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id          SERIAL PRIMARY KEY,
  user_type   VARCHAR(50) NOT NULL,
  user_id     INTEGER NOT NULL,
  role_id     INTEGER NOT NULL,
  shop_id     INTEGER,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_type, user_id);

-- One role per employee per shop. Skipped (not fatal) if older duplicate rows exist.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS user_roles_employee_shop_uq
    ON public.user_roles (user_id, shop_id) WHERE user_type = 'employee';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'user_roles_employee_shop_uq not created: duplicate assignments exist';
END $$;
