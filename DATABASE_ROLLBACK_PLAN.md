# NSYU Business — Database Rollback Plan

**Safety Protocol:** Transactional • Zero Data Loss • Immediate Reversibility (< 50ms)  
**Scope:** Covers Rollback of Phase 2 (Billing Tables & Views) and Phase 3 (Deprecated Modules Renaming)

---

## 1. Rollback Strategy Overview

The migration was deliberately architected with non-destructive operations:
1. **No Data Deletion:** No table is dropped during migration; unused tables are merely renamed with the prefix `_deprecated_`.
2. **Transactional Execution:** Every migration block runs inside `BEGIN ... COMMIT`. If any step fails, Postgres automatically rolls back the entire block.
3. **Instant Reversibility:** Any phase can be reverted in milliseconds by executing the rollback scripts below without downtime or application redeployment.

---

## 2. Emergency Rollback Triggers

Initiate this rollback procedure immediately if any of the following occur:
- Backend API throws unhandled database errors during order creation, billing, or ledger posting.
- Web or Mobile frontend experiences broken API contracts or missing fields.
- Any integrity constraint violation occurs that prevents standard business operations.
- The business owner or system administrator requests an immediate return to the pre-migration baseline.

---

## 3. Phase 2 Rollback: Revert Core Billing Tables and Views

If `bills` and `bill_items` were created along with the backward-compatible views `sales` and `sale_items`, execute the following script to return to the previous state.

```sql
-- ============================================================================
-- ROLLBACK SCRIPT: PHASE 2 (BILLING TABLES & BACKWARD-COMPATIBLE VIEWS)
-- ============================================================================
BEGIN;

-- Step 1: Drop backward-compatible views
DROP VIEW IF EXISTS public.sale_items CASCADE;
DROP VIEW IF EXISTS public.sales CASCADE;

-- Step 2: Drop newly created bill line items
DROP TABLE IF EXISTS public.bill_items CASCADE;

-- Step 3: Drop newly created bills master table
DROP TABLE IF EXISTS public.bills CASCADE;

COMMIT;
```

> [!NOTE]
> If any new bills were created in production between migration and rollback, export them first using `COPY public.bills TO ...` before running the rollback.

---

## 4. Phase 3 Rollback: Restore All Archived Tables

If Phase 3 renaming was executed (`_deprecated_*`), run the script below to restore every table to its original name. All constraints, foreign keys, indexes, and existing data remain 100% intact.

```sql
-- ============================================================================
-- ROLLBACK SCRIPT: PHASE 3 (RESTORE DEPRECATED TABLES)
-- ============================================================================
BEGIN;

-- 1. Restore EMI Module
ALTER TABLE IF EXISTS public._deprecated_emi_installments RENAME TO emi_installments;
ALTER TABLE IF EXISTS public._deprecated_emi_plans RENAME TO emi_plans;

-- 2. Restore Returns Module
ALTER TABLE IF EXISTS public._deprecated_sale_return_items RENAME TO sale_return_items;
ALTER TABLE IF EXISTS public._deprecated_purchase_return_items RENAME TO purchase_return_items;
ALTER TABLE IF EXISTS public._deprecated_purchase_returns RENAME TO purchase_returns;

-- 3. Restore HR / Payroll Module
ALTER TABLE IF EXISTS public._deprecated_attendance RENAME TO attendance;
ALTER TABLE IF EXISTS public._deprecated_leave_requests RENAME TO leave_requests;
ALTER TABLE IF EXISTS public._deprecated_payrolls RENAME TO payrolls;
ALTER TABLE IF EXISTS public._deprecated_salary_configs RENAME TO salary_configs;
ALTER TABLE IF EXISTS public._deprecated_salary_payments RENAME TO salary_payments;
ALTER TABLE IF EXISTS public._deprecated_employee_advances RENAME TO employee_advances;
ALTER TABLE IF EXISTS public._deprecated_employee_incentives RENAME TO employee_incentives;
ALTER TABLE IF EXISTS public._deprecated_employee_ledger RENAME TO employee_ledger;
ALTER TABLE IF EXISTS public._deprecated_employee_shops RENAME TO employee_shops;

-- 4. Restore Inventory & Auxiliary Tables
ALTER TABLE IF EXISTS public._deprecated_stock_transfers RENAME TO stock_transfers;
ALTER TABLE IF EXISTS public._deprecated_product_locations RENAME TO product_locations;
ALTER TABLE IF EXISTS public._deprecated_product_images RENAME TO product_images;
ALTER TABLE IF EXISTS public._deprecated_purchases RENAME TO purchases;
ALTER TABLE IF EXISTS public._deprecated_purchase_items RENAME TO purchase_items;
ALTER TABLE IF EXISTS public._deprecated_purchase_counters RENAME TO purchase_counters;
ALTER TABLE IF EXISTS public._deprecated_customer_carts RENAME TO customer_carts;
ALTER TABLE IF EXISTS public._deprecated_customer_otps RENAME TO customer_otps;
ALTER TABLE IF EXISTS public._deprecated_modules RENAME TO modules;

COMMIT;
```

---

## 5. Post-Rollback Validation Checklist

After executing the rollback script, run the verification query below to verify table counts and health:

```sql
-- Verify that all tables have returned to their baseline names:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '_deprecated_%';
-- Expected result: 0 rows returned.

-- Verify that all core master records are intact:
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

### Verification Matrix
- [ ] No table remains with `_deprecated_` prefix.
- [ ] Exactly 184 active products verified in `products`.
- [ ] Exactly 90 stock records verified in `product_stocks`.
- [ ] Exactly 8 categories verified in `categories`.
- [ ] Customers, owners, and shops count unchanged.
- [ ] Node.js backend server restarts cleanly without schema errors (`npm --prefix api run start`).
- [ ] Flutter app and web app connect successfully.

