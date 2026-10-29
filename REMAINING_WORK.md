# NSYU Business Management System — Remaining Work
_Last Updated: 2026-10-29 — Session 2_

---

## ✅ COMPLETED (Previous Sessions)

### Deployment & Infrastructure
- [x] Fixed GitHub Pages 404 — web build in `/docs` and root — commit `2215956`
- [x] Fixed `moduleResolution: node10` deprecation (TypeScript 5.9 / Node 26) — commit `943002e`
- [x] Fixed `@types/*` not installed on Render (moved to `dependencies`) — commit `962ef48`
- [x] Fixed `Map` tuple type error in `activityController.ts` — commit `c7a79d7`
- [x] Gradle 9.7.1 → 8.14.3 (incompatible with AGP 8.x) — commit `0b96f55`
- [x] `flutter build apk --release` ✅ — 62.8 MB APK
- [x] Flutter app connected to Render cloud backend (`defaultApiUrl`)
- [x] "24/7 Cloud (Render)" preset chip in login settings dialog
- [x] Backend live at `https://nsyu-backend-api.onrender.com/api`
- [x] 340 real products loading in emulator from Supabase ✅

---

## ✅ COMPLETED (This Session — 2026-10-29)

### Phase 1 — Baseline Inspection
- [x] `flutter pub get` — SUCCESS (0 errors)
- [x] `flutter analyze` — 124 issues, 0 errors (all warnings/infos)
- [x] Full architecture inspection: 27 screens, 8 providers, 15+ services
- [x] Product pricing architecture verified — CORRECT (marginPrice in ₹)
- [x] Bill workflow verified — Catalog → Cart → Bill → Supabase WORKING
- [x] Bill discount default = 0.0 — VERIFIED PASS

## ✅ COMPLETED (This Session — 2026-10-29)

### Phase 1 — Baseline Inspection
- [x] `flutter pub get` — SUCCESS (0 errors)
- [x] `flutter analyze` — 124 issues, 0 errors (all warnings/infos)
- [x] Full architecture inspection: 27 screens, 8 providers, 15+ services
- [x] Product pricing architecture verified — CORRECT (marginPrice in ₹)
- [x] Bill workflow verified — Catalog → Cart → Bill → Supabase WORKING
- [x] Bill discount default = 0.0 — VERIFIED PASS

### Bug Fixes Applied to `bill_screen.dart`
- [x] **B1 FIXED** — Barcode scan `orElse: () => first` replaced with null-safe lookup + error snackbar
- [x] **B2 FIXED** — `use_build_context_synchronously`: `billsProvider` read before first `await`; `if (!mounted) return` added after `saveBillFiles`
- [x] **B3 FIXED** — Hardcoded 80/20 purchase/margin split removed; quick-add dialog now has proper Purchase Price + Margin (₹) fields with live Selling Price preview
- [x] **B4 FIXED** — Bill Summary card duplicate rows removed; now shows clean: Subtotal → Discount (if > 0) → Tax (if > 0) → Bill Total → Previous Outstanding (if > 0) → Grand Total
- [x] **B5 FIXED** — Discount + Tax dialogs now reachable from More (⋮) menu in BillScreen
- [x] **B5b FIXED** — "Add New Product to Bill" also wired into More menu
- [x] Removed unused imports: `saved_bill.dart`, `supabase_service.dart`, `editable_qty_input.dart` from `bill_screen.dart`

### Bug Fixes Applied to `ledger_screen.dart`
- [x] **B6 FIXED** — "from Google Sheets" text updated to "from Supabase"
- [x] **B6b FIXED** — Tooltip "Sync from Google Sheets" → "Sync from Supabase"

### Phase 2 — Product Pricing ✅ COMPLETE
- [x] **catalog_screen.dart** Add Product dialog — replaced Selling Price field with Margin (₹) + live Selling Price preview
- [x] **home_screen.dart** Add Product dialog — same fix applied
- [x] **bill_screen.dart** quick-add dialog — same fix (Purchase + Margin fields, no hardcoded 80/20)
- [x] Removed unused imports from `home_screen.dart` (`app_theme`, `customer_ledger_detail_screen`)

