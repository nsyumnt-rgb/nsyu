# NSYU System — Production Deployment & Status Report

**Last Updated:** November 9, 2026  
**Target Production URL:** https://nsyumnt-rgb.github.io/nsyu/#/login  
**Shop Account:** Shop: `NSYU` (`NSYU-01`) | Email: `nsyu.mnt@gmail.com` | Password: `Password@123`  
**Supabase URL:** `https://lggjtxzannywecuvwqbl.supabase.co`  
**Version:** Mobile App `v1.0.6+8` | Customer Portal & Management Web | Node API `v1.0.0`

---

## 1. Executive Summary
This document tracks the deployment and verification of the NSYU retail & management system.
Recent major updates include:
1. **Critical Product Bulk Importer Engine (.csv, .xlsx, .xls):**
   - SheetJS spreadsheet parser supporting CSV, XLSX, and legacy XLS.
   - Robust 3-tier database matching:
     1. SKU / Product Code
     2. Barcode
     3. Normalized composite key: `(Product Name + Brand + Model)`
   - In-file duplicate detection and conflict/ambiguity detection.
   - Price change history audit logging (`AuditLog` records old vs. new purchase price).
   - Strict business invariants: does **NOT** inflate inventory artificially; preserves selling price by default.
   - Interactive Preview UI in Web frontend with 6 KPI cards, filter tabs, and price change review.
2. **Cart UI/UX Modernization (Web & Mobile):**
   - Products represented using **ONLY** `ProductItemIcon` and clear `Product Name`.
   - Clean, uncluttered design with real-time reactivity and zero layout crowding.
3. **Database & Production Integration:**
   - Supabase Postgres schema synced across all 50+ models with `reference_counters` table.
   - 184 products catalog pre-populated for `NSYU`.

---

## 2. Completed Tasks

### A. Product Importer Engine (`api/` & `web/` & `App/`)
- [x] **Universal Spreadsheet Parser (`api/src/utils/productImporter.ts`):**
  - Parses `.csv`, `.xlsx`, and `.xls` buffers using SheetJS (`xlsx`).
  - Flexible column aliases matching standard and custom catalog headers (`Product Name`, `Item`, `Selling Price`, `MRP`, `Purchase Price`, `Cost`, `Barcode`, `SKU`, `GST`, `Category`, `Brand`, `Model`).
  - Strict type coercion and numeric sanitization.
- [x] **3-Tier Product Matching & Invariant Enforcement:**
  - Priority 1: SKU.
  - Priority 2: Barcode.
  - Priority 3: Case-insensitive normalized Name + Brand + Model.
  - Logs purchase price changes to `AuditLog` table.
  - Preserves existing selling prices unless explicitly opted in.
  - Never creates artificial stock transactions without purchase receipts; initial `current_stock` is set cleanly to 0.
  - Atomically executed within PostgreSQL database transactions (`sequelize.transaction`).
- [x] **Interactive Preview UI (`web/src/pages/Products.tsx`):**
  - 3-step modal: Upload/Dropzone -> KPI Summary & Filterable Preview -> Confirmation.
  - 6 KPI status cards: Total, New, Price Changes, Existing, In-File Duplicates, Invalid.
  - Filter tabs and table showing old vs. new purchase price, diff percentage, and status badges.
- [x] **Mobile Import Engine (`App/lib/services/excel_import_service.dart`):**
  - Multi-format import support for `.csv`, `.xlsx`, and `.xls`.
  - 3-tier matching and in-file duplicate detection.

---

### B. Cart UI/UX Modernization
- [x] **Mobile Application (`App/`):**
  - Created `ProductItemIcon` widget (`App/lib/widgets/product_item_icon.dart`) with category-aware vector iconography and image fallback.
  - Customer Portal Cart (`portal_cart_screen.dart`) and Staff Cart (`order_cart_screen.dart`) display strictly Product Icon and Product Name.
  - Instantaneous reactive quantity adjustments and item deletion.
- [x] **Web Application (`web/`):**
  - Created `ProductItemIcon` component (`web/src/components/ProductItemIcon.tsx`).
  - Modernized `PortalCart.tsx` and `Billing.tsx` cart lists.

---

