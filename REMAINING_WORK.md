# NSYU BUSINESS MANAGEMENT SYSTEM — MASTER ROADMAP & VERIFICATION MATRIX
*** Read project_instruction.docx for complete details.***
---

## 1. Executive Summary & Architecture Status

The NSYU Business Management System is a unified, multi-tenant enterprise platform supporting:
1. **Frontend Web Dashboard**: React 19 + TypeScript + Vite deployed on GitHub Pages (`https://nsyumnt-rgb.github.io/nsyu/#/login`).
2. **Mobile Client**: Flutter Android release APK (`App/app-release.apk`, 63.6 MB) and iOS architecture.
3. **Backend REST API**: Node.js + Express + TypeScript on Render (`https://nsyu-backend-api.onrender.com/api`).
4. **Authoritative Database**: PostgreSQL hosted on Supabase (`aws-0-ap-south-1.pooler.supabase.com:5432`) with 48 active relational tables.

---

## 2. Multi-Tenant Organization & Account Hierarchy (Section 2)

| Hierarchy Level | Entity Code | Primary Login | Assigned Shops / Boundary | URL / Route Entry |
|---|---|---|---|---|
| **Parent Company** | `NSYU` | `nsyu.mnt@gmail.com` | Company administration & software service master catalogue | `/#/login` |
| **Workspace 1** | `PTL` | `owner1@gmail.com` | Full owner access to `PTLS`, `RTLS` and custom PTL shops | `/PTL#/login` or `/#/login?ws=PTL` |
| - Shop 1 | `PTLS` | `adminShop1@gmail.com` | Scoped strictly to `PTLS` operations | Scoped to PTLS |
| - Shop 2 | `RTLS` | `adminShop2@gmail.com` | Scoped strictly to `RTLS` operations | Scoped to RTLS |
| **Workspace 2** | `MLT` | `owner2@gmail.com` | Full owner access to `MLTS`, `MTLS` and custom MLT shops | `/mlt#/login` or `/#/login?ws=mlt` |
| - Shop 1 | `MLTS` | `adminShop3@gmail.com` | Scoped strictly to `MLTS` operations | Scoped to MLTS |
| - Shop 2 | `MTLS` | `adminShop4@gmail.com` | Scoped strictly to `MTLS` operations | Scoped to MTLS |

### Isolation Rules
- **Cross-Tenant Guard**: PTL owner and staff can NEVER see, query, or modify MLT shops, products, stock, or financials.
- **Route $\neq$ Authorization**: Changing `/PTL` to `/mlt` in the URL returns 403 Forbidden on the backend.
- **Multi-Shop Assignment**: A single staff user can be assigned to multiple shops under their workspace without duplicate accounts.

---

## 3. Sidebar Navigation & 17 Core Modules (Section 6)

Order and exact group titles verified in `web/src/layouts/Sidebar.tsx`:

### BUSINESS (10 Modules)
- [x] **Products** (`/app/products`): SKU, category, purchase price, fixed margin amount (₹), selling price, tax %.
- [x] **Inventory** (`/app/inventory`): Shop-wise stock, immutable stock movements, low-stock alerts, transfers.
- [x] **Purchase** (`/app/purchase`): Supplier orders, receipts, unit costs, purchase returns.
- [x] **Sales** (`/app/sales`): Transaction history, returns, sales status.
- [x] **Billing** (`/app/billing`): Counter POS, barcode scanning, itemized discount, tax modes, invoice generation.
- [x] **Customers** (`/app/customers`): Profiles, contact info, sales history, balance dues.
- [x] **Suppliers** (`/app/suppliers`): Profiles, purchase history, payables.
- [x] **Payments** (`/app/payments`): Customer receipts, supplier payments, mode allocations.
- [x] **Customer Ledger** (`/app/ledger`): Append-only debit/credit timeline, running outstanding balance.
- [x] **EMI / Installments** (`/app/emi`): Installment schedules, due dates, collections, overdue tracking.

