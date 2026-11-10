# NSYU System — Production Status & Remaining Work Tracker

**Super Admin:** `superadmin@nsyu.com` | `SuperAdmin@123`  
**Target Production URL:** https://nsyumnt-rgb.github.io/nsyu/#/login  
**Tenant Shop Account:** Shop: `NSYU` (`NSYU-01`) | Email: `nsyu.mnt@gmail.com` | Password: `Password@123`  
**Supabase Database:** `aws-0-ap-south-1.pooler.supabase.com:5432/postgres` (Host: `lggjtxzannywecuvwqbl.supabase.co`)  
**Backend API:** `https://nsyu-backend-api.onrender.com/api`  
**Mobile Release APK (v1.0.9+11):** https://nsyumnt-rgb.github.io/nsyu/downloads/nsyu-business-release.apk  

---

## 1. Current Initiative: Database Cleanup, Consolidation & Architecture Optimization

### Status: Database Audit Complete • Migration Plan Prepared • Awaiting Explicit User Approval

| Phase | Description | Deliverables | Status |
|---|---|---|---|
| **Phase 1** | Live Database Audit (49 tables, 276 indexes, FKs, Row Counts) | [DATABASE_AUDIT.md](file:///u:/2026/11/07/nsyu/DATABASE_AUDIT.md) | **COMPLETED** |
| **Phase 2** | Cleanup & Simplification Strategy (8 Core Tables + Supporting) | [DATABASE_CLEANUP_PLAN.md](file:///u:/2026/11/07/nsyu/DATABASE_CLEANUP_PLAN.md) | **COMPLETED** |
| **Phase 3** | Entity Relationship & Workflow Architecture | [DATABASE_RELATIONSHIPS.md](file:///u:/2026/11/07/nsyu/DATABASE_RELATIONSHIPS.md) | **COMPLETED** |
| **Phase 4** | Phased Zero-Downtime SQL Migration Scripts | [DATABASE_MIGRATION_PLAN.md](file:///u:/2026/11/07/nsyu/DATABASE_MIGRATION_PLAN.md) | **COMPLETED** |
| **Phase 5** | Reversible Rollback SQL & Procedures (<50ms) | [DATABASE_ROLLBACK_PLAN.md](file:///u:/2026/11/07/nsyu/DATABASE_ROLLBACK_PLAN.md) | **COMPLETED** |
| **Phase 6** | End-to-End Workflow & Financial Reconciliation Test Suite | [DATABASE_TEST_REPORT.md](file:///u:/2026/11/07/nsyu/DATABASE_TEST_REPORT.md) | **COMPLETED** |
| **Phase 7** | Master Tracking & Verification Report | [REMAINING_WORK.md](file:///u:/2026/11/07/nsyu/REMAINING_WORK.md) | **UPDATED** |

---

## 2. Core Business Architecture Summary

The target architecture enforces the unified business workflow:
$$\text{Cart} \longrightarrow \text{Order} \longrightarrow \text{Bill} \longrightarrow \text{Customer Ledger} \longrightarrow \text{Inventory Update}$$

### The 8 Primary Business Tables
1. `customers`: Customer master records, phone indexing, and running outstanding due.
2. `customer_ledger`: Double-entry accounting ledger (Debit on bill generation, Credit on payment receipt).
3. `orders`: Order header tracking order status (`pending`, `confirmed`, `processing`, `completed`, `cancelled`).
4. `order_items`: Order line items with price, discount, tax, and quantity snapshots.
5. `bills`: Authoritative invoice master (transitioned from `sales` view; unique invoice numbering).
6. `bill_items`: Invoice product lines (transitioned from `sale_items`).
7. `products`: Master product catalog (184 active items in live DB).
8. `inventory_transactions`: Complete stock ledger (audit trail for stock-in, stock-out, and returns).

### Retained Supporting Tables (17 Tables)
`owners`, `shops`, `employees`, `roles`, `permissions`, `role_permissions`, `role_field_permissions`, `product_stocks`, `categories`, `subcategories`, `payments`, `notifications`, `platform_audit_log`, `status_history`, `invoice_counters`, `reference_counters`, `refresh_tokens`, `customer_refresh_tokens`.

### Unused Modules Proposed for Safe Archival (Zero Live Rows)
- `emi_plans`, `emi_installments`
- `sale_return_items`, `purchase_returns`, `purchase_return_items`, `purchases`, `purchase_items`, `purchase_counters`, `suppliers`
- `attendance`, `leave_requests`, `payrolls`, `salary_configs`, `salary_payments`, `employee_advances`, `employee_incentives`, `employee_ledger`, `employee_shops`
- `customer_carts`, `customer_otps`, `product_locations`, `product_images`, `stock_transfers`, `modules`

*Protocol:* Renamed with `_deprecated_` prefix. Zero data loss. Instant rollback capability.

---

## 3. Prior Feature & UI Enhancements Verified

| Area | Status | Notes |
|---|---|---|
| **Quantity Input Field** | **COMPLETED** | Removed all `+` and `-` quantity steppers. Formatted as single direct editable numeric input `[ Qty ]` (minimum 1) on Web and Mobile. |
| **Removed "+ Add Product" Row** | **COMPLETED** | Removed row from Cart. Products are added exclusively from Catalog. |
| **Shop Settings Authority** | **COMPLETED** | Active Shop Settings in PostgreSQL `shops.settings` govern all calculations (margins, tax-inclusive/exclusive, discounts, payment methods, negative stock). |
| **Cart Financial Summary Layout** | **COMPLETED** | Fixed layout crowding on narrow mobile screens. Grand Total and Discount toggle now have clean, dedicated spacing. |
| **Customer Ledger "Received" Flow** | **COMPLETED** | Verified and tested on mobile emulator. Direct credit to customer ledger with real-time balance adjustment and payment receipt generation. |
| **Short / Negative Stock Billing** | **COMPLETED** | Enabled `allowNegativeStock: true` in Shop Settings. Billing proceeds when stock is short, and stock shows negative (`Stock: -X`) in red. |
| **In-App Notifications** | **COMPLETED** | Added `NotificationsProvider`, dynamic badge counts across screens, deep navigation to bills/orders/catalog/ledger. |
| **Premium Login Page Redesign** | **COMPLETED** | Modern 3D enterprise login UI aligned with user design mock. |

---

## 4. Test Suite & Verification Matrix
- **Backend Jest Tests:** `11/11` suites passed, `79/79` tests passed (`PASS`).
- **Flutter Widget Tests:** `7/7` tests passed (`PASS`).
- **Flutter Analyzer:** 0 issues found (`flutter analyze`).
- **Web Frontend Build:** 0 errors (`npm run build`).
- **Backend TypeScript Compilation:** 0 errors (`npx tsc --noEmit`).

---

## 5. Next Steps Pending Explicit User Approval

1. **User Sign-Off:** Review [DATABASE_AUDIT.md](file:///u:/2026/11/07/nsyu/DATABASE_AUDIT.md) and [DATABASE_MIGRATION_PLAN.md](file:///u:/2026/11/07/nsyu/DATABASE_MIGRATION_PLAN.md).
2. **Execute Phase 2 (Billing Tables & Views):** Apply non-destructive migration creating `bills`, `bill_items`, and backward-compatible views `sales` & `sale_items`.
3. **Execute Phase 3 (Archive Unused Modules):** Rename 24 zero-row unused tables to `_deprecated_*`.
4. **Run Critical E2E Test Suite (T01 - T13):** Execute automated validation script against live database to certify the 8-table workflow.
