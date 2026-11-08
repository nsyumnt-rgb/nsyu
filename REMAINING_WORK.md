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
  - `tests/payroll.test.ts` & `tests/seed.test.ts` (Attendance, leave, salary ledger).

---

## 3. Testing Status

| Module / Workflow | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Product Import (.csv, .xlsx, .xls)** | API & Web | ✅ PASSED | Multi-format parsing, 3-tier matching, preview endpoint. |
| **Price Change Audit Logging** | API Database | ✅ PASSED | Recorded in `AuditLog` table with old/new values. |
| **Inventory Invariant (No Fake Stock)** | API Database | ✅ PASSED | Verified opening stock never bypasses purchase pipeline. |
| **Cart Item Display (Product Icon + Name Only)** | Mobile App | ✅ PASSED | Tested on both Customer Portal and Staff Cart. |
| **Cart Item Display (Product Icon + Name Only)** | Web Portal | ✅ PASSED | Tested on `/portal/cart` and `/billing`. |
| **Quantity Modification (Stepper)** | Mobile & Web | ✅ PASSED | Real-time immediate update of totals. |
| **Product Removal (Delete)** | Mobile & Web | ✅ PASSED | Removes item and clears line total. |
| **Cart Persistence & Sync** | Backend API | ✅ PASSED | Integration test passed (`cart_representation_workflow.test.ts`). |
| **Customer Auth (Email / Mobile + 4-digit OTP)** | Backend & UI | ✅ PASSED | 100% test coverage in `customer_portal.test.ts`. |
| **Backend Unit & Integration Tests** | Full Suite | ✅ PASSED | 79/79 tests passing across 11 test suites. |

---

## 4. Production Deployment & Live Verification Checklist

- [x] Synchronize web production bundle with `npm run build` and `scripts/sync-gh-pages.js`.
- [x] Push all changes to `main` branch to trigger GitHub Pages workflow.
- [x] Mirror push to `07_11_2026` branch.
- [ ] Verify GitHub Actions deployment status.
- [ ] Complete live browser walkthrough on https://nsyumnt-rgb.github.io/nsyu/#/login with `nsyu.mnt@gmail.com` / `Password@123`.


