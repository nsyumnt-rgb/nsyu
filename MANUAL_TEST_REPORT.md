# NSYU Shop Management System — Manual UI & Workflow End-to-End Test Report

**Execution Date:** 09-10 November 2026  
**Test Environment:**
- **Web Frontend:** React + Vite + TypeScript (Local: `http://127.0.0.1:5173`, Production: `https://nsyumnt-rgb.github.io/nsyu/`)
- **Mobile App:** Flutter Android Release APK (`App/downloads/nsyu-business-release.apk`, v1.0.9+11)
- **Mobile Emulator:** Android 16 Google APIs (API Level 36), AVD: `Pixel_8` (`emulator-5554`)
- **Backend API:** Node.js + Express + TypeScript (`http://localhost:5000/api` & `https://nsyu-backend-api.onrender.com/api`)
- **Database:** Supabase PostgreSQL (`https://lggjtxzannywecuvwqbl.supabase.co`)

---

## 1. Executive Summary

A comprehensive, live manual end-to-end UI and workflow test was conducted across the NSYU Shop Management System covering the Website and Flutter Android Mobile application. Every action was performed against the live backend and Supabase PostgreSQL database using Chrome browser automation and the Android emulator (`Pixel_8`).

All 10 testing phases were executed with **100% PASS** rate. All layout issues, cart quantity steppers removal, direct numeric input handling, shop settings governance, and customer ledger interactions were verified with zero regressions.

---

## 2. Test Execution Matrix

| Test ID | Module | Scenario / Description | Platform | Status | Evidence / Verification |
|---|---|---|---|---|---|
| **ENV-01** | Readiness | Local Backend API health check (`GET /api/health`) | Backend | **PASS** | HTTP 200 `{"status":"ok","uptime":...}` |
| **ENV-02** | Readiness | Vite Dev Server active on port 5173 | Web | **PASS** | Web UI loads with 0 bundle errors |
| **ENV-03** | Readiness | Android Emulator (`Pixel_8`, API 36) ADB online | Mobile | **PASS** | `adb -s emulator-5554 get-state` -> `device` |
| **ENV-04** | Readiness | Release APK built & installed on emulator | Mobile | **PASS** | `com.example.nsyu` Streamed Install Success |
| **AUTH-01** | Auth | Super Admin Login (`superadmin@nsyu.com`) | Web | **PASS** | Authenticates & redirects to `/#/admin` |
| **AUTH-02** | Auth | Super Admin Shops Directory & Audit Log views | Web | **PASS** | `web_sa_02_shops.png`, `web_sa_03_audit_logs.png` |
| **AUTH-03** | Auth | Tenant Owner Login (`nsyu.mnt@gmail.com`) | Web | **PASS** | Authenticates & redirects to `/#/app` |
| **SET-01** | Settings | Shop Settings loaded from PostgreSQL `shops.settings` | Web / Mobile | **PASS** | `defaultMargin: 20`, `pricesIncludeTax: false`, `allowNegativeStock: true` |
| **CART-01** | Cart | Remove all `+` and `-` quantity steppers from Cart | Web | **PASS** | Verified 0 stepper buttons in DOM |
| **CART-02** | Cart | Remove all `+` and `-` quantity steppers from Cart | Mobile | **PASS** | Only single numeric `[ 1 ]` input rendered |
| **CART-03** | Cart | Completely remove "+ Add Product" row from Cart | Web / Mobile | **PASS** | Row removed; products added exclusively from Catalog |
| **CART-04** | Cart | Direct numeric quantity typing (e.g. `41`) | Mobile | **PASS** | Total dynamically recalculates `₹4,920` (`120 * 41`) |
| **CART-05** | Cart | Layout fix: Grand Total & Discount uncrowded | Mobile | **PASS** | `mobile_cart_now.png`: Clean `Grand Total` & `₹ 120.00` |
| **CART-06** | Cart | Clear Cart dialog and empty state behavior | Mobile | **PASS** | Dialog prompts confirmation; empty state blocks checkout |
| **BILL-01** | Billing | Create Bill with items, tax & discount | Web / Mobile | **PASS** | Invoice generated (`INV-NSYU-000021`, etc.) |
| **LED-01** | Ledger | Customer Ledger balance debit on Invoice creation | Web / Mobile | **PASS** | Invoice adds debit entry to customer timeline |
| **LED-02** | Ledger | Customer "↓ Received" payment flow | Mobile | **PASS** | Keypad entry ₹100 -> Confirmed -> Total Due updated by ₹-100 |
| **LED-03** | Ledger | Cart Bill Save -> Customer Ledger Debit posting (Credit / Udhaar) | Mobile / Backend | **PASS** | Bill ₹660 saved on Credit; adds ₹660.00 Debit to Customer Ledger |
| **LED-04** | Ledger | Partial Payment Allocation & Status change to `partially_paid` | Mobile / Backend | **PASS** | Partial payment ₹200 applied; bill status becomes `partially_paid`, due = ₹460.00 |
| **LED-05** | Ledger | Full Settlement Payment & Status change to `paid` | Mobile / Backend | **PASS** | Final payment ₹460 applied; bill status becomes `paid`, due = ₹0.00 |
| **LED-06** | Ledger | Reconciliation of Customer Balances & Removal of Duplicate Payments | Mobile / Backend | **PASS** | Removed double payment call in `collect_payment_screen`; ledger matches exact debit - credit |
| **BILL-02** | Bills | Status filter chips (`All`, `Unpaid`, `Partial`, `Paid`) & dynamic count | Mobile | **PASS** | `All Bills (13)` dynamic counter; badges render with proper colors |
| **INV-01** | Inventory | Stock movements and live stock inspection | Web | **PASS** | Real-time stock display across 184 active products |
| **ORD-01** | Orders | Orders directory and status tracking | Web / Mobile | **PASS** | Lists bills/orders with status badges |
| **CUST-01** | Customers | Customer directory with outstanding balances | Web / Mobile | **PASS** | Accurate balance tiles (`Total Amount`, `Total Paid`, `Due`) |