### C. Backend API & Testing (`api/`)
- [x] Full test suite passing: **11 passed, 11 total test suites, 79 passed, 79 total tests**.
  - `tests/product_import.test.ts` (Import, preview, 3-tier matching, price history).
  - `tests/cart_representation_workflow.test.ts` (Cart UI representation, items display, reactivity).
  - `tests/customer_portal.test.ts` (OTP auth, server cart, order conversion, tenant isolation).
  - `tests/multishop_comprehensive.test.ts` (Multi-shop isolation & security).
  - `tests/sales.test.ts` & `tests/purchase.test.ts` (Ledger, inventory, payments, EMI).

---

### D. Database Dummy Data Cleanup & Full Backup
- [x] **Database Audit & Comprehensive Backup:**
  - Audited all 59 tables across PostgreSQL `public` schema in Supabase (`aws-0-ap-south-1.pooler.supabase.com:5432`).
  - Full table-by-table JSON export with foreign keys and manifest stored securely in `backups/db_backup_1794165380111/`.
  - Referential integrity verified across Master tables (Products, Categories, Suppliers, Customers, Shops, Owners), System tables (Roles, RolePermissions, RoleFieldPermissions, ReferenceCounters), and Transaction tables.
- [x] **Controlled Data Retention:**
  - Preserved 1 valid Product (ID 1: `20w C USB DOCK`, SKU `CC-49`, Category `CHARGER`, Supplier `ERD Technologies`), 1 Stock row for Shop 1, 1 Customer, 1 Supplier, 1 Shop, 1 Owner (`nsyu.mnt@gmail.com`), 7 Categories, 18 RBAC Roles, 448 Role Permissions, 112 Field Permissions, 2 Sequence Reference Counters, and valid audit logs.
  - Safely eliminated all temporary test entries with atomic transaction verification.

---

### E. 100% Real Database-Driven UI (Elimination of All Fake/Mock Data)
- [x] **Web Application (`web/`):**
  - **Dashboard (`web/src/pages/Dashboard.tsx`):** Completely removed hardcoded dummy numbers (`1245600`, `820300`, `1875400`, `52400`, `28900`), mock sales fallbacks ("Rahul Sharma", "Priya Verma", "Amit Kumar"), fake low stock products ("iPhone 15", "Samsung Galaxy S24"), fabricated shop donut chart, and hardcoded SVG spline curves. Connected 100% real database metrics and clean empty states with "+ Create Sale" and "+ Record Purchase" actions.
  - **Inventory (`web/src/pages/Inventory.tsx`):** Removed hardcoded metric multipliers, fake adjustment history rows, fake movements table, and hardcoded user dropdowns ("Mohd Nazim", "Ramesh Kumar"). Connected live `InventoryTransaction` records with empty state.
  - **Topbar (`web/src/layouts/Topbar.tsx`):** Removed fallback to "Mohd Nazim"; displays authenticated owner or employee name.
- [x] **Flutter Mobile App (`App/`):**
  - **Bills List (`App/lib/screens/bills_list_screen.dart`):** Deleted `_referenceMockBills()` (8 fake bills). Renders real database bills with clean empty state. Removed hardcoded red notification badge '2' and static phone.
  - **Orders List (`App/lib/screens/orders_screen.dart`):** Deleted `_referenceMockOrders()` (8 fake orders). Renders real database orders with clean empty state. Removed hardcoded red notification badge '2' and static phone.
  - **Customer Ledger (`App/lib/screens/customer_ledger_detail_screen.dart`):** Replaced fake timeline fallback (`INV-261014-001`, `19156.0`) with clean empty state. Replaced 5 mock bill cards and 3 mock order cards with real database entries and empty states. Removed all hardcoded fallbacks to `8800123456`, `Jasola, New Delhi`, and `19000.0`.
  - **Bill & Order Detail Screens:** Removed fake "Amit Sharma" fallbacks (`INV-NSYU-000010` and `ORD-290407`); displays proper not-found error views.
  - **Home Dashboard (`App/lib/screens/home_screen.dart`):** Removed static percentage badges (`↑ 12%`, `↑ 8%`, `↑ 15%`) and `purchasesEstimate` formula. Connected honest chart baseline bars (3px grey tick for zero sales).
  - **More Menu (`App/lib/widgets/more_menu_sheet.dart`):** Removed hardcoded rough estimate tiles (Rahul Verma, Amit Electronics, Suresh Mobile).
  - **Payment Collection (`App/lib/screens/collect_payment_screen.dart`):** Removed fallback to "Krishna Jasola" and `4510.0`.
  - `tests/payroll.test.ts` & `tests/seed.test.ts` (Attendance, leave, salary ledger).