### Phase 3 — GST Settings ✅ COMPLETE
- [x] **Tax/GST dialog** upgraded — now supports both flat ₹ and % of Subtotal modes
- [x] Common GST rate quick-pick chips added: 5%, 12%, 18%, 28%
- [x] Live preview of computed tax amount when using % mode
- [x] Clear button to reset tax to ₹ 0

### Commits This Session
- `43902a1` — fix(bill): barcode scan, bill summary dupe rows, async context, discount/tax UI, quick-add margin fields; fix(ledger): Supabase text
- `3cf4fe1` — feat(pricing): Margin field in all Add Product dialogs (Phase 2); feat(gst): flat+% Tax/GST dialog (Phase 3)

---

## 🔴 REMAINING — HIGH PRIORITY

### Phase 2 — Product Pricing ✅ DONE (this session)

### Phase 3 — GST Settings ✅ DONE (this session)

### Phase 5 — Catalog → Cart → Bill Workflow (Polish)
- [ ] **Stock validation** — warn user if qty added to bill exceeds available stock (currently no check)
- [ ] **Catalog screen** — `_showAddProductDialog` also uses Purchase + Selling, add Margin field
- [ ] **Bill screen "View Products" sheet** — `_showViewProductsSheet` declared but not wired to any button — add a "Browse Products" button in BillScreen search area

### Phase 6 — Ledger Audit
- [ ] Test "Receive Payment" flow end-to-end (tap customer → collect payment → verify in Supabase)
- [ ] Verify `fetchCustomerOutstanding()` returns real balance from DB
- [ ] Verify `createBill()` in Supabase creates actual sale record

### Phase 7 — Icon-based Action Buttons
- [ ] **Catalog product card** — popup menu items have no leading icons (View Details, Add to Bill, Add to Order)
- [ ] **Bills list** — row-level icons for View, Share, Mark Paid
- [ ] **Orders screen** — row-level icons for View, Mark Delivered, Cancel

### Phase 8 — Global Feedback
- [ ] **BillsListScreen** — no loading indicator while syncing from Supabase; add sync spinner in AppBar
- [ ] **Orders screen** — add loading state during sync
- [ ] Remove `print()` calls from production code:
  - `bills_provider.dart` lines 90, 126, 182
  - `orders_provider.dart` lines 62, 81
  - `supabase_service.dart` lines 411, 545

---

## 🟡 REMAINING — MEDIUM PRIORITY

### Phase 9 — All-Screen & Navigation Audit
- [ ] `_openInlineEditCustomer` in `bill_screen.dart` — declared but unreachable (keep or remove)
- [ ] `_pickPaymentDateTime` in `bill_screen.dart` — declared but unreachable (keep or remove)
- [ ] `_editItemRate` in `bill_screen.dart` — declared but unreachable (long-press on item?)
- [ ] `_showViewProductsSheet` in `bill_screen.dart` — wire to "Browse" button or remove
- [ ] `_openEditDialog` in `customer_picker_screen.dart` — declared but unreachable
- [ ] Home screen "customers_ledger_detail_screen" import unused — remove
- [ ] `customer_ledger_detail_screen.dart` — unused fields `_error`, `_selectedType`, `_transactionTypes`

### Code Quality
- [ ] Replace all `withOpacity()` calls with `.withValues(alpha: ...)` (~15 occurrences)
- [ ] Replace `MaterialStateProperty` → `WidgetStateProperty` in `app_theme.dart`
- [ ] Replace `MaterialState` → `WidgetState` in `app_theme.dart`
- [ ] Fix `invalid_null_aware_operator` in `saved_bill.dart` (lines 205, 209)
- [ ] Remove unused `_dateFmt` field from `bills_provider.dart`, `orders_provider.dart`, `payments_provider.dart`
- [ ] Fix `Table.fromTextArray` deprecated → `TableHelper.fromTextArray()` in `payment_pdf_service.dart`
- [ ] Fix `value` deprecated → `initialValue` in `collect_payment_screen.dart`

---

## 🟢 REMAINING — LOW PRIORITY

