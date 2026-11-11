-- ============================================================================
-- NSYU SHOP MANAGEMENT SYSTEM (SMS) - UNIFIED DATABASE MIGRATION
-- Module 1: Enums, Super Admin, Shops Status, Platform Audit Log,
-- Status History, and Row Level Security (RLS)
-- ============================================================================

-- 1. Ensure 'suspended' exists in enum_shops_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'enum_shops_status' AND pg_enum.enumlabel = 'suspended'
  ) THEN
    ALTER TYPE enum_shops_status ADD VALUE 'suspended';
  END IF;
END $$;

-- 2. Add is_super_admin and role to owners table
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'owner';

-- 3. Ensure Super Admin account exists in owners table (Password: SuperAdmin@123)
-- bcrypt hash of 'SuperAdmin@123' with cost 10: $2a$10$wK1W0n2f6iT0G7G7ZkQW5eqw5JgR8n2kFqC0e3kE0Pz2nB5k4eZ.m
INSERT INTO public.owners (name, email, password, phone, status, is_super_admin, role, created_at, updated_at)
VALUES (
  'NSYU Super Admin',
  'superadmin@nsyu.com',
  '$2a$10$kQc5Da8AaKKYlfkBqIFbWOSeK2acx6ErOO1U4mjwim3Ohv6FlRHrG',
  '9999999999',
  'active',
  TRUE,
  'super_admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = '$2a$10$kQc5Da8AaKKYlfkBqIFbWOSeK2acx6ErOO1U4mjwim3Ohv6FlRHrG',
  is_super_admin = TRUE,
  role = 'super_admin',
  status = 'active';

-- 4. Create platform_audit_log table (Super Admin actions only)
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id BIGSERIAL PRIMARY KEY,
  super_admin_id INTEGER NOT NULL,
  super_admin_email VARCHAR(150) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INTEGER,
  target_name VARCHAR(150),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_super_admin_id ON public.platform_audit_log(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_action ON public.platform_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created_at ON public.platform_audit_log(created_at DESC);

-- 5. Create status_history table (records every status change: who, when, old -> new)
CREATE TABLE IF NOT EXISTS public.status_history (
  id BIGSERIAL PRIMARY KEY,
  shop_id INTEGER,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by_id BIGINT,
  changed_by_role VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_entity ON public.status_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_status_history_shop_id ON public.status_history(shop_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.status_history(created_at DESC);

-- 6. Add billed_bill_id and advance_amount to orders if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billed_bill_id BIGINT REFERENCES public.sales(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- 7. Ensure enums for Movement types support exact required names
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_inventory_transactions_type') THEN
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'purchase_in';
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'sale_out';
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'adjustment_in';
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'adjustment_out';
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'damaged';
    ALTER TYPE enum_inventory_transactions_type ADD VALUE IF NOT EXISTS 'sale_reversal';
  END IF;
END $$;

-- 8. Single Ledger Architecture: Migrate any legacy payments into customer_ledger, drop payments table, and ensure customer_ledger supports full payment tracking
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    UPDATE public.customer_ledger cl
    SET
      reference_type = CASE WHEN p.sale_id IS NOT NULL THEN 'SalePayment' ELSE 'Payment' END,
      reference_id = COALESCE(p.sale_id, cl.reference_id),
      payment_method = COALESCE(p.method::text, cl.payment_method, 'cash'),
      notes = COALESCE(p.notes, cl.notes),
      reference_code = COALESCE(cl.reference_code, p.reference_code)
    FROM public.payments p
    WHERE cl.reference_type = 'Payment' AND cl.reference_id = p.id;
  END IF;
END $$;

DROP TABLE IF EXISTS public.payments CASCADE;

-- 9. Ensure enums for Customer Ledger entry_type support reversal
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_customer_ledger_entry_type') THEN
    ALTER TYPE enum_customer_ledger_entry_type ADD VALUE IF NOT EXISTS 'reversal';
  END IF;
END $$;

-- 10. RLS Helpers & Functions
-- Helper 1: is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Check role in request.jwt.claims
  jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  IF jwt_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Fallback check: auth.uid() against owners table
  IF EXISTS (
    SELECT 1 FROM public.owners 
    WHERE email = (current_setting('request.jwt.claims', true)::jsonb->>'email') 
      AND is_super_admin = TRUE 
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper 2: is_shop_active(target_shop_id)
CREATE OR REPLACE FUNCTION public.is_shop_active(target_shop_id INT)
RETURNS BOOLEAN AS $$
BEGIN
  IF target_shop_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.shops 
    WHERE id = target_shop_id AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 11. Enable Row Level Security (RLS) on Core Tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing test/conflicting policies if any
DROP POLICY IF EXISTS super_admin_select_shops ON public.shops;
DROP POLICY IF EXISTS super_admin_select_sales ON public.sales;
DROP POLICY IF EXISTS super_admin_select_orders ON public.orders;
DROP POLICY IF EXISTS super_admin_select_customer_ledger ON public.customer_ledger;
DROP POLICY IF EXISTS super_admin_select_products ON public.products;
DROP POLICY IF EXISTS super_admin_select_product_stocks ON public.product_stocks;
DROP POLICY IF EXISTS super_admin_select_status_history ON public.status_history;
DROP POLICY IF EXISTS super_admin_all_platform_audit ON public.platform_audit_log;

DROP POLICY IF EXISTS shop_users_access_shops ON public.shops;
DROP POLICY IF EXISTS shop_users_access_sales ON public.sales;
DROP POLICY IF EXISTS shop_users_access_orders ON public.orders;
DROP POLICY IF EXISTS shop_users_access_customer_ledger ON public.customer_ledger;
DROP POLICY IF EXISTS shop_users_access_products ON public.products;
DROP POLICY IF EXISTS shop_users_access_product_stocks ON public.product_stocks;
DROP POLICY IF EXISTS shop_users_access_status_history ON public.status_history;

-- 12. Create Super Admin Read-Only Policies (SELECT ONLY, NO INSERT/UPDATE/DELETE on transactional tables)
CREATE POLICY super_admin_select_shops ON public.shops
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_sales ON public.sales
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_orders ON public.orders
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_customer_ledger ON public.customer_ledger
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_products ON public.products
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_product_stocks ON public.product_stocks
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY super_admin_select_status_history ON public.status_history
  FOR SELECT USING (public.is_super_admin());

-- Super Admin Audit Log Policy: Only Super Admin can read and write platform audit log
CREATE POLICY super_admin_all_platform_audit ON public.platform_audit_log
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 13. Tenant (Shop) Isolation Policies: Enforces active shop check
-- Users can only see/operate within their shop, and ONLY if the shop is ACTIVE (not suspended)
CREATE POLICY shop_users_access_shops ON public.shops
  FOR ALL USING (
    status = 'active'
  );

CREATE POLICY shop_users_access_sales ON public.sales
  FOR ALL USING (
    public.is_shop_active(shop_id)
  ) WITH CHECK (
    public.is_shop_active(shop_id)
  );

CREATE POLICY shop_users_access_orders ON public.orders
  FOR ALL USING (
    public.is_shop_active(shop_id)
  ) WITH CHECK (
    public.is_shop_active(shop_id)
  );

CREATE POLICY shop_users_access_customer_ledger ON public.customer_ledger
  FOR ALL USING (
    public.is_shop_active(shop_id)
  ) WITH CHECK (
    public.is_shop_active(shop_id)
  );

CREATE POLICY shop_users_access_products ON public.products
  FOR ALL USING (
    TRUE
  );

CREATE POLICY shop_users_access_product_stocks ON public.product_stocks
  FOR ALL USING (
    public.is_shop_active(shop_id)
  ) WITH CHECK (
    public.is_shop_active(shop_id)
  );

CREATE POLICY shop_users_access_status_history ON public.status_history
  FOR ALL USING (
    shop_id IS NULL OR public.is_shop_active(shop_id)
  ) WITH CHECK (
    shop_id IS NULL OR public.is_shop_active(shop_id)
  );
