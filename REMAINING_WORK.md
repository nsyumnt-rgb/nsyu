# NSYU System — Remaining Work & Cart UI/UX Status Report

**Last Updated:** November 8, 2026  
**Version:** Mobile App `v1.0.6+8` | Customer Portal Web & Staff Billing  

---

## 1. Executive Summary
This document tracks the resolution of the Cart UI/UX representation issues across both the **NSYU Mobile App** and **NSYU Website**, as well as documenting completed features, test coverage, and remaining tasks.

Previously, items added to the cart suffered from table layout crowding on mobile screens (where six spreadsheet columns compressed product names into ~70px, causing severe truncation and overlapping text) and generic/hardcoded graphics. In accordance with the design specification:
- Every added product is now represented using **ONLY** its **Product Icon** and **Product Name**.
- All unnecessary product details (SKU codes, voltage/amp specifications, purchase prices, selling prices, GST rates) have been removed from the cart item cards.
- Product icons now dynamically reflect each item's actual product category (Chargers, Cables, Power Banks, TWS Earbuds, Headphones, Speakers, Mobile Batteries, Extension Boards, etc.) with high-polish vector artwork and brand-tinted soft backgrounds, or real product imagery when available.
- Real-time reactivity is guaranteed on addition, quantity change, and removal, and cross-platform synchronization between Web and Mobile is preserved.

---

## 2. Completed Tasks

### A. Mobile Application (`App/`)
- [x] **Created Reusable `ProductItemIcon` Widget (`App/lib/widgets/product_item_icon.dart`):**
  - Standardized 48×48 px container with smooth rounded corners (`12px` radius) and subtle borders.
  - Category-aware visual styling:
    - **Mobile Chargers & Dock Adapters:** Emerald green badge (`#ECFDF5`, border `#A7F3D0`) with wall dock adapter icon (`Icons.power_rounded`).
    - **Cables & Data Wires:** Sky blue badge (`#F0F9FF`, border `#BAE6FD`) with USB/Type-C cable icon (`Icons.cable_rounded`).
    - **Power Banks:** Amber badge (`#FFFBEB`, border `#FDE68A`) with charging battery icon (`Icons.battery_charging_full_rounded`).
    - **TWS / Wireless Earbuds:** Violet badge (`#F5F3FF`, border `#DDD6FE`) with charging case earbuds icon (`Icons.headset_mic_rounded`).
    - **Earphones & Headphones:** Indigo badge (`#EEF2FF`, border `#C7D2FE`) with over-ear audio icon (`Icons.headphones_rounded`).
    - **Bluetooth Speakers:** Rose badge (`#FFF1F2`, border `#FECDD3`) with speaker cone icon (`Icons.speaker_rounded`).
    - **Mobile Batteries:** Teal badge (`#F0FDFA`, border `#99F6E4`) with cell terminal icon (`Icons.battery_std_rounded`).
    - **Extension Boards / Sockets:** Slate badge (`#F8FAFC`, border `#CBD5E1`) with power strip icon (`Icons.settings_input_composite_rounded`).
    - **LED Torches:** Yellow badge (`#FEFCE8`, border `#FEF08A`) with flashlight beam icon (`Icons.flashlight_on_rounded`).
    - **Image Fallback:** Seamlessly displays online product image if available, falling back gracefully to the category icon on network error or missing image.
- [x] **Customer Portal Cart Screen (`App/lib/screens/portal/portal_cart_screen.dart`):**
  - Upgraded cart item representation to display **ONLY** the 48×48 `ProductItemIcon` and clear, readable, prominent `Product Name` (with trimmed whitespace and `maxLines: 3`).
  - Compact stepper (`[-] [qty] [+]`) and red trash icon for instantaneous quantity adjustments and removals.
  - Preserved sticky customer card, terms & conditions, and order placement button.
