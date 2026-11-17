# NSYU — BRD Gap Analysis & Delivery Plan

_Phase 1 (architecture audit) of `REMAINING_WORK.md` §31. Audited 17 Nov 2026 against the code in this repository (`api/`, `web/`, `App/`)._

**Legend:** ✅ Done · 🟡 Partial · ❌ Missing · 🔴 Broken (UI exists, backend missing)

---

## 1. Headline findings

1. **The current system is a strong single-business B2C shop manager.** Multi-shop, roles, products, inventory, B2C billing, customer ledger, customer portal, orders and notifications all exist and work.
2. **Everything B2B (shop ↔ shop) is missing.** No shop relationships, B2B orders, B2B pricing, linked buyer/seller ledgers, or marketplace. This is roughly 60% of the BRD.
3. **Seven web modules call backend APIs that do not exist.** The pages render but fail at runtime:

   | Web API module | Backend route | Effect today |
   |---|---|---|
   | `api/suppliers.ts` | `/api/suppliers` ❌ | Suppliers page shows "Route not found" |
   | `api/purchases.ts` | `/api/purchases` ❌ | Purchase page cannot load or save |
   | `api/suppliers.ts` (ledger) | `/api/supplier-ledger` ❌ | No supplier ledger |
   | `api/employees.ts` | `/api/employees` ❌ | Dashboard "Employees" always 0 |
   | `api/employees.ts` (attendance) | `/api/attendance` ❌ | — |
   | `api/payroll.ts` | `/api/payroll` ❌ | — |
   | `api/emi.ts` | `/api/emi` ❌ | — |

4. **Supplier payables are always ₹0 everywhere.** `reports/supplier-outstanding` is a stub, and mobile filters customers by `is_supplier`, a column the `Customer` model doesn't have.
5. **Security: `REMAINING_WORK.md` contains live credentials** (super-admin password, shop owner password, DB host) and is committed to git. These should be removed from the file and **rotated**, because git history keeps them.

---

## Progress log

**Phase A — Suppliers, Purchases, Supplier Ledger: built, not yet deployed.**
- Schema: `api/src/migrations/04_…sql`, applied automatically at API startup. **It adopts the legacy tables.** The `Supplier`/`Purchase` models were removed from the code in commit 325504a, but their tables were never dropped, so production may still contain `suppliers`, `purchases`, `purchase_items` and `supplier_ledger` with real data. The migration creates a table only if it's missing, adds new columns with `ADD COLUMN IF NOT EXISTS`, and loosens one NOT NULL (`purchases.payment_method`). It never drops, renames or rewrites data.
- The ledger keeps the **legacy convention** (credit = payable up, debit = payable down) and the legacy column `running_balance`, so old and new rows reconcile.
- APIs: `/api/suppliers`, `/api/purchases` (create, payment, cancel, return, PDF), `/api/supplier-ledger` (statement, outstanding, payments). The `reports/supplier-outstanding` stub is now real.
- Rules: each operation runs in one DB transaction; the supplier ledger is append-only with a running balance; idempotent create and payment; no overpayment; cancel only before any payment (otherwise use a return); return value reduces the payable; stock in and out goes through `recordStockMovement`.
- Tests: `npm run test:phase-a` runs 51 isolated end-to-end checks, including owner isolation and legacy-row compatibility. Not yet run against a real PostgreSQL database.
- Not in Phase A: mobile supplier screens (mobile still reads a non-existent `is_supplier` flag). This belongs to Phase I.

---

## 2. Requirement-by-requirement status

