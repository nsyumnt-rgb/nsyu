# NSYU System — Production Deployment & Status Report
Super Admin: `superadmin@nsyu.com` | `SuperAdmin@123`  
Target Production URL: https://nsyumnt-rgb.github.io/nsyu/#/login  
Tenant Shop Account: Shop: `NSYU` (`NSYU-01`) | Email: `nsyu.mnt@gmail.com` | Password: `Password@123`  
Supabase URL: `https://lggjtxzannywecuvwqbl.supabase.co`  
Render Backend API: `https://nsyu-backend-api.onrender.com/api`  
Mobile Release APK (v1.0.9+11): https://nsyumnt-rgb.github.io/nsyu/downloads/nsyu-business-release.apk  

---

## Complete Cart, Quantity, Billing, Shop Settings & Ledger Fix Report

### 1. Quantity Input Field — Removed All Plus/Minus Buttons
- **Web (`Billing.tsx`, `PortalCart.tsx`, `Orders.tsx`)**:
  - Removed all `+` and `-` quantity stepper buttons.
  - Formatted as single direct editable numeric `<input type="number" min="1" step="1" />` displaying `[ Qty ]`.
  - Recalculates subtotal, discounts, taxable amount, and GST instantly.
- **Mobile Flutter (`order_cart_screen.dart`, `cart_item_card.dart`, `bill_items_list.dart`, `portal_cart_screen.dart`, `editable_qty_input.dart`)**:
  - Completely removed all `Icons.remove` and `Icons.add` / `InkWell` stepper buttons across all cart and billing views.
  - Replaced with direct numeric `TextField` / `TextFormField` (`[ 2 ]`, minimum 1, positive whole numbers only).
  - Preserved editable price field in mobile cart alongside quantity and dynamic item total (`Qty * Price`).

### 2. Completely Removed "+ Add Product" Row from Cart
- Removed `_buildAddProductAndSearchRow` and `_showAddProductDialog` from `App/lib/features/orders/screens/order_cart_screen.dart`.
- Products are added to Cart exclusively from the Catalog screen.
- Updated empty state text to: `"Cart is empty. Add products from the Catalog."`.
- Disabled checkout action button (`Create Bill >` / `Create Order >`) in `cart_sticky_footer.dart` whenever cart is empty (`provider.orderItems.isEmpty && provider.billItems.isEmpty`).

### 3. Shop Settings Isolated in Database & Governs All Calculations
- Added `settings JSONB DEFAULT '{}'::jsonb` column to PostgreSQL `shops` table.
- Seeded default settings for Shop 1 (`NSYU`):
  - `currency`: "INR (₹)"
  - `timezone`: "Asia/Kolkata"
  - `defaultMargin`: 20 (fixed ₹ amount, not percentage)
  - `pricesIncludeTax`: false (supports tax-inclusive and tax-exclusive calculations)
  - `defaultGstRate`: 18
  - `invoicePrefix`: "INV-"
  - `nextInvoiceNumber`: 1
  - `allowNegativeStock`: true
  - `enableCash`: true, `enableUpi`: true, `enableBank`: true, `enableCredit`: true
  - `allowStaffDiscount`: true, `maxStaffDiscountPercent`: 10
- Backend endpoints: `GET /api/shops/:shopId/settings` and `PUT /api/shops/:shopId/settings`.
- Backend `saleController.ts` enforces active shop settings inside atomic transaction:
  - Validates `allowNegativeStock`: blocks negative stock if shop setting is `false`.
  - Tax-inclusive vs Tax-exclusive calculation per item.
  - Fixed ₹ margin arithmetic: `Selling Price = Purchase Price + Margin`.
  - Blocks payment method if disabled (e.g. `enableCredit: false` prevents unpaid sales).
  - Idempotency guard via `clientRequestId` and `[req:<id>]` token in sale notes.
  - Atomic customer ledger debit for invoice and credit for payment.

### 4. Build & Test Verification
- Backend TypeScript: `cd api && npx tsc --noEmit` -> 0 errors.
- Web Vite Build: `cd web && npm run build` -> 0 errors.
- Flutter Analyze: `cd App && flutter analyze` -> 0 issues found.
- Flutter Tests: `cd App && flutter test` -> 7/7 tests passed.
- Flutter Release APK: `build/app/outputs/flutter-apk/app-release.apk` (64.3MB) assembled and copied to `downloads/`.
- GitHub Pages sync: Synced assets, downloads, HTML, and `.nojekyll`.