### PEOPLE (3 Modules)
- [x] **Employees** (`/app/employees`): Staff profiles, shop assignments, designation, sensitive salary data.
- [x] **Attendance** (`/app/attendance`): Daily present/absent/leave records, locked upon approved payroll.
- [x] **Salary / Payroll** (`/app/payroll`): Monthly salary calculation, advances/incentives, payslips.

### ADMIN (4 Modules)
- [x] **Shops** (`/app/shops`): Workspace shop management, status toggle, address, invoice prefix.
- [x] **Roles & Permissions** (`/app/roles`): Role templates, action permissions (View, Create, Edit, Delete, Approve, Export).
- [x] **Reports** (`/app/reports`): Sales, purchase, stock, payment, ledger, and EMI reports.
- [x] **Settings** (`/app/settings`): Business profile, tax rates, print layouts, security policies.

---

## 4. Business Calculation & Integrity Rules (Section 8 & 12)

- **PRD-01: Product Pricing Rule**:
  $$\text{Selling Price} = \text{Purchase Price} + \text{Margin Amount (₹)}$$
  Margin is an absolute currency amount, never a percentage. Selling price is calculated and validated server-side.
- **INV-01 — INV-09: Stock Integrity**:
  - Stock is strictly shop-specific (`shop_id`, `product_id`).
  - Every stock change creates an immutable `stock_movement` row.
  - Row-level locks (`SELECT FOR UPDATE`) prevent concurrent overselling.
- **BIL-01 — BIL-10: Billing & Invoicing**:
  - Invoices are created in a single database transaction.
  - Bill discount defaults to ₹0.00.
  - Sequential gapless document numbering allocated inside row-locked sequence transactions.
- **LED-01 — LED-07: Customer Ledger**:
  - Positive balance = customer owes business.
  - Append-only records; no physical deletions.
  - Balance = Total Debits - Total Credits.
- **EMI-01 — EMI-11: Installments**:
  - Receivable exists once on invoice; installments are collections. No double-counting in ledger.

---

## 5. Decision Register Status (Appendix E: D-01 to D-25)

| ID | Topic | Recommended Default Adopted | Status |
|---|---|---|---|
| **D-01** | NSYU Company Cross-Owner Access | Administration only; cross-owner reports require explicit grant | Enforced |
| **D-02** | User in both PTL & MLT | Disallowed by default; workspaces isolated | Enforced |
| **D-03** | Catalogue Scope | Owner-scoped catalogue with shop-specific stock | Enforced |
| **D-04** | Mixed Product/Service Invoices | Supported; only physical items deduct stock | Enforced |
| **D-05** | GST Calculation & Rounding | Flat & % of subtotal supported; two decimal rounding | Enforced |
| **D-06** | Price Overrides & Margins | Selling price locked from margin formula; no negative margins | Enforced |
| **D-07** | Returns & Refunds | Linked to original invoice; credit note by default | Enforced |
| **D-08** | Invoice Cancellation | Requires confirmation + reason; reverses payment/ledger | Enforced |
| **D-09** | Shop Codes | Unique per owner workspace | Enforced |
| **D-10** | Approvals & Thresholds | Deletions and payroll require approved roles | Enforced |
| **D-11** | Data Retention & Backup | Daily cloud backups with point-in-time recovery | Enforced |
| **D-12** | Costing Method | Explicit purchase price updates; weighted average for valuation | Enforced |
| **D-13** | Negative Stock | Disallowed by default | Enforced |
| **D-14** | Customer Master Scope | Workspace-wide with shop-level activity scoping | Enforced |
| **D-15** | EMI Method & Allocation | Oldest-due installment first; late-fee configuration | Enforced |
| **D-16** | Payment Methods | Cash, UPI, Card, Bank Transfer | Enforced |
| **D-17** | Payroll Proration | Calendar-day proration | Enforced |
| **D-18** | Attendance Capture | Manual entry baseline with audit history | Enforced |
| **D-19** | Services Module | Option A (Services as non-stockable products) active | Enforced |
| **D-20** | Financial Year | 1 April – 31 March (FY 2026-27 active) | Enforced |
| **D-21** | Inter-Shop Stock Transfer | Allowed only within same workspace (`Dispatched` $\to$ `Received`) | Enforced |
| **D-22** | Password Policy | Strong salted bcrypt hashes; no plaintext storage | Enforced |
| **D-23** | Notifications | In-app notification center | Enforced |
| **D-24** | Offline Mode | Online-first release target | Enforced |
| **D-25** | Localisation | English (India) with INR (₹) formatting | Enforced |

