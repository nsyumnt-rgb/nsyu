# NSYU Business — Backend Core (Foundation Pass)

Multi-owner, multi-shop business management system backend.
Stack: **Node.js + Express + TypeScript + Sequelize + MySQL**, JWT (access + refresh).

## What's built in this pass

This pass delivers the **foundation everything else depends on**, plus one
fully-wired example module (`Products`) that demonstrates the pattern
to copy for every remaining module (Inventory, Purchase, Sales, Billing,
Customers, Suppliers, Payments, Ledger, EMI, Attendance, Payroll, Reports).

- **Owner** accounts — fully isolated data, one owner never sees another's data
  (every query is filtered by `owner_id`, injected server-side from the JWT — never from the client).
- **Shop** — an owner can create multiple shops; each is a data-isolation boundary
  for everything under it.
- **Employee** accounts — belong to an owner, can be assigned to multiple shops,
  with a **different role per shop** (e.g. Manager at Shop A, Sales Staff at Shop B).
- **Role & Permission system**:
  - Module-level grants (`view` / `create` / `edit` / `delete`) per module (Products, Sales, Billing, ...).
  - Sensitive **field-level** grants (purchase price, selling price, profit, supplier, customer outstanding, EMI, salary) — independent of module access.
  - Enforced at the **API layer** via middleware, not just hidden in the UI.
  - System roles (Owner, Manager, Sales Staff, Billing Staff, Inventory Staff, Accountant) auto-created with sane defaults for every new owner; owner can also create fully custom roles.
- **Auth**: JWT access + refresh tokens. Access token carries `ownerId`, `isOwner`, `employeeId`, `shopId`, `roleId` — so most requests need zero extra DB lookups to know "who is this and what can they touch."
- **Shop switching**: `/api/shops/switch` re-issues an access token scoped to the selected shop (this is what powers the `Shop: Main Shop ▼` dropdown in the top bar).
- **Audit Logs**: every meaningful write action is recorded (`owner_id`, `shop_id`, actor, module, action, entity).
- **Products** module — fully wired example (model, controller, routes, permission checks, field redaction, audit logging).

## Project structure

```
src/
  config/
    database.ts        Sequelize connection
    permissions.ts      Central list of modules / actions / sensitive fields / system roles
  models/
    Owner.ts, Shop.ts, Role.ts, RolePermission.ts, RoleFieldPermission.ts,
    Employee.ts, EmployeeShop.ts, RefreshToken.ts, AuditLog.ts, Product.ts
    index.ts            All associations wired here
  middleware/
    auth.ts             authenticate / requireShop / requireOwner
    permission.ts        requirePermission() + field-level redaction helpers
    errorHandler.ts
  controllers/
    authController.ts, shopController.ts, roleController.ts,
    employeeController.ts, productController.ts (EXAMPLE)
  routes/
    authRoutes.ts, shopRoutes.ts, roleRoutes.ts,
    employeeRoutes.ts, productRoutes.ts (EXAMPLE)
  utils/
    jwt.ts, seed.ts, audit.ts
  app.ts, server.ts
```

## Setup

```bash
cp .env.example .env      # fill in your MySQL credentials + JWT secrets
npm install
npm run dev                # http://localhost:5000, auto-creates tables (dev mode)
```

In production, replace `sequelize.sync({ alter: true })` in `server.ts`
with proper `sequelize-cli` migrations — sync-in-prod is fine for getting
started but risky for schema changes on live data.

## How the permission system works, end to end

1. Owner registers → `seedOwnerDefaults()` creates the 6 system roles with default module/field access.
2. Owner creates a Shop, creates Employees, assigns each employee a Role **per shop** via `/api/employees/assign-shop`.
3. Employee logs in → gets an access token with `shopId: null` (must pick a shop).
4. Employee calls `/api/shops/switch` → gets a NEW token with `shopId` + `roleId` embedded.
5. Every module route (e.g. `/api/products`) is protected by:
   ```ts
   router.use(authenticate, requireShop);
   router.get("/", requirePermission("products", "view"), listProducts);
   ```
   `requirePermission` looks up the `RolePermission` row for `(roleId, module)` and blocks the request server-side if not granted — the frontend hiding a button is not the security boundary.