- [x] **Staff Order & Billing Cart Screen (`App/lib/screens/order_cart_screen.dart`):**
  - Modernized item representation to strictly feature **Product Icon** and **Product Name**.
  - Synchronized item quantity modifications (`provider.changeQty` / `provider.changeOrderQty`) and deletions (`provider.removeItem` / `provider.removeOrderItem`) with real-time state notification.
  - Add product modal dynamically adds to `billItems` or `orderItems` matching the active `_documentMode`.
- [x] **Model Update (`App/lib/models/bill_item.dart`):**
  - Added `category` field so `BillItem` carries category context for precise icon rendering.
- [x] **Version Bump & APK Build:**
  - Bumped version to `1.0.6+8` in `App/pubspec.yaml`.

---

### B. Web Application (`web/`)
- [x] **Created Reusable `ProductItemIcon` Component (`web/src/components/ProductItemIcon.tsx`):**
  - Standardized responsive icon component (`size="sm" | "md" | "lg"`).
  - High-fidelity inline SVG icons for Chargers, Data Cables, Power Banks, Earbuds, Headphones, Speakers, Batteries, Extension Boards, and Torches.
- [x] **Customer Portal Cart Page (`web/src/pages/portal/PortalCart.tsx`):**
  - Clean, modern layout presenting **ONLY** `ProductItemIcon` and `Product Name` in each cart card.
  - Uncluttered presentation with no selling price, GST, or SKU text inside the product presentation container.
  - Integrated `useEffect` calling `getCartApi()` on mount for cross-device synchronization with the mobile app.
- [x] **Staff Billing Cart (`web/src/pages/Billing.tsx`):**
  - Replaced wireframe box with `ProductItemIcon` (size `sm`), displaying product icon and name cleanly alongside quantity controls.
- [x] **Production Bundle Build:**
  - Verified compilation via `npm run build` (`dist/`).

---

### C. Backend API (`api/`)
- [x] **Customer Cart Controller (`api/src/controllers/customerCartController.ts`):**
  - Included `Category` association on `Product` to return `category` in cart response.
  - Supports 4-digit email-only OTP authentication and server-side cart persistence.
- [x] **Integration Testing Suite (`api/tests/cart_representation_workflow.test.ts`):**
  - All 4 integration test cases passing:
    1. Add product to cart & verify product icon/name representation.
    2. Add multiple different products.
    3. Remove product & verify immediate subtotal/total update.
    4. Cross-platform sync (navigate away & return).

---

## 3. Testing Status

| Module / Workflow | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Cart Item Display (Product Icon + Name Only)** | Mobile App | ✅ PASSED | Tested on both Customer Portal and Staff Cart. |
| **Cart Item Display (Product Icon + Name Only)** | Web Portal | ✅ PASSED | Tested on `/portal/cart` and `/billing`. |
| **Quantity Modification (Stepper)** | Mobile & Web | ✅ PASSED | Real-time immediate update of totals. |
| **Product Removal (Delete)** | Mobile & Web | ✅ PASSED | Removes item and clears line total. |
| **Cart Persistence & Sync** | Backend API | ✅ PASSED | Integration test passed (`cart_representation_workflow.test.ts`). |
| **Customer Auth (Email / Mobile + 4-digit OTP)** | Backend & UI | ✅ PASSED | 100% test coverage in `customer_portal.test.ts`. |
| **Backend Unit & Integration Tests** | Full Suite | ✅ PASSED | 75/75 tests passing across 10 test suites. |

---

## 4. Pending Issues & Next Steps

1. **Physical Device Installation:**
   - Install release APK `v1.0.6+8` on Android test devices to verify touch targets on real screens.
2. **Customer Portal Self-Service Features (Backlog):**
   - Customer profile invoice history download (.pdf generation for past completed orders).
   - In-app push notifications for status updates when staff converts order to bill.
3. **Inventory Import Enhancement:**
   - Add image URL mapping column to the CSV importer so custom product photographs can be bulk-uploaded alongside ERD catalog spreadsheets.
