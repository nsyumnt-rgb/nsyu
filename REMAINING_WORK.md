# NSY Business Management System — Multiple-Shop Implementation Status

## 1. Audit & Defect Summary

Prior to this implementation, several architectural gaps and multiple-shop security vulnerabilities existed:
1. **IPv6 Connection Timeout**: Supabase direct database connection `db.lggjtxzannywecuvwqbl.supabase.co:5432` has only an `AAAA` IPv6 record, causing socket timeouts (`ETIMEDOUT`) on standard IPv4 networks.
   - *Fix*: Configured the Supabase connection pooler `aws-0-ap-south-1.pooler.supabase.com:5432` with user `postgres.lggjtxzannywecuvwqbl` over SSL.
2. **Missing PostgreSQL Dialect Support**: The Sequelize connection was defaulting to MySQL in certain files and lacked the `pg` and `pg-hstore` packages.
   - *Fix*: Installed `pg`, `pg-hstore`, and `@types/pg`; added dynamic dialect resolution supporting `DATABASE_URL` and SSL.
3. **Cross-Shop Insecure Direct Object References (IDOR)**:
   - In `saleController`, `purchaseController`, `emiController`, `paymentController`, `payrollController`: queries for individual records (`findByPk` or `findOne({ where: { id, owner_id } })`) checked only `owner_id`. If an owner had Shop A and Shop B, an employee assigned only to Shop A could read, pay, or cancel invoices, purchases, and payroll records belonging to Shop B.
   - *Fix*: Enforced `where.shop_id = req.auth.shopId` for all non-owners; owners default to their currently selected active shop or can pass `allShops=true` for consolidated access.
4. **Incorrect Shop Attribution on Financial/Stock Reversals**:
   - In cancellations and payments, transactions were referencing `req.auth.shopId` instead of the original record's `shop_id`. If an owner switched shop context, reversals would incorrectly post to the currently selected shop.
   - *Fix*: Explicitly attributed payments, ledger debits/credits, and inventory movements to `record.shop_id`.
5. **Shop Deletion Protection Missing**:
   - `deleteShop` allowed hard deletion of shops without checking for existing sales, purchases, or ledger entries, which would cause foreign-key errors or orphaned financial records.
   - *Fix*: Implemented deletion integrity validation blocking deletion if any financial, sales, inventory, or payroll records exist, requiring safe deactivation instead.
6. **Frontend Routing & Stale Context Drops**:
   - `Topbar.tsx` forced `navigate("/app")` whenever the active shop was switched, kicking users off whatever page they were browsing.
   - `Products.tsx` and `Inventory.tsx` used `useEffect(..., [])` without `shopId` in the dependency array, displaying stale inventory data from the previous shop until a full browser reload.
   - *Fix*: Removed `navigate("/app")` on switch; added `[shopId]` to `useEffect` dependency arrays across all module pages.
7. **Scaffolded Frontend Modules**:
   - Sales, Billing, Purchase, Customers, Suppliers, Payments, Ledger, EMI, Attendance, Payroll, and Reports were placeholders (`ModuleScaffold`).
   - *Fix*: Built full production frontend pages and corresponding TypeScript API clients for all 11 modules.

---

## 2. Completed / Pending Checklist

### Core Architecture & Database
- [x] Working Supabase PostgreSQL connection via connection pooler with SSL.
- [x] Zero destructive schema migrations executed against live Supabase data.
- [x] All 45 models synchronized and operational.
- [x] Transaction atomicity (`sequelize.transaction`) for multi-step financial & stock operations.
- [x] Decimal-safe monetary arithmetic (`round2`).