6. Sensitive fields (e.g. `purchase_price`) are stripped from JSON responses via `getAllowedFields()` + `stripFields()` in the controller, independent of whether the employee can view the module at all.

## Replicating this for the next module (e.g. Inventory)

Copy the Products pattern exactly:

1. **Model** (`src/models/Inventory.ts`) — always include `owner_id` + `shop_id`, index them together.
2. **Register it** in `src/models/index.ts` (add associations to Owner/Shop).
3. **Add `"inventory"`** to `MODULES` in `src/config/permissions.ts` (it's already there — most module names from your sidebar are pre-registered; just add any new ones).
4. **Controller** (`src/controllers/inventoryController.ts`) — scope every query by `req.auth.ownerId` + `req.auth.shopId`, never from the request body.
5. **Routes** (`src/routes/inventoryRoutes.ts`) — same `authenticate, requireShop` + `requirePermission("inventory", action)` shape as `productRoutes.ts`.
6. **Mount it** in `src/app.ts`: `app.use("/api/inventory", inventoryRoutes)`.

That's the whole loop — no changes needed anywhere else, because the Owner/Shop/Role/Permission core doesn't know or care how many business modules sit on top of it.

## Verifying nothing is broken

This is a fresh project (no prior codebase existed to inspect, per your confirmation), so there's nothing existing to have broken. The project builds clean:

```bash
npx tsc --noEmit   # 0 errors
npm run build      # emits to dist/
```

## Next passes (suggested order)

1. Inventory + Purchase + Suppliers (they're tightly coupled — stock in/out)
2. ~~Sales + Billing + Customers + Customer Ledger~~ ✅ done — see below
3. ~~Payments + EMI/Installments~~ ✅ done — see below
4. ~~Employees → Attendance → Leave → Payroll~~ ✅ done — see below
5. ~~Reports, Audit Log, Notifications, Security, Testing~~ ✅ done — see below
6. A dedicated Purchase Order / Supplier Payment / Supplier Ledger module — the Purchase and Supplier Outstanding reports currently work off `InventoryTransaction` purchase movements valued at each product's *current* price, since there's no historical cost snapshot or supplier payment tracking yet (see `reportController.ts`'s doc comments on those two functions).
7. Frontend: Next.js dashboard consuming this API (sidebar/topbar per your spec), Flutter mobile app

---

## Sales + Billing + Customer Ledger + EMI (this pass)

Adds the full sale-to-cash lifecycle on top of the foundation above,
without touching any existing model, controller, route, or table.
Follows the exact patterns already established by `Products` /
`Inventory` (`recordStockMovement`): every money- or stock-affecting
write goes through one dedicated util, inside one `sequelize.transaction`,
so bill / stock / ledger can never drift apart. Nothing is ever
hard-deleted — cancellations and returns post new offsetting rows and
flip a `status` column, keeping full audit history.

### New models

- `Customer` — owner-level (like Product), `current_balance` cached from the ledger.
- `Sale` + `SaleItem` — the Bill/Invoice header + line items (snapshotted price/discount/tax).
- `Payment` — every rupee received (sale payment, EMI down payment / installment, refund). Cash, UPI, Bank Transfer, Card, Cheque, Other.
- `CustomerLedger` — append-only debit/credit ledger with running balance (mirrors `InventoryTransaction`'s design).
- `EMIPlan` + `EMIInstallment` — full schedule (down payment, financed amount, interest, per-installment due date/expected/paid/late fee/status).
- `SaleReturn` + `SaleReturnItem` — partial/full product returns with refund-as-ledger-credit.
- `InvoiceCounter` — race-safe sequential invoice numbers per shop.

### New utils (the "only place allowed to write X" pattern)

- `utils/ledger.ts` — `recordLedgerEntry` (only place `Customer.current_balance` / `CustomerLedger` rows are written) and `reverseLedgerEntry`.
- `utils/invoice.ts` — `nextInvoiceNumber` (row-locked counter, transaction-safe).
- `utils/emi.ts` — `buildEmiSchedule` (flat-interest schedule generator) and `refreshInstallmentStatuses` (lazily recomputes Upcoming/Due/Overdue on every read, no cron needed).
- `utils/pdf.ts` — `streamBillPdf` / `streamReceiptPdf` (pdfkit) for printable/downloadable invoices and payment receipts.

### New endpoints

```
Customers
  GET    /api/customers
  GET    /api/customers/:customerId
  POST   /api/customers
  PUT    /api/customers/:customerId

Sales / Billing
  GET    /api/sales                       (filters: customerId, status, isEmi, from, to)
  GET    /api/sales/:saleId
  POST   /api/sales                       Customer→Shop→Product→Cart→Discount→Tax→Payment→Bill→Inventory→Ledger, all-or-nothing
  POST   /api/sales/:saleId/payments      partial/later payment against a non-EMI sale's due amount
  POST   /api/sales/:saleId/cancel        reverse stock + close outstanding ledger debit, never deletes
  POST   /api/sales/:saleId/returns       per-line partial/full return, restocks + credits ledger
  GET    /api/sales/:saleId/bill/pdf      printable/downloadable invoice

Payments
  GET    /api/payments                    (filters: customerId, saleId, type)
  GET    /api/payments/:paymentId
  POST   /api/payments/:paymentId/cancel  void a mistaken entry (reversing ledger debit, never deletes)
  GET    /api/payments/:paymentId/receipt/pdf

Customer Ledger
  GET    /api/ledger/:customerId          full history + running balance + debit/credit totals
  GET    /api/ledger/outstanding          every customer with a non-zero balance

EMI
  GET    /api/emi                         (filters: customerId, status)
  GET    /api/emi/due                     installments that are Due/Overdue/Partially Paid, for a collections view
  GET    /api/emi/:planId
  POST   /api/emi/installments/:installmentId/pay   Payment → installment → ledger → outstanding, one transaction
  POST   /api/emi/:planId/cancel          cancels remaining installments + closes outstanding ledger debit
```

All routes require `authenticate + requireShop` and are gated by
`requirePermission(module, action)` exactly like every other module —
`sales`, `billing`, `customers`, `payments`, `ledger`, `emi` were
already pre-registered in `config/permissions.ts` and already have
sane per-role defaults in `utils/seed.ts`, so no permission-system
changes were needed.

### Business rules encoded

- **Partial payment**: `Sale.due_amount = total_amount - paid_amount`, always kept in sync; a later `POST /:saleId/payments` reduces it further and flips `status` to `paid` once it hits zero.
- **EMI**: down payment paid at sale time; the rest is financed, split into installments with flat interest; each installment tracks its own paid/remaining/status; paying one runs Payment → EMIInstallment update → CustomerLedger credit → EMIPlan.outstanding_amount (and the parent Sale's due_amount) update, in one transaction.
- **Late fee**: auto-applied once, the first time an installment is paid after its `due_date`, if the plan has `late_fee_percent` configured.
- **Cancellation**: reverses inventory (`customer_return`) and posts a closing ledger credit for the outstanding balance; status → `cancelled`. Payments already received are left on record (they become shop credit) — nothing is deleted.
- **Returns**: independent of cancellation; per-line, restocks inventory and credits the ledger for the refunded amount; `Sale.status` becomes `partially_returned` / `returned`.
- **PDFs**: `GET /:saleId/bill/pdf` and `GET /:paymentId/receipt/pdf` stream a generated PDF (pdfkit) with shop/customer/item/payment details.

---

## Attendance + Leave + Salary + Payroll (this pass)

Adds employee-facing attendance/leave self-service plus a full
payroll engine, again without touching any existing model,
controller, route, or table — the only change to a pre-existing file
is one new additive column, `Employee.salary_outstanding` (defaults
to `0`, mirrors `Customer.current_balance`'s role for the new
`EmployeeLedger`).

### New models

- `Attendance` — one row per (employee, date): check-in/out, working/overtime hours, status (Present/Absent/Half Day/Leave/Holiday/Week Off/Late), remarks.
- `LeaveRequest` — type, start/end date, days, reason, status (Pending/Approved/Rejected/Cancelled), approver, paid/unpaid flag.
- `SalaryConfig` — date-effective salary structure history (Monthly/Weekly/Daily/Hourly/Commission), basic, allowances, overtime rate, incentive, commission %, deductions, cycle.
- `EmployeeAdvance` — a disbursed advance with a live `outstanding_amount` that future payroll runs recover from.
- `EmployeeIncentive` — fixed or percentage-based incentive/commission entries (percentage entries take an owner-supplied base amount + percent, since attributing commission automatically to specific sales/products is out of scope for this pass — see the model's doc comment).
- `Payroll` — one row per employee per pay cycle: Present/Absent/Half/Paid Leave/Unpaid Leave days, overtime, incentive, gross/net salary, paid/due amount.
- `SalaryPayment` — Cash/UPI/Bank Transfer/Cheque/Other payout against a finalized payroll.
- `EmployeeLedger` — append-only Salary/Advance/Advance Recovery/Incentive/Deduction/Salary Payment ledger with running "Outstanding" balance (same design as `CustomerLedger`).

### New utils

- `utils/attendance.ts` — working-hours/overtime computation, leave date-range helpers.
- `utils/salaryLedger.ts` — `recordEmployeeLedgerEntry` (only place `Employee.salary_outstanding` / `EmployeeLedger` rows are written) and `reverseEmployeeLedgerEntry`.
- `utils/payroll.ts` — `calculatePayroll` (pure function implementing the Monthly/Weekly/Daily/Hourly/Commission formulas), `summarizeAttendance`, `getActiveSalaryConfig`, advance/incentive lookups.

### New endpoints

```
Attendance
  POST   /api/attendance/check-in        self-service punch-in
  POST   /api/attendance/check-out       self-service punch-out (computes working/overtime hours)
  GET    /api/attendance/me              self-service history
  GET    /api/attendance                 owner/manager: all employees (filters: employeeId, status, from, to)
  POST   /api/attendance                 owner/manager: mark/correct a specific day for any employee
  POST   /api/attendance/bulk            owner/manager: bulk-mark one status (e.g. Holiday) for many employees

Leave
  POST   /api/leave                      self-service request (type, startDate, endDate, reason)
  GET    /api/leave/me                   self-service history
  POST   /api/leave/:leaveId/cancel      self (own, Pending only) or owner
  GET    /api/leave                      owner/manager: all requests (filters: employeeId, status)
  POST   /api/leave/:leaveId/decide      owner/manager: approve/reject (approving also stamps Attendance="Leave" for each date)

Payroll (mounted at /api/payroll)
  GET    /me                             self-service payroll history
  GET    /me/ledger                      self-service salary ledger
  POST   /salary-config                  owner/manager: set a new date-effective salary structure
  GET    /salary-config/:employeeId      history
  GET    /salary-config/:employeeId/current
  POST   /advances                       owner/manager: disburse a salary advance
  GET    /advances
  POST   /advances/:advanceId/cancel
  POST   /incentives                     owner/manager: record a fixed or percentage incentive/commission
  GET    /incentives
  POST   /incentives/:incentiveId/cancel
  GET    /preview                        dry-run payroll calculation (no writes) — sanity-check before /run
  POST   /run                            calculate + finalize payroll for one employee/period, all-or-nothing
  GET    /                               owner/manager: list payrolls (filters: employeeId, status)
  GET    /outstanding                    owner: every employee with a non-zero salary_outstanding
  GET    /:payrollId
  POST   /:payrollId/pay                 record a salary payment (Cash/UPI/Bank Transfer/Cheque/Other)
  POST   /:payrollId/cancel              void an unpaid payroll (reverses ledger, restores advances/incentives)
  GET    /ledger/:employeeId             owner/manager: one employee's full salary ledger
```

All routes require `authenticate + requireShop`. Self-service routes
(`check-in`/`check-out`/`/me`/`/me/ledger`/leave request & self-cancel)
need no module permission at all — any authenticated employee can
always see and act on their own attendance/leave/payroll. Every
route that touches ANOTHER employee's data is gated by
`requirePermission("attendance"|"leave"|"payroll", action)`, exactly
like every other module — the Owner account bypasses these checks as
usual, and a Manager (or any custom role granted these modules) can
be given that broader access explicitly via the Roles UI. This
satisfies "Employee must only see their own salary/attendance unless
owner explicitly grants additional permission" without needing any
new permission-system concept — `middleware/permission.ts` gained one
small helper, `requireSelfOrPermission`, for future routes that want
this same self-vs-elevated split with a single permission check.

`leave` was added to `config/permissions.ts`'s `MODULES` list (auth,
roles, and seed defaults all read from that list already, so nothing
else needed to change); `Manager` gets it automatically via
`[...MODULES]`, and `Accountant` was additionally granted
`attendance`/`leave`/`payroll` view access as a sane default.

### Business rules encoded

- **Payroll formula** (see `models/Payroll.ts` and `utils/payroll.ts` for the exact math): `gross_salary = prorated_basic + prorated_allowances + overtime_amount + incentive_amount`; `net_salary = gross_salary − other_deduction − advance_deduction`; `due_amount = net_salary − paid_amount`. Monthly/Weekly/Daily prorate basic+allowances by `payable_days / total_days_in_period`; Hourly pays actual regular hours logged; Commission uses the configured base retainer (often 0) plus incentive/commission entries.
- **Payable days**: Present + Late + Holiday + Week Off + Paid Leave count in full; Half Day counts as 0.5; Absent and Unpaid Leave count as 0.
- **Paid vs Unpaid Leave**: determined by the `is_paid` flag the approver sets on the `LeaveRequest` at approval time (not by leave type alone), then matched against each `Attendance` row with `status="Leave"` in the period.
- **Overtime**: any working hours beyond 8/day recorded on `Attendance.overtime_hours` at check-out, multiplied by the salary config's `overtime_rate`.
- **Advance recovery**: `POST /run` auto-deducts `min(total outstanding advance, net salary before advance)` unless an explicit `advanceDeduction` override is passed; recovery is applied FIFO across the employee's outstanding `EmployeeAdvance` rows.
- **Incentives**: a `pending` `EmployeeIncentive` whose period falls fully inside the payroll period is pulled into that run and flipped to `included_in_payroll` (never double-counted); cancelling that payroll frees it back to `pending`.
- **Cancellation**: never deletes anything. `Payroll` can only be cancelled while `paid_amount = 0` (void any `SalaryPayment` first); cancelling reverses the ledger, restores any advance principal it recovered, and un-consumes any incentives.
- **Employee Salary Ledger**: `Employee.salary_outstanding` is the running "amount the owner currently owes this employee" — Salary/Incentive entries increase it, Advance/Advance Recovery/Deduction/Salary Payment entries decrease it, exactly matching the spec's required ledger line types.

---

## Reports + Audit Log + Notifications + Security + Testing (this pass)

Completes the system: comprehensive reporting, richer audit trails,
a notification system, security hardening, and an automated test
suite — again without changing any unrelated existing behavior.

### Reports (`/api/reports/*`)

All 14 requested report types, each supporting `?from=&to=` date
filtering and, for the Owner, an optional `?shopId=` filter (an
employee is always hard-pinned to their own current shop — see
Security below):

```
GET /api/reports/sales                 revenue, discount, tax, due, payment-method mix
GET /api/reports/purchase               purchase volume/value from InventoryTransaction (see note below)
GET /api/reports/inventory              current stock, valuation, low-stock flags
GET /api/reports/profit                 revenue vs COGS, gross margin, by product
GET /api/reports/customer-outstanding   every customer's balance (shop-scoped for employees — see Security)
GET /api/reports/supplier-outstanding   purchase value per supplier (see note below)
GET /api/reports/emi                    plan/installment status mix, outstanding totals
GET /api/reports/payments               received payments by method/type
GET /api/reports/shop-performance       revenue/due across shops, side by side (owner) or own shop (employee)
GET /api/reports/product-performance    units sold + revenue per product
GET /api/reports/attendance             per-employee status counts
GET /api/reports/salary                 active config + amount paid per employee
GET /api/reports/payroll                payroll runs: gross/net/paid/due
GET /api/reports/advances               disbursed/recovered/outstanding advances
```

**Known limitation, stated honestly rather than faked**: this codebase
has no Purchase Order / Supplier Payment module yet, so `purchase` and
`supplier-outstanding` are computed from `InventoryTransaction`
`type="purchase"` rows valued at each product's *current*
`purchase_price` — a good volume/value estimate, not a precise
historical cost or a confirmed payable balance. Both endpoints say so
in their response. Wiring in real historical costs and a supplier
ledger (mirroring `CustomerLedger`) is the natural next module.

### Audit Log

`AuditLog` gained `old_value`/`new_value` columns (JSON snapshots of
just the changed field(s)), and `logAudit()` now accepts them. Wired
into the specifically-named events from the spec: product price
changes (`products`/`price_change`), permission changes
(`employees`/`permission_change`), employee status changes
(`employees`/`employee_change`), salary config changes
(`payroll`/`salary_change`), and stock adjustments
(`inventory`/`stock_adjustment`) — on top of the create/update/delete/
cancel logging already present everywhere else from prior passes
(sale cancellation, payment cancellation, EMI payment/cancel, stock
transfer, etc.).

### Notifications (`/api/notifications/*`)

```
GET  /api/notifications              self-service — only ever your own (owner sees owner-addressed, employee sees their own)
POST /api/notifications/:id/read
POST /api/notifications/read-all
GET  /api/notifications/alerts        live-computed: low stock, overdue EMI, pending leave (not persisted, never stale)
```

Persisted notifications are created synchronously at the moment an
event happens (leave requested → notifies owner; leave decided →
notifies the employee; payroll finalized → notifies the employee) —
there's no background job runner in this codebase, so this mirrors
the same lazy/on-demand philosophy already used for EMI installment
status refresh, rather than introducing a new cron/queue dependency.

### Security

- **Input validation**: `express-validator` (a dependency that was declared but never actually wired up) now backs a `middleware/validate.ts`, applied to the highest-risk write endpoints — register, login, product creation, sale creation, employee creation, payroll run, and the date-range query params on every report. This is a second layer on top of each controller's own existing manual checks, not a replacement for them.
- **File uploads**: `middleware/upload.ts` now checks the file **extension** in addition to the declared MIME type (defense in depth — a mismatched or spoofed extension/MIME pair is rejected either way); filenames are still always rewritten to a fresh UUID, so the original filename is never trusted.
- **Shop isolation audit**: found and fixed a real gap in `shopPerformanceReport` (was showing every shop to any employee with reports access, regardless of their assigned shop) and designed `customerOutstandingReport`/employee-wise reports to scope correctly for employees (see below) — caught by the new test suite, not just inspection.
- **Sensitive field protection**: reports that touch `purchase_price`, `profit`, `customer_outstanding`, `emi`, or `salary` now gate on the existing field-permission system (`getAllowedFields`) — these fields were already pre-registered in `config/permissions.ts` anticipating exactly this.
- **Employee-wise report scoping**: for a non-owner actor, `attendance`/`salary`/`payroll`/`advances` reports are filtered to only employees assigned to the actor's current shop (via `EmployeeShop`), and `customer-outstanding` is recomputed from just that shop's `CustomerLedger` entries rather than exposing a customer's owner-wide balance (which could otherwise leak what a customer owes at *other* shops).

### Testing

A real Jest + Supertest + SQLite integration suite — `npm test` — 31
tests across 4 files, all passing:

```
tests/isolation.test.ts    multi-owner isolation, multi-shop isolation (6 tests)
tests/permissions.test.ts  employee module/field permissions, self-access, unauthenticated (8 tests)
tests/sales.test.ts        product/inventory, sale/billing, partial payment, cancellation, returns, EMI (7 tests)
tests/payroll.test.ts      attendance, leave, payroll run, salary payment, advance recovery, report gating (10 tests)
```

`config/database.ts` gained a `TEST_DIALECT` env-var switch (only
ever set by `tests/env.ts`, never by a real `.env`) so the test suite
runs against an in-memory SQLite database instead of requiring a real
MySQL instance — zero behavior change for the actual running app.
Run with `npm test`.

---

## Purchase Module + Demo Data Seeding (this pass)

### Purchase module (was a `TODO`/scaffold — now real)

Mirrors the Sales module's exact structure and discipline, direction
reversed: `Purchase`, `PurchaseItem`, `SupplierPayment`,
`SupplierLedger`, `PurchaseReturn`/`PurchaseReturnItem`,
`PurchaseCounter`. Added a `purchase_return` `MovementType` (decreasing)
to `InventoryTransaction` rather than misusing `damage`. `Supplier`
gained `current_balance` (+ full CRUD: `PUT`/`PATCH status`, which
were previously missing).

```
POST   /api/purchases                    Supplier→Shop→Product→Cart→Discount→Tax→Payment→Save→+Inventory→Supplier Ledger
GET    /api/purchases | /:id
POST   /api/purchases/:id/payments       partial/later payment against due
POST   /api/purchases/:id/cancel         reverses inventory, closes outstanding ledger credit — never deletes
POST   /api/purchases/:id/returns        per-line return, decrements inventory, debits supplier ledger
GET    /api/purchases/:id/pdf
GET    /api/supplier-ledger/:supplierId  | /outstanding | /payments
PUT/PATCH /api/suppliers/:id, /:id/status
```

`reportController.ts`'s `purchaseReport`/`supplierOutstandingReport`
now read real `Purchase`/`SupplierLedger` data instead of the
`InventoryTransaction`-based approximation from the previous pass.
Covered by `tests/purchase.test.ts` (create/pay/cancel/return/supplier
CRUD, 5 tests).

### Demo/dev data seeding

`src/seed/` — `seedData.ts` (pure data), `seed.ts` (orchestration,
reuses the SAME business-logic utils the real controllers use —
`recordStockMovement`, `recordLedgerEntry`, `recordSupplierLedgerEntry`,
`recordEmployeeLedgerEntry`, `buildEmiSchedule` — so demo data is
financially consistent, not just plausible-looking rows), `reset.ts`
(demo-owner-scoped deletion only), `run.ts` (CLI entry).

- **Idempotent**: gated entirely on whether `Owner` with
  `demo.owner@nsyu.local` already exists; if so, seeding is a no-op.
- **Production-safe**: `server.ts` only auto-seeds when
  `NODE_ENV !== "production" AND ENABLE_DEMO_SEED === "true"` (see
  `.env`); a seed failure is logged but never crashes the server.
- **Commands**: `npm run seed` (manual trigger), `npm run seed:reset`
  (deletes only the demo owner's data — verified by a test that
  creates a real second owner alongside the demo one and confirms
  `reset` never touches it).
- Creates: 1 owner, 2 shops, 4 employees (Manager/Sales Staff/
  Inventory Staff/Accountant — see `TEST_CREDENTIALS.md` at the repo
  root for logins), 5 categories, 20 products with per-shop opening
  stock, 5 suppliers, 10 customers, 15 sales (mixed paid/partial/credit),
  2 EMI plans, 7 purchases, ~80 attendance rows, 4 leave requests, a
  full payroll cycle per employee (+ 1 advance, 1 incentive), 4
  notifications.
- Verified for real (not just written) via `tests/seed.test.ts`: full
  dataset creation, exact idempotency (running 3× doesn't triple
  anything), reset-then-reseed, and reset-never-touches-a-real-owner —
  4/4 passing.