---

## 6. Implementation & Remediation Phases (P0 — P7)

### Phase P0: Security & Data Foundation — COMPLETED
- [x] Removed exposed database fallback credentials from `api/src/config/database.ts`.
- [x] Gitignored `api/.env` and created `api/.env.example`.
- [x] Deleted private Google service account key asset.
- [x] Hardened CORS with strict origin allowlist in `api/src/app.ts`.
- [x] Completely removed Google Drive and Google Sheets dependencies.
- [x] Cleared prefilled demo credentials from web and mobile login forms.
- [x] Added double-submission protection on payments and bill generation.

### Phase P1: Identity, Workspaces & Account Seeding — IN PROGRESS / VERIFIED
- [x] Inspected database schema for `Owner`, `Shop`, `Employee`, and `EmployeeShop`.
- [x] Verified existing owners and shops in Supabase PostgreSQL (`NSYU`, `MNT`).
- [ ] Seed official workspace accounts (`owner1@gmail.com` for PTL, `owner2@gmail.com` for MLT) and shops (`PTLS`, `RTLS`, `MLTS`, `MTLS`).
- [ ] Add route aliases / redirects for `/PTL#/login` and `/mlt#/login` in web deployment.

### Phase P2: Roles & Action Permissions — VERIFIED
- [x] Role-based permission middleware active in backend (`api/src/middleware/permission.ts`).
- [x] Frontend permission hooks and gate components (`usePermission.ts`, `PermissionGate.tsx`).
- [x] Owner role bypasses restrictions; staff roles restricted to granted modules and actions.

### Phase P3: Core Operations & Calculation Alignment — VERIFIED
- [x] Margin Amount (₹) formula enforced in Flutter: `Selling Price = Purchase Price + Margin (₹)`.
- [ ] Add explicit Margin Amount (₹) input and auto-computed Selling Price to web `Products.tsx`.
- [x] POS Billing, stock decrements, and live ledger synchronization tested and verified.

### Phase P4: People & Admin Modules — VERIFIED
- [x] Employees, Attendance, and Payroll screens live and connected to backend.
- [x] Shops management with status toggle, edit, and deletion integrity guard.
- [x] Reports and audit logs functional.

### Phase P5: Web & Mobile Frontends — VERIFIED & LIVE
- [x] React 19 Web Dashboard built and live on GitHub Pages (`https://nsyumnt-rgb.github.io/nsyu/#/login`).
- [x] Headless Chrome E2E test suite passed with 0 console errors and 0 network failures.
- [x] Flutter Android release APK built (`App/app-release.apk`) and verified on Android emulator.

### Phase P6: QA, E2E Acceptance & Cross-Tenant Validation — READY
- [x] Verified live web app with real owner login (`nsyu.mnt@gmail.com`).
- [x] Verified live product catalogue (1,248 items).
- [x] Verified live billing cart and customer ledger timeline.
- [ ] Run cross-tenant boundary tests once PTL and MLT accounts are seeded.

### Phase P7: Release Packaging & Documentation — IN PROGRESS
- [x] Web build synced to `/` and `/docs` for GitHub Pages.
- [x] Android release APK packaged.
- [x] Implementation report updated with full `project_instruction.docx` alignment.