### Owner & Shop Management
- [x] Shop listing, creation, and detail retrieval (`GET /api/shops`, `POST /api/shops`, `GET /api/shops/:shopId`).
- [x] Shop update and status toggling (`PUT /api/shops/:shopId`, `PATCH /api/shops/:shopId/status`).
- [x] Safe deletion check: prevents deletion if sales, purchases, inventory, payroll, or EMI exist (`DELETE /api/shops/:shopId`).
- [x] Shop switching with JWT reissue (`POST /api/shops/switch`).
- [x] Employee restriction to authorized assigned shops (cross-shop access blocked with HTTP 403).
- [x] Deactivated shop switching blocked for employees.

### Shop-Wise Business Logic Modules
- [x] **Products**: Catalog records shared across shops; independent per-shop stock and min_stock levels.
- [x] **Inventory**: Direct stock movements (purchase, customer return, damage, adjustment) and 2-phase atomic inter-shop transfers (`POST /api/inventory/transfer`).
- [x] **Purchases**: Inward purchase bills, automatic receiving shop stock-in, and supplier ledger entries.
- [x] **Sales & Billing**: POS billing terminal, invoice generation, automatic stock deduction, payment methods (Cash, UPI, Card, Bank), and PDF downloads.
- [x] **Customers**: Central customer directory, credit limits, phone search, and balance tracking.
- [x] **Suppliers**: Central supplier directory and accounts payable tracking.
- [x] **Payments**: Customer receipts and supplier payments with PDF receipt streaming and voiding.
- [x] **Customer & Supplier Ledgers**: Running account statements calculating both `currentBalance` (global) and `shopBalance` (shop-specific).
- [x] **EMI / Installments**: Installment schedules, due collections view, auto late fee calculation, and payments.
- [x] **Employees & Roles**: Owner-managed employees, per-shop role assignments, and permission grids.
- [x] **Attendance**: Employee punch-in/out working hours tracking and manager attendance marking.
- [x] **Payroll**: Preview calculations from real attendance & incentives, payroll finalization, and salary disbursements.
- [x] **Reports & Dashboard**: Live BI reports (Sales, Purchases, P&L, Inventory Valuation, Collections, Shop Performance) with shop-specific vs. `allShops=true` consolidated views.

---

## 3. Verification Summary

1. **Automated Unit & Integration Tests**:
   - `tests/multishop_comprehensive.test.ts`: 5/5 PASSED
   - `tests/isolation.test.ts`: 6/6 PASSED
   - `tests/permissions.test.ts`: 8/8 PASSED
2. **Build Validations**:
   - Backend `api/`: `npm run build` compiled with 0 errors.
   - Frontend `web/`: `npm run build` bundled with Vite with 0 errors.
3. **Live Supabase PostgreSQL API Verification**:
   - Verified live authenticated queries for Owner (`demo.owner@nsyu.local`) and Manager (`manager@nsyu.local`).
   - Verified shop switching between Shop 1 (NSYU Main Store) and Shop 2 (NSYU Branch Store).
   - Verified shop-specific sales (Shop 1: ₹40,790) vs consolidated sales (All Shops: ₹49,066).
   - Verified unauthorized cross-shop switch blocked with HTTP 403.

---

## 4. Reference Mapping, Clickable Links & Record Detail Navigation System

### Core Architecture Implemented
- **Universal Reference Resolver (`GET /api/reference/resolve?ref=...`)**:
  - Intelligently parses and resolves any reference string (`INV-...`, `PUR-...`, `PAY-...`, `TRF-...`, `MOV-...`, `SKU`, customer phone/name, employee email/name) to its canonical route and database record.
  - Strictly scoped by `owner_id` to prevent multi-tenant data exposure.
- **Universal Frontend Component (`ReferenceLink.tsx`)**:
  - Types: `sale`, `purchase`, `payment`, `transfer`, `movement`, `product`, `customer`, `supplier`, `employee`, `emi`, `payroll`, `auto`.
  - Prevents table row click conflicts via `e.stopPropagation()`.
  - Uses accessible semantic markup and `#2563EB` hover underline styling.
- **Global Search in Topbar**:
  - Debounced live reference search in `Topbar.tsx` querying `/api/reference/resolve`.
  - Interactive autocomplete dropdown showing title, route, and entity type badge.
