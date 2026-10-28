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
2. Sales + Billing + Customers + Customer Ledger
3. Payments + EMI/Installments
4. Employees → Attendance → Payroll
5. Reports (per-shop + consolidated all-shop)
6. Frontend: Next.js dashboard consuming this API (sidebar/topbar per your spec), Flutter mobile app