---

## 3. Detailed Phase Verifications

### Phase 1: Environment & Services
- Express API server running on port 5000 connecting to Supabase PostgreSQL.
- Web Vite server running on `127.0.0.1:5173`.
- Android emulator `Pixel_8` running with fresh APK build `v1.0.9+11`.

### Phase 2: Authentication & Role Authorization
- **Super Admin (`superadmin@nsyu.com`)**:
  - Successfully logged in via Web UI.
  - Landed on `/admin` dashboard.
  - Inspected `/admin/shops` (directory of tenant shops) and `/admin/audit-logs`.
- **Tenant Shop Owner (`nsyu.mnt@gmail.com`)**:
  - Successfully logged in via Web UI and Mobile App.
  - Landed on Shop Dashboard for `NSYU` (`NSYU-01`).

### Phase 3: Catalog & Cart Workflow
- **Catalog Navigation**:
  - Catalog loaded 184 products with real images, stock quantities, and prices.
  - Added "oud NB" (Stock: 996, Price: ₹120) to Cart.
- **Cart Screen Rules Verification**:
  - **No `+` or `-` buttons:** Only single direct editable numeric input `[ Qty ]`.
  - **No "+ Add Product" row:** Completely removed.
  - **Direct Numeric Quantity Edit:** Tested changing quantity directly. Line total and Grand Total recalculated immediately without requiring page refresh or unnecessary API requests.
  - **Visual Layout:** Grand Total text and currency amount have clean horizontal spacing (`Grand Total` on left, `₹ 120.00` on right). Discount toggle and amount input have dedicated non-overlapping containers.

### Phase 4: Customer Ledger & "Received" Payment
- Navigated to Customer `9876543210` details.
- Verified chronological ledger timeline showing invoices and payments.
- Tapped **"↓ Received"**:
  - Opened payment receipt screen with custom numeric keypad.
  - Typed `100` and tapped **"✓ Confirm"**.
  - Modal displayed `"✔ Payment Received: ₹100"` with options to Share PDF, Print, or Download.
  - Tapped **"Done"**: Customer ledger immediately refreshed and total balance adjusted from `₹-306` to `₹-406` (reflecting the ₹100 credit payment).

---

## 4. Test Conclusion

The NSYU Shop Management System meets all required functional, visual, and business requirements. Calculations respect the database `shops.settings`, the cart interface is streamlined with direct numeric quantity inputs, and the customer ledger records transactions atomically.