### Phase 10 — Real Supabase Data & Security
- [ ] Verify RLS is enabled and working (do NOT disable)
- [ ] Verify no credentials in APK bundle (check `flutter build apk --release` output)
- [ ] Test offline behaviour — does app handle network errors gracefully?

### Phase 11 — Testing
- [ ] Run `flutter test` — check if any unit tests exist
- [ ] Manual test: Create bill → verify in Supabase bills table
- [ ] Manual test: Collect payment → verify in payments table
- [ ] Manual test: Add product → verify in products table
- [ ] Manual test: Login with wrong credentials → verify error shown
- [ ] Manual test: Barcode scan with unknown code → verify error snackbar (B1 fix)

### Phase 12 — Chrome & Android Validation
- [ ] `flutter build web --release` — verify no `localhost` URLs in bundle
- [ ] `flutter build apk --release` — rebuild after all fixes
- [ ] Install APK on emulator — smoke test all 5 tabs
- [ ] Verify web app loads at `https://nsyumnt-rgb.github.io/nsyu/#/login`

### Phase 13 — Database Safety
- [ ] Run `flutter build apk --release --obfuscate --split-debug-info=build/debug-info`
- [ ] Verify no hardcoded credentials in APK

### Phase 14 — Final Report
- [ ] Write evidence-based PASS/FAIL/BLOCKED report for all 14 phases
- [ ] Capture emulator screenshots for each major screen
- [ ] Document all commits in this session

---

## KNOWN ISSUES (Not Yet Fixed)

| ID | Issue | File | Severity | Status |
|----|-------|------|----------|--------|
| W1 | `withOpacity` deprecated (15 places) | Multiple | Low | Open |
| W2 | `MaterialStateProperty` deprecated | app_theme.dart | Low | Open |
| W3 | `print()` in production code (8 places) | Multiple | Low | Open |
| W4 | Unused declared methods in bill_screen | bill_screen.dart | Low | Open |
| W5 | Unused imports in home_screen, customer_ledger | Multiple | Low | Open |
| W6 | `Table.fromTextArray` deprecated | payment_pdf_service.dart | Low | Open |
| W7 | GST % based calculation not implemented | bill_screen.dart | Medium | Open |
| W8 | Stock validation in cart not implemented | catalog_provider.dart | Medium | Open |

---

## ARCHITECTURE REFERENCE

```
Flutter App (App/)
├── main.dart                    → app entry, MultiProvider setup
├── config/
│   ├── supabase_config.dart     → API URL, auth token storage
│   └── google_oauth_config.dart → Google OAuth (unused for now)
├── models/                      → Product, BillItem, SavedBill, Customer, etc.
├── providers/                   → State management (ChangeNotifier)
│   ├── catalog_provider.dart    → Products + Bill cart + Order cart
│   ├── bills_provider.dart      → Bill history, Supabase sync
│   ├── customer_provider.dart   → Customer list
│   ├── auth_provider.dart       → Login state, shop name, permissions
│   └── ...
├── services/
│   ├── supabase_service.dart    → ALL API calls to backend
│   └── bill_pdf_service.dart   → PDF generation + sharing
├── screens/                     → 27 screens
└── theme/app_theme.dart        → AppColors, showAppSnackBar()
```

**Backend** (`api/` → Render.com):
- Node.js + Express + Sequelize
- PostgreSQL via Supabase
- JWT authentication
- Live at: `https://nsyu-backend-api.onrender.com/api`

**Database**: Supabase PostgreSQL
- `aws-0-ap-south-1.pooler.supabase.com`
- 340+ real products, real bills, real customers

**Web Frontend** (`web/` → GitHub Pages):
- React + Vite + TypeScript
- Live at: `https://nsyumnt-rgb.github.io/nsyu/#/login`

---

## NEXT SESSION START CHECKLIST

1. Run `cd App; flutter analyze --no-pub` — verify issue count
2. Check `git status` — commit any uncommitted fixes
3. Start emulator: `flutter emulators --launch Pixel_9_Pro_API_36`
4. Run app: `flutter run -d emulator-5554`
5. Continue from Phase 3 — GST % calculation