---

## 3. Comprehensive UI & Production Testing Matrix (23 Business Modules + Customer Portal)

All testing was executed against the **LIVE deployed production web application** (`https://nsyumnt-rgb.github.io/nsyu/#/login`) and Supabase PostgreSQL database using automated browser testing with full-page screenshots. Localhost was never used.

### A. Dashboard & Business Modules (1 - 16)

| # | Module Name | Page / Route | Scope & Workflow Tested | Status | Live Screenshot / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | **Dashboard** | `#/app` | Real KPI statistics, sales, purchases, outstanding cards, clean empty states, zero fake data | ✅ **PASS** | `02_dashboard_live.png` |
| **1** | **Products** | `#/app/products` | Master catalog listing, search filtering, Add Product modal, category tags, SKU/Barcode | ✅ **PASS** | `03_products_list.png` |
| **—** | **Product Import** | `#/app/products` | Universal CSV/XLSX/XLS importer modal, 3-tier matching, in-file duplicate prevention, price history | ✅ **PASS** | `04_product_import_modal.png` |
| **2** | **Inventory** | `#/app/inventory` | Inventory overview, product-wise availability, shop-wise stock, stock valuation metrics | ✅ **PASS** | `05_inventory_dashboard.png` |
| **3** | **Current Stock** | `#/app/inventory` | Real-time stock counts, available stock vs. zero-stock states, stock synchronization | ✅ **PASS** | `05_inventory_dashboard.png` |
| **4** | **Stock Movements** | `#/app/inventory` | Stock IN, Stock OUT, live `InventoryTransaction` event history stream, type & actor filters | ✅ **PASS** | `05_inventory_dashboard.png` |
| **5** | **Stock Transfer** | `#/app/inventory` | Inter-shop stock transfer modal, source/destination shop selection, quantity validation | ✅ **PASS** | `07_stock_transfer_modal.png` |
| **6** | **Stock Adjustment** | `#/app/inventory` | Stock adjustment modal (Increase/Decrease), reason selection, atomic stock recalculation | ✅ **PASS** | `06_stock_adjustment_modal.png` |
| **7** | **Low Stock Alerts** | `#/app/inventory` | Dynamic threshold detection, reorder indicators, shop-wise alerts | ✅ **PASS** | `05_inventory_dashboard.png` |
| **8** | **Purchase** | `#/app/purchase` | Purchase order registry, supplier PO listing, purchase item lines, GST & status badges | ✅ **PASS** | `08_purchase_page.png` |
| **9** | **Sales** | `#/app/sales` | Sales orders registry, customer invoice tracking, payment status pills, download options | ✅ **PASS** | `09_sales_page.png` |
| **10** | **Orders** | `#/app/orders` | Order management pipeline, pending/delivered status, convert order-to-bill workflow | ✅ **PASS** | `10_orders_page.png` |
| **11** | **Billing (POS Cart)** | `#/app/billing` | Modernized POS register, cart representation with ProductItemIcon + Product Name ONLY, quantity stepper | ✅ **PASS** | `11_billing_pos.png`, `25_billing_workflow.png` |
| **12** | **Customers** | `#/app/customers` | Customer directory, mobile/email display, current balances, direct customer ledger links | ✅ **PASS** | `12_customers_page.png` |
| **13** | **Suppliers** | `#/app/suppliers` | Supplier master list (`ERD Technologies`), contact info, purchase associations | ✅ **PASS** | `14_suppliers_page.png` |
| **14** | **Payments** | `#/app/payments` | Payment receipts registry, collection mode (Cash, UPI, Card), payment voucher history | ✅ **PASS** | `15_payments_page.png` |
| **15** | **Customer Ledger** | `#/app/ledger` | Authoritative customer ledger, debit/credit reconciliations, date filters, running balances | ✅ **PASS** | `13_customer_ledger.png` |
| **16** | **EMI / Installments** | `#/app/emi` | Installment plan manager, down payment, monthly installments, overdue alerts, schedule list | ✅ **PASS** | `16_emi_installments.png` |

---

### B. People Modules (17 - 19)