| BRD § | Area | Status | What exists / what's missing |
|---|---|---|---|
| 4 | Multi-owner, multi-shop | 🟡 | `Owner`, `Shop`, shop switching, owner isolation via `owner_id`. Missing: business type (wholesaler/distributor/retailer), shop banner and description. |
| 5 | Multiple wholesalers & supply chain | ❌ | No concept of a shop selling to another shop. |
| 6 | Business relationships (credit limit, terms) | ❌ | No `ShopRelationship` model. |
| 7 | B2B marketplace, B2B orders, B2B pricing | ❌ | `Product` has only `purchase_price`, `selling_price`, `mrp`. No wholesale/distributor/retailer price tiers. |
| 8 | B2C storefront & shopping | 🟡 | Customer portal with catalog, cart, checkout, orders and bills (now e-commerce styled). Missing: public (pre-login) storefront, shop banner/description, multi-shop marketplace. |
| 9 | Shared customer identity, shop-wise accounts | 🟡 | `CustomerAccount` has a per-shop link and shop-wise ledger exists. Missing: verified cross-shop identity and switching shops inside the portal. |
| 10 | Product management | ✅ | SKU, barcode, category, brand, images, GST, stock, status. |
| 11 | Inventory | 🟡 | `ProductStock`, `InventoryTransaction`, low stock. Purchase stock-in depends on the missing `/purchases` API. |
| 12 | Digital Udhaar (B2B credit) | ❌ | Credit works for B2C customers only. |
| 13 | Customer ledger | ✅ | `CustomerLedger` with running balance, payments, reversal status. |
| 14 | Supplier / shop ledger | 🔴 | Web UI exists, no backend (no `Supplier`, `Purchase`, `SupplierLedger` models). |
| 15 | Order management | 🟡 | B2C orders with status history. B2B order type missing. |
| 16 | Billing & invoicing | 🟡 | B2C invoices with standardized IDs. B2B invoice missing. |
| 17 | Payments | 🟡 | Full, partial and credit payments with idempotency keys for B2C. Supplier payments missing. |
| 18 | Returns | 🟡 | `SaleReturn` (B2C). B2B and purchase returns missing. |
| 19 | Notifications | 🟡 | DB-backed in-app and email notifications. B2B events missing. |
| 20 | Defaulter management | 🟡 | Outstanding report exists. Missing: outstanding days, unpaid-bill count, reminder history. |
| 21 | Website interfaces | 🟡 | Owner dashboard, customer portal and super admin exist. Missing: public marketplace, B2B buyer portal. |
| 22 | Mobile app | 🟡 | Owner app and customer portal parity for B2C. B2B modules missing. |
| 23 | Super admin | ✅ | Owners, shops, audit logs, support viewer. |
| 24 | Roles & permissions | ✅ | Roles, module and field permissions. |
| 26 | Financial accounting rules | 🟡 | B2C ledger follows the rules (transactions, no hard delete, idempotency). Needs extending to B2B. |
| 27 | Multi-tenant isolation | 🟡 | `owner_id` and `shop_id` scoping on existing APIs. Needs automated isolation tests (BRD Test 10). |
| 30 | Automated acceptance tests | ❌ | One manual end-to-end script (`api/scripts`). No test suite for Tests 1–10. |

---

## 3. Recommended delivery order

Each phase ends with migrations reviewed, APIs tested, web and mobile screens verified, and a short changelog. **No phase starts before the previous one is accepted.**

| # | Phase | Why first | Size |
|---|---|---|---|
| **A** | **Fix broken modules: Suppliers, Purchases, Supplier Ledger** (BRD §11, §14, §17) | The UI is already built and users hit errors today. This also makes stock-in and payables real. | ~1 week |
| B | Security cleanup and isolation tests (§27, Test 10) | Remove committed credentials, rotate them, and add tests proving owners can't read each other's data. | 2–3 days |
| C | Employees module, or remove the dead Payroll/EMI/Attendance clients (§24) | Decide scope; don't ship half-built menus. | 2–4 days |
| D | Shop business types and shop-to-shop relationships with credit terms (§3, §6) | Foundation for all B2B work. | ~1 week |
| E | B2B catalog visibility and price tiers (§7.1, §7.3) | Depends on D and decision 2. | ~1 week |
| F | B2B orders → invoice → linked buyer/seller ledgers (Digital Udhaar) (§7.2, §12) | Core value of the platform. | 2 weeks |
| G | Returns (B2B and purchase), defaulters and reminders (§18, §20) | Depends on F. | ~1 week |
| H | Public marketplace and shop storefront branding (§8.2, §21.1) | Depends on decision 1. | ~1 week |
| I | Mobile parity for D–H, plus cross-platform sync checks (§22, §29) | Mobile follows the web APIs. | 2 weeks |
| J | Automated acceptance tests 1–10 and production readiness (§30, §33) | Gate for "production ready". | ~1 week |

---

## 4. Decisions needed before B2B work (BRD §32)

These change the data model, so they must be decided before phases D–H:

1. Public marketplace, individual shop stores, or both?
2. B2B prices: public, registered shops only, or seller-controlled per buyer?
3. Credit: seller approval per buyer, or automatic within configured limits?
4. Customer identity: one verified platform login, or separate logins per shop?
5. Delivery and dispatch: inside NSYU or outside?
6. Payment methods and gateway (cash/UPI recorded only, or online gateway)?
7. GST and invoice rules per transaction type?
8. Platform commission or subscription fees?
9. Ratings and reviews?
10. Service-area restrictions?

Phase **A** does not depend on any of these and can start immediately.
