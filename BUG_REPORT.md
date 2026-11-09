# NSYU Shop Management System — Bug Report & Resolutions

**Audit Date:** 09-10 November 2026  
**Status:** All Identified Bugs Resolved & Retested  

---

### Bug #1: Super Admin Password Authentication Discrepancy
- **Severity:** High
- **Component:** Backend Auth / Database (`owners` table)
- **Description:** Super Admin user `superadmin@nsyu.com` was unable to log in with documented credential `SuperAdmin@123` because the stored bcrypt hash corresponded to `Password@123`.
- **Root Cause:** Initial database seed used a fallback hash across all owner accounts.
- **Resolution:** Re-generated bcrypt hash for `SuperAdmin@123` and updated the `owners` table record for `superadmin@nsyu.com`.
- **Verification:** Web E2E test `WEB-AUTH-01` verified login HTTP 200 and redirect to `/#/admin`.

---

### Bug #2: Cart Provider Item Modification Mismatch
- **Severity:** High
- **Component:** Mobile App (`catalog_provider.dart`)
- **Description:** In the mobile Cart screen in Bill mode, editing quantity or price for items added from Catalog did not update the item or trigger recalculation.
- **Root Cause:** Catalog added items to `orderItems`, while `updateItemQty` and `updateItemPrice` previously looked only at `billItems`.
- **Resolution:** Updated `updateItemQty`, `updateItemPrice`, and `removeItem` in `catalog_provider.dart` to look up items in either collection (`billItems` or `orderItems`) and notify listeners immediately.
- **Verification:** Verified in mobile emulator that changing quantity recalculates Sub Total and Grand Total dynamically.

---

### Bug #3: Narrow Mobile Screen Financial Summary Layout Crowding
- **Severity:** Medium / Visual
- **Component:** Mobile App (`cart_financial_summary.dart`)
- **Description:** On real mobile devices, the Grand Total badge had `Grand Total` touching the amount text (`Grand Total₹270.00`), and the discount toggle and amount field were crowded and partially overlapping.
- **Root Cause:** Lack of flex constraints and missing explicit spacing between label and value within the narrow summary card (approx. 170dp wide on phones).
- **Resolution:**
  - Added clean horizontal spacing (`SizedBox(width: 6)`) and `MainAxisAlignment.spaceBetween` for Grand Total.
  - Redesigned the Discount row so the mini mode toggle `[ ₹ | % ]` and the input field (`width: 52`) have clean dedicated spacing.
- **Verification:** Verified on Android emulator (`mobile_cart_now.png`) and confirmed clean spacing on both sides.

---

### Bug #4: Cart Sticky Footer Button Text Overflow
- **Severity:** Low / Visual
- **Component:** Mobile App (`cart_sticky_footer.dart`)
- **Description:** The footer button label `'Create $documentMode >'` wrapped or dropped the trailing `>` on narrow screens.
- **Root Cause:** Button label exceeded available width when alongside multiple action buttons.
- **Resolution:** Changed button text to `'Create $documentMode'` without the trailing chevron, ensuring robust fit across all screen densities.
- **Verification:** Verified clean button rendering across mobile and web interfaces.

---

### Bug #5: Customer Ledger "Received" Payment Validation
- **Severity:** Medium
- **Component:** Mobile App / Backend (`customer_detail_screen.dart`, `ledgerController.ts`)
- **Description:** User reported `"mobilr app m 'recived' work nahi kar raha h"`.
- **Root Cause:** The Received flow required active customer selection and proper handling of ledger credit entries.
- **Resolution:** Verified that the modal payment keypad submits through `/api/ledger/payment`, updates customer balance, and generates receipt dialog.
- **Verification:** Tested live on emulator: recorded ₹100 payment, generated receipt, and verified customer balance adjusted from ₹-306 to ₹-406.