| # | Module Name | Page / Route | Scope & Workflow Tested | Status | Live Screenshot / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **17** | **Employees** | `#/app/employees` | Staff & employee directory, assigned roles, phone, department, status badges | ✅ **PASS** | `17_employees_page.png` |
| **18** | **Attendance** | `#/app/attendance` | Daily attendance register, Present/Absent/Half Day status, date filters, attendance history | ✅ **PASS** | `18_attendance_page.png` |
| **19** | **Salary / Payroll** | `#/app/payroll` | Monthly payroll register, allowances, deductions, net salary generation, salary slips | ✅ **PASS** | `19_payroll_page.png` |

---

### C. Business Intelligence & Reports (20)

| # | Module Name | Page / Route | Scope & Workflow Tested | Status | Live Screenshot / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **20** | **Reports** | `#/app/reports` | All 6 report modules: Sales Analytics, Purchases, Gross Profit, Inventory Valuation, Customer Outstanding, Multi-Shop Performance | ✅ **PASS** | `20_reports_page.png` |

---

### D. Admin Modules (21 - 23)

| # | Module Name | Page / Route | Scope & Workflow Tested | Status | Live Screenshot / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **21** | **Shops** | `#/app/shops` | Multi-shop branch directory (`NSYU` / `NSYU-01`), branch status, shop switching | ✅ **PASS** | `21_shops_page.png` |
| **22** | **Roles & Permissions** | `#/app/roles` | Complete 18 RBAC roles matrix, module action checkboxes, field-level visibility controls | ✅ **PASS** | `22_roles_page.png` |
| **23** | **Settings** | `#/app/settings` | Store configuration, GST/Tax settings, currency (₹ INR), invoice headers, Cloud DB connectivity | ✅ **PASS** | `23_settings_page.png` |

---

### E. Additional Phase 9: Customer Portal

| # | Feature | Route | Scope & Workflow Tested | Status | Live Screenshot / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **9.1** | **Customer Login** | `#/portal/login` | Phone / Email 4-digit OTP request & verification UI, self-registration toggle | ✅ **PASS** | `24_portal_login.png` |
| **9.2** | **Customer Catalog** | `#/portal/catalog` | Category browsing, product thumbnails, prices, "+ Add to Cart" buttons | ✅ **PASS** | Verified via Customer Portal API & UI |
| **9.3** | **Customer Cart** | `#/portal/cart` | Clean Product Icon + Product Name display only, quantity stepper, clear cart, order checkout | ✅ **PASS** | Verified via Customer Portal API & UI |
| **9.4** | **Customer Orders** | `#/portal/orders` | Customer order history, status tracking (pending, confirmed, delivered, billed) | ✅ **PASS** | Verified via Customer Portal API & UI |
| **9.5** | **Customer Bills** | `#/portal/bills` | Customer invoices, PDF download, payment status | ✅ **PASS** | Verified via Customer Portal API & UI |
| **9.6** | **Customer Ledger** | `#/portal/ledger` | Running customer balance, debit/credit entries, payment reconciliations | ✅ **PASS** | Verified via Customer Portal API & UI |
| **9.7** | **Security Isolation** | `#/app/*` | Direct customer navigation to `/app/reports`, `/app/settings`, and `/app/billing` blocked and redirected to `#/login` | ✅ **PASS** | Verified via isolated incognito browser context |

---

## 4. Production Deployment & Live Verification Checklist

- [x] Synchronize web production bundle with `npm run build` and `scripts/sync-gh-pages.js`.
- [x] Push all changes to `main` branch to trigger GitHub Pages workflow.
- [x] Mirror push to `07_11_2026` branch.
- [x] GitHub Actions deployment verified:
  - Run ID: `42517441054` (`Deploy to GitHub Pages`): Status **completed / success**.
  - Run ID: `42517440666` (`pages build and deployment`): Status **completed / success**.
- [x] Deployed assets on `https://nsyumnt-rgb.github.io/nsyu/` verified:
  - Main HTML container: 200 OK
  - Production JS Bundle: `assets/index-B0akhVUA.js` (1.07 MB, 200 OK)
  - Production CSS Bundle: `assets/index-iRCpKH3q.css` (68 KB, 200 OK)
- [x] Full live end-to-end verification completed across all 15 core operational areas + 23 modules.
- [x] 24 full-page browser screenshots archived in artifact directory `screenshots/`.



