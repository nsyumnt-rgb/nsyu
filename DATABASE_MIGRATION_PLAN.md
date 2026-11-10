# NSYU Business — Phased Database Migration Plan

**Status:** PROPOSAL ONLY — Awaiting User Approval  
**Safety Protocol:** Non-Destructive • Transactional (`BEGIN ... COMMIT`) • Zero Data Loss • Immediate Rollback Available

---

## 1. Migration Overview

This migration formalizes the **8 Core Business Tables** architecture, establishes the missing `bills` and `bill_items` tables, and safely archives unused modules (`emi_plans`, `emi_installments`, `returns`, `payroll`, `attendance`).

To ensure zero downtime and 100% backward compatibility for all existing backend controllers, **PostgreSQL Views** (`sales` pointing to `bills`, `sale_items` pointing to `bill_items`) will be established.

---

## 2. Phased Migration Execution Steps

### Phase 1: Verified Snapshot Backup
Run pg_dump / SQL export of all existing tables, roles, and schema definition before initiating any DDL.

---

### Phase 2: Establish Core Billing Tables (`bills` and `bill_items`)

```sql
-- ============================================================================
-- PHASE 2: CORE BILLING TABLES & BACKWARD-COMPATIBLE VIEWS
-- ============================================================================
BEGIN;

-- 1. Create the authoritative 'bills' table
CREATE TABLE IF NOT EXISTS public.bills (
    id BIGSERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
    shop_id INTEGER NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    invoice_number VARCHAR(40) NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
    is_emi BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    notes VARCHAR(255),
    cancel_reason VARCHAR(255),
    actor_type VARCHAR(20) NOT NULL DEFAULT 'owner',
    actor_id INTEGER NOT NULL DEFAULT 1,
    reference_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bills_shop_invoice UNIQUE (owner_id, shop_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_bills_owner_shop ON public.bills(owner_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_order ON public.bills(order_id);

-- 2. Create the authoritative 'bill_items' table
CREATE TABLE IF NOT EXISTS public.bill_items (
    id BIGSERIAL PRIMARY KEY,
    bill_id BIGINT NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    returned_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON public.bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product ON public.bill_items(product_id);

-- 3. Provide 100% backward-compatible views for existing code expecting 'sales' & 'sale_items'
CREATE OR REPLACE VIEW public.sales AS
SELECT 
    id,
    owner_id,
    shop_id,
    customer_id,
    invoice_number,
    invoice_date,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    paid_amount,
    due_amount,
    payment_method,
    is_emi,
    status,
    notes,
    cancel_reason,
    actor_type,
    actor_id,
    reference_code,
    created_at,
    updated_at
FROM public.bills;

CREATE OR REPLACE VIEW public.sale_items AS
SELECT 
    id,
    bill_id AS sale_id,
    product_id,
    product_name,
    sku,
    quantity,
    rate,
    discount_percent,
    discount_amount,
    tax_percent,
    tax_amount,
    total_amount,
    returned_quantity,
    created_at,
    updated_at
FROM public.bill_items;

COMMIT;
```

---

### Phase 3: Safe Archival of Unused Module Tables
Rather than performing abrupt `DROP TABLE` calls, tables targeted for removal are renamed with the `_deprecated_` prefix. This preserves any historical data while decoupling them from core application operations.

```sql
-- ============================================================================
-- PHASE 3: SAFE ARCHIVAL OF UNUSED TABLES (0 PRODUCTION ROWS)
-- ============================================================================
BEGIN;

-- 1. Unused EMI Module
ALTER TABLE IF EXISTS public.emi_installments RENAME TO _deprecated_emi_installments;
ALTER TABLE IF EXISTS public.emi_plans RENAME TO _deprecated_emi_plans;

-- 2. Unused Returns Module
ALTER TABLE IF EXISTS public.sale_return_items RENAME TO _deprecated_sale_return_items;
ALTER TABLE IF EXISTS public.purchase_return_items RENAME TO _deprecated_purchase_return_items;
ALTER TABLE IF EXISTS public.purchase_returns RENAME TO _deprecated_purchase_returns;

-- 3. Unused HR / Payroll Module
ALTER TABLE IF EXISTS public.attendance RENAME TO _deprecated_attendance;
ALTER TABLE IF EXISTS public.leave_requests RENAME TO _deprecated_leave_requests;
ALTER TABLE IF EXISTS public.payrolls RENAME TO _deprecated_payrolls;
ALTER TABLE IF EXISTS public.salary_configs RENAME TO _deprecated_salary_configs;
ALTER TABLE IF EXISTS public.salary_payments RENAME TO _deprecated_salary_payments;
ALTER TABLE IF EXISTS public.employee_advances RENAME TO _deprecated_employee_advances;
ALTER TABLE IF EXISTS public.employee_incentives RENAME TO _deprecated_employee_incentives;
ALTER TABLE IF EXISTS public.employee_ledger RENAME TO _deprecated_employee_ledger;
ALTER TABLE IF EXISTS public.employee_shops RENAME TO _deprecated_employee_shops;

-- 4. Unused Inventory & Auxiliary Tables
ALTER TABLE IF EXISTS public.stock_transfers RENAME TO _deprecated_stock_transfers;
ALTER TABLE IF EXISTS public.product_locations RENAME TO _deprecated_product_locations;
ALTER TABLE IF EXISTS public.product_images RENAME TO _deprecated_product_images;
ALTER TABLE IF EXISTS public.purchases RENAME TO _deprecated_purchases;
ALTER TABLE IF EXISTS public.purchase_items RENAME TO _deprecated_purchase_items;
ALTER TABLE IF EXISTS public.purchase_counters RENAME TO _deprecated_purchase_counters;
ALTER TABLE IF EXISTS public.customer_carts RENAME TO _deprecated_customer_carts;
ALTER TABLE IF EXISTS public.customer_otps RENAME TO _deprecated_customer_otps;
ALTER TABLE IF EXISTS public.modules RENAME TO _deprecated_modules;

COMMIT;
```

---

## 3. Post-Migration Verification Queries

After applying the migration:
1. Verify `bills` and `bill_items` are accessible:
   ```sql
   SELECT count(*) FROM public.bills;
   SELECT count(*) FROM public.sales;
   SELECT count(*) FROM public.bill_items;
   SELECT count(*) FROM public.sale_items;
   ```
2. Verify core business tables remain intact:
   ```sql
   SELECT 'products' AS tbl, count(*) FROM public.products
   UNION ALL
   SELECT 'product_stocks', count(*) FROM public.product_stocks
   UNION ALL
   SELECT 'categories', count(*) FROM public.categories
   UNION ALL
   SELECT 'customers', count(*) FROM public.customers
   UNION ALL
   SELECT 'owners', count(*) FROM public.owners
   UNION ALL
   SELECT 'shops', count(*) FROM public.shops;
   ```
3. Test insertion into `bills` and verify synchronized reflection in view `sales`.
