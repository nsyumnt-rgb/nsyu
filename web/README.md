# NSYU Business — Frontend (Core Architecture reference)

React + Vite + TypeScript + Tailwind SPA that consumes the `nsyu-backend-foundation` API.
Stack choice: a client-only SPA is the natural fit for a REST API dashboard — no
server-rendering is needed here, so Vite keeps the loop fast.

## What's built

- **Auth**: unified owner/employee login, owner registration, JWT access+refresh
  with automatic silent refresh on 401 (`src/api/client.ts`).
- **Shop switching**: top-bar shop switcher re-issues a shop-scoped access token via
  `/api/shops/switch`, exactly mirroring the backend's design. Employees without
  a shop selected are routed to `/select-shop` first.
- **Permission-aware UI**: `GET /api/auth/me` (new, additive endpoint — see below)
  resolves the current actor's full module grid + sensitive-field grid once per
  session. The sidebar, action buttons, and table columns all read from this —
  see `src/hooks/usePermission.ts`, `src/components/PermissionGate.tsx`, and
  `src/components/RequireModule.tsx`.
  **This is a UX convenience only.** The API re-checks every permission
  server-side (`requirePermission` middleware) and strips sensitive fields
  server-side (`getAllowedFields` / `stripFields`) regardless of what this
  frontend does — hiding a button here grants nothing by itself.
- **Shops** — create/list (owner-only create).
- **Employees** — create, and assign a *different role per shop* via
  `/api/employees/assign-shop`.
- **Roles & Permissions** — full editor for the module (view/create/edit/delete)
  grid and the sensitive-field grid (`purchase_price`, `selling_price`, `profit`,
  `supplier`, `customer_outstanding`, `emi`, `salary`).
- **Products** — the fully-wired reference module: CRUD, scoped to the active
  shop, `purchase_price`/`profit` columns hide themselves per the signed-in
  role's field permissions (driven by data the API already redacts).
- **Scaffolded pages** for every module the backend hasn't built yet (Inventory,
  Purchase, Sales, Billing, Customers, Suppliers, Payments, Ledger, EMI,
  Attendance, Payroll, Reports) — routed, sidebar-linked, and permission-gated,
  so wiring each one up later is additive, not structural.

## One backend addition (additive, non-breaking)

`GET /api/auth/me` was added to `authController.ts` / `authRoutes.ts`. The
original API had no way for a client to ask "who am I and what can I do right
now" without re-deriving it from the JWT + a fresh DB query — this endpoint
does exactly that and nothing else. No existing route, model, or controller
was changed. Verified with `npx tsc --noEmit` (0 errors) both before and after.

## Setup

```bash
cp .env.example .env      # points at the backend, defaults to http://localhost:5000/api
npm install
npm run dev                # http://localhost:5173
```

Run the backend first (`cd ../nsyu-backend-foundation && npm run dev`), then
register an owner from `/register`.

## Project structure

```
src/
  api/          axios calls per resource (auth, shops, employees, roles, products)
  store/        authStore.ts — zustand store: tokens, resolved identity, permission grid
  hooks/        usePermission.ts
  components/   RequireAuth, RequireModule, PermissionGate — the three guard layers
  layouts/      Sidebar (permission-filtered), Topbar (shop switcher), DashboardLayout
  pages/        one page per module + Login/Register/SelectShop
  types/        mirrors src/config/permissions.ts on the backend exactly
```

## Replicating the pattern for the next module (e.g. Inventory)

1. Once the backend adds `inventoryController.ts` + `inventoryRoutes.ts`
   (following its own README), add `src/api/inventory.ts` mirroring
   `src/api/products.ts`.
2. Copy `src/pages/Products.tsx` → `src/pages/Inventory.tsx`, swap the fields.
3. In `App.tsx`, replace the `ModuleScaffold` route for `inventory` with the
   real page.

That's the whole loop — sidebar, routing, guards, and permission grid don't
change, because they were built against the module list, not against which
modules exist yet.