- **11 Dedicated Record Detail Pages (`web/src/pages/details/`)**:
  - `/app/sales/:id`: Full invoice breakdown, line items, customer profile link, SKU links, payments receipts table, EMI schedule link, PDF print/download.
  - `/app/purchase/:id`: Vendor purchase bill, supplier profile link, line items, PDF print/download.
  - `/app/payments/:id`: Payment voucher/receipt, customer/supplier link, linked invoice link, cancellation action.
  - `/app/inventory/transfers/:id`: Inter-shop transfer route visualizer, product SKU link, inventory movement audit trail.
  - `/app/inventory/movements/:id`: Inventory transaction impact card, product SKU link, shop badge, actor info.
  - `/app/customers/:id`: Customer 360 profile, sales invoices tab, ledger tab, EMI plans tab.
  - `/app/suppliers/:id`: Supplier profile, purchase bills tab, ledger tab.
  - `/app/products/:id`: Product master catalog, SKU, shop-wise stock breakdown table, supplier link.
  - `/app/employees/:id`: Employee master profile, assigned shops/roles, attendance logs, payroll runs.
  - `/app/emi/:id`: EMI loan schedule, customer link, invoice link, installment schedule table with inline payment action.
  - `/app/payroll/:id`: Salary voucher, employee link, gross earnings, deduction breakdown, salary disbursement log.
- **Flexible Backend Parameter Support**:
  - All detail endpoints support direct lookup by numeric primary key ID as well as human-readable reference strings (e.g. `/api/sales/INV-NSYUMAIN-000001` or `/api/sales/1`, `/api/products/IPH15-001` or `/api/products/21`, `/api/customers/9810000010` or `/api/customers/1`), ensuring full browser reload and direct link shareability.
- **Multi-Owner & Multi-Shop Authorization**:
  - All detail endpoints strictly enforce `owner_id` scoping.
  - Employees are restricted to authorized assigned shops; cross-owner and unauthorized queries return HTTP 401/403/404.

### Reference Links Integrated Across Modules:
- [x] **Sales Page (`Sales.tsx`)**: Invoices, customer names, view actions.
- [x] **Purchase Page (`Purchase.tsx`)**: Purchase bills, supplier names, view actions.
- [x] **Payments Page (`Payments.tsx`)**: Receipt numbers, customer names, invoice references, supplier names, purchase references.
- [x] **Customer & Supplier Ledgers (`Ledger.tsx`)**: Sale invoices, purchase bills, payment receipts.
- [x] **EMI Page (`EMI.tsx`)**: EMI plan IDs, customer names, sale invoice numbers.
- [x] **Inventory Page (`Inventory.tsx`)**: Stock movement IDs, product SKUs, transfer numbers.
- [x] **Dashboard (`Dashboard.tsx`)**: Recent sales invoices, customer names, recent purchase bill numbers, supplier names, low-stock product SKUs.
- [x] **Customer Directory (`Customers.tsx`)**: Customer names, view profile links.
- [x] **Supplier Directory (`Suppliers.tsx`)**: Supplier names, view profile links.
- [x] **Product Catalog (`Products.tsx`)**: Product names, SKU numbers.
- [x] **Employee Directory (`Employees.tsx`)**: Employee names, view profile links.
- [x] **Payroll (`Payroll.tsx`)**: Payroll period IDs, employee names, voucher links.
- [x] **Attendance (`Attendance.tsx`)**: Employee names linked to employee profiles.

### Verification Status:
- [x] Universal Reference Resolver API: 100% Verified
- [x] 11 Detail Endpoints (Numeric & Reference queries): 100% Verified
- [x] 404 & IDOR Authorization Protections: 100% Verified
- [x] Backend Build (`npm run build` in `api`): Exited with 0 errors
- [x] Frontend Build (`npm run build` in `web`): Exited with 0 errors
