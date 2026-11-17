/**
 * Role & permission matrix test (positive + negative) for every implemented role:
 * anonymous, Super Admin, Owner (two tenants), Manager / Sales Staff / Inventory Staff
 * (role-permission tokens), and portal Customers (two at one shop, one at another).
 *
 * Each probe states the expected outcome. A probe "passes" only when the real API,
 * running on an isolated in-memory SQLite database, returns that outcome.
 * Never touches the configured database.        npm run test:roles
 *
 * Note: there is no employee/supplier login in the product yet, so staff roles are
 * exercised with signed tokens carrying their role — this verifies the backend
 * authorization layer, not a login screen.
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Op } = require("sequelize");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operatorsMixin = require("sequelize/lib/dialects/abstract/query-generator/operators");
operatorsMixin.OperatorMap[Op.iLike] = "LIKE";
operatorsMixin.OperatorMap[Op.notILike] = "NOT LIKE";
process.on("unhandledRejection", (e: any) => console.warn("  (handler error)", e?.message || e));

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);
const { seedOwnerDefaults } = require(`${API}/utils/seed`);
const { sequelize, Owner, Shop, Customer, CustomerAccount, Product, ProductStock, Category, Role, ShopPortalSettings } = models;

type Expect = "ok" | "deny" | "unauth" | "notfound-or-deny" | ((r: Res) => boolean | string);
type Res = { status: number; json: any; text: string };

let pass = 0;
const failures: string[] = [];
const matrix: Record<string, Record<string, string>> = {};

async function main() {
  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);

  // ── Fixtures ────────────────────────────────────────────────────────────
  const admin = await Owner.create({ name: "Platform Admin", email: "admin@test.local", password: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhash", is_super_admin: true, role: "super_admin" });
  const ownerA = await Owner.create({ name: "Owner A", email: "owner-a@test.local", password: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashA" });
  const ownerB = await Owner.create({ name: "Owner B", email: "owner-b@test.local", password: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashB" });
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Shop A", code: "RMA", status: "active" });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Shop B", code: "RMB", status: "active" });
  for (const s of [shopA, shopB]) await ShopPortalSettings.create({ shop_id: s.id, allow_orders: true, allow_self_registration: true });
  await seedOwnerDefaults(ownerA.id);
  await seedOwnerDefaults(ownerB.id);
  const roleId = async (ownerId: number, name: string) => (await Role.findOne({ where: { owner_id: ownerId, name } })).id;

  const catA = await Category.create({ owner_id: ownerA.id, name: "Cables" });
  const prodA = await Product.create({ owner_id: ownerA.id, name: "Cable A", sku: "RM-A1", selling_price: 100, purchase_price: 60, mrp: 150, category_id: catA.id, status: "active" });
  const prodB = await Product.create({ owner_id: ownerB.id, name: "Cable B", sku: "RM-B1", selling_price: 90, purchase_price: 50, status: "active" });
  await ProductStock.create({ owner_id: ownerA.id, shop_id: shopA.id, product_id: prodA.id, current_stock: 100 });
  await ProductStock.create({ owner_id: ownerB.id, shop_id: shopB.id, product_id: prodB.id, current_stock: 100 });

  const mkCustomer = async (ownerId: number, shopId: number, name: string, phone: string) => {
    const c = await Customer.create({ owner_id: ownerId, name, phone, email: `${phone}@test.local` });
    const acc = await CustomerAccount.create({ customer_id: c.id, shop_id: shopId, owner_id: ownerId, phone, email: `${phone}@test.local`, status: "active" });
    const tok = signAccessToken({ ownerId, isOwner: false, isCustomer: true, customerId: c.id, accountId: Number(acc.id), shopId });
    return { c, acc, tok };
  };
  const custA1 = await mkCustomer(ownerA.id, shopA.id, "Cust A1", "9100000001");
  const custA2 = await mkCustomer(ownerA.id, shopA.id, "Cust A2", "9100000002");
  const custB1 = await mkCustomer(ownerB.id, shopB.id, "Cust B1", "9100000003");

  const T = {
    anon: "",
    forged: signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id }).slice(0, -3) + "abc",
    admin: signAccessToken({ ownerId: admin.id, isOwner: true, isSuperAdmin: true, roleName: "super_admin", shopId: null, roleId: null }),
    ownerA: signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id }),
    ownerB: signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id }),
    manager: signAccessToken({ ownerId: ownerA.id, isOwner: false, employeeId: 9001, shopId: shopA.id, roleId: await roleId(ownerA.id, "Manager") }),
    sales: signAccessToken({ ownerId: ownerA.id, isOwner: false, employeeId: 9002, shopId: shopA.id, roleId: await roleId(ownerA.id, "Sales Staff") }),
    stock: signAccessToken({ ownerId: ownerA.id, isOwner: false, employeeId: 9003, shopId: shopA.id, roleId: await roleId(ownerA.id, "Inventory Staff") }),
    // A role named like the platform role must not grant platform access.
    fakeAdminRole: signAccessToken({ ownerId: ownerA.id, isOwner: false, employeeId: 9004, shopId: shopA.id, roleId: await roleId(ownerA.id, "Sales Staff"), roleName: "Super Admin", roleCode: "super_admin" }),
    custA1: custA1.tok,
    custA2: custA2.tok,
    custB1: custB1.tok,
  };

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, p: string, tok: string, body?: any): Promise<Res> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const r = await fetch(base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json, text };
  };

  const check = async (role: keyof typeof T, label: string, method: string, p: string, expect: Expect, body?: any) => {
    const r = await call(method, p, T[role], body);
    let ok: boolean;
    let why = "";
    if (expect === "ok") ok = r.status >= 200 && r.status < 300;
    else if (expect === "deny") ok = r.status === 403;
    else if (expect === "unauth") ok = r.status === 401;
    else if (expect === "notfound-or-deny") ok = r.status === 403 || r.status === 404;
    else {
      const v = expect(r);
      ok = v === true;
      if (typeof v === "string") why = v;
    }
    (matrix[label] ||= {})[role] = `${r.status}${ok ? "" : " ✗"}`;
    if (ok) pass++;
    else failures.push(`${role.padEnd(13)} ${label} → ${r.status} ${why || (r.json?.message ?? r.text.slice(0, 120))}`);
    return r;
  };

  const noSecret = (field: RegExp) => (r: Res) =>
    r.status >= 200 && r.status < 300 ? (field.test(r.text) ? `response exposes ${field}` : true) : `status ${r.status}`;

  try {
    // ── Fixtures that need the API: A2 order + A2 bill + A1 bill ─────────
    await call("PUT", `/customer-portal/cart/items/${prodA.id}`, T.custA2, { quantity: 1 });
    const orderA2 = await call("POST", "/customer-portal/orders", T.custA2, { clientRequestId: "rm-order-a2-0001", deliveryType: "pickup" });
    if (orderA2.status >= 300) throw new Error("fixture order failed: " + orderA2.text);
    const billA2 = await call("POST", "/sales", T.ownerA, { customerId: custA2.c.id, items: [{ productId: prodA.id, quantity: 1, rate: 100 }], paymentMethod: "cash", paidAmount: 0 });
    if (billA2.status >= 300) throw new Error("fixture bill failed: " + billA2.text);
    const orderId = orderA2.json.data.id ?? orderA2.json.data.order?.id;
    const billId = billA2.json.data.id;

    // ── Anonymous & forged tokens ───────────────────────────────────────
    for (const [m, p] of [["GET", "/shops"], ["GET", "/products"], ["GET", "/customers"], ["GET", "/admin/dashboard"], ["GET", "/customer-portal/cart"], ["GET", "/reports/sales"]] as const) {
      await check("anon", `${m} ${p}`, m, p, "unauth");
      await check("forged", `${m} ${p}`, m, p, "unauth");
    }

    // ── Super Admin ─────────────────────────────────────────────────────
    await check("admin", "GET /admin/dashboard", "GET", "/admin/dashboard", "ok");
    await check("admin", "GET /admin/shops", "GET", "/admin/shops", "ok");
    await check("admin", "GET /admin/owners (no password hashes)", "GET", "/admin/owners", noSecret(/\$2[aby]\$|"password"\s*:/));
    await check("admin", "GET /admin/audit-logs", "GET", "/admin/audit-logs", "ok");
    await check("admin", "PATCH /admin/shops/:B suspend", "PATCH", `/admin/shops/${shopB.id}/status`, "ok", { status: "suspended" });
    await check("ownerB", "suspended shop blocks staff API", "GET", "/products", "deny");
    await check("custB1", "suspended shop blocks customer portal", "GET", "/customer-portal/cart", (r) => r.status === 401 || r.status === 403);
    await check("admin", "PATCH /admin/shops/:B reactivate", "PATCH", `/admin/shops/${shopB.id}/status`, "ok", { status: "active" });
    await check("ownerB", "reactivated shop works again", "GET", "/products", "ok");
    await check("admin", "super admin cannot use customer portal", "GET", "/customer-portal/cart", (r) => r.status === 401 || r.status === 403);

    // ── Platform functions are Super Admin only ─────────────────────────
    for (const role of ["ownerA", "manager", "sales", "stock", "fakeAdminRole", "custA1"] as const) {
      await check(role, "GET /admin/dashboard", "GET", "/admin/dashboard", (r) => r.status === 401 || r.status === 403);
      await check(role, "POST /admin/shops", "POST", "/admin/shops", (r) => r.status === 401 || r.status === 403, { name: "Hijack", ownerId: ownerA.id });
      await check(role, "PATCH /admin/shops/:A status", "PATCH", `/admin/shops/${shopA.id}/status`, (r) => r.status === 401 || r.status === 403, { status: "suspended" });
    }

    // ── Owner A: full access to own shop ────────────────────────────────
    await check("ownerA", "GET /products", "GET", "/products", "ok");
    await check("ownerA", "POST /customers", "POST", "/customers", "ok", { name: "Walk-in", phone: "9200000001", address: "Main Road", email: "walkin@test.local", password: "Test@12345" });
    await check("ownerA", "GET /reports/sales", "GET", "/reports/sales", "ok");
    await check("ownerA", "GET /ledger/outstanding", "GET", "/ledger/outstanding", "ok");
    await check("ownerA", "GET /orders", "GET", "/orders", "ok");
    await check("ownerA", "POST /roles (custom role)", "POST", "/roles", "ok", { name: "Delivery" });
    await check("ownerA", "GET /backup (own data)", "GET", "/backup", "ok");
    await check("ownerA", "GET /suppliers", "GET", "/suppliers", "ok");

    // ── Owner B attacking Owner A (cross-tenant) ────────────────────────
    await check("ownerB", "GET /customers/:A", "GET", `/customers/${custA1.c.id}`, "notfound-or-deny");
    await check("ownerB", "GET /ledger/:A-customer", "GET", `/ledger/${custA2.c.id}`, "notfound-or-deny");
    await check("ownerB", "GET /sales/:A-bill", "GET", `/sales/${billId}`, "notfound-or-deny");
    await check("ownerB", "GET /orders/:A-order", "GET", `/orders/${orderId}`, "notfound-or-deny");
    await check("ownerB", "PUT /products/:A", "PUT", `/products/${prodA.id}`, "notfound-or-deny", { selling_price: 1 });
    await check("ownerB", "POST /shops/switch → shop A", "POST", "/shops/switch", "notfound-or-deny", { shopId: shopA.id });
    await check("ownerB", "PUT /shops/:A", "PUT", `/shops/${shopA.id}`, "notfound-or-deny", { name: "pwned" });
    await check("ownerB", "GET /roles/shop-modules/:A", "GET", `/roles/shop-modules/${shopA.id}`, "notfound-or-deny");
    await check("ownerB", "GET /reports/sales sees no A bills", "GET", "/reports/sales", (r) => (r.status === 200 ? (JSON.stringify(r.json).includes(String(billA2.json.data.bill_number || billA2.json.data.billNumber || "@@none@@")) ? "leaks shop A bill" : true) : `status ${r.status}`));

    // ── Manager (all modules, no owner-only actions, no delete) ─────────
    await check("manager", "GET /products", "GET", "/products", "ok");
    await check("manager", "POST /customers", "POST", "/customers", "ok", { name: "Mgr customer", phone: "9200000002", address: "Main Road", email: "mgr@test.local", password: "Test@12345" });
    await check("manager", "GET /reports/sales", "GET", "/reports/sales", "ok");
    await check("manager", "GET /ledger/outstanding", "GET", "/ledger/outstanding", "ok");
    await check("manager", "GET /orders", "GET", "/orders", "ok");
    await check("manager", "GET /suppliers", "GET", "/suppliers", "ok");
    await check("manager", "DELETE /products/:id (delete off)", "DELETE", `/products/${prodA.id}`, "deny");
    await check("manager", "POST /roles (owner only)", "POST", "/roles", "deny", { name: "Escalate" });
    await check("manager", "PUT /roles/:id/permissions (owner only)", "PUT", `/roles/${await roleId(ownerA.id, "Sales Staff")}/permissions`, "deny", { permissions: [] });
    await check("manager", "POST /shops (owner only)", "POST", "/shops", "deny", { name: "Side shop" });
    await check("manager", "PUT /shops/:A/settings (owner only)", "PUT", `/shops/${shopA.id}/settings`, "deny", { settings: {} });
    await check("manager", "POST /backup/restore (owner only)", "POST", "/backup/restore", "deny", {});
    await check("manager", "GET /backup (owner only)", "GET", "/backup", "deny");
    await check("manager", "switch to Owner B shop", "POST", "/shops/switch", "notfound-or-deny", { shopId: shopB.id });

    // ── Sales Staff (dashboard, sales, billing, customers, payments, products) ──
    await check("sales", "GET /products (no purchase price)", "GET", "/products", noSecret(/purchase_?[pP]rice"\s*:\s*[1-9]/));
    await check("sales", "POST /customers", "POST", "/customers", "ok", { name: "Staff customer", phone: "9200000003", address: "Main Road", email: "staffc@test.local", password: "Test@12345" });
    await check("sales", "POST /sales (billing)", "POST", "/sales", "ok", { customerId: custA1.c.id, items: [{ productId: prodA.id, quantity: 1, rate: 100 }], paymentMethod: "cash", paidAmount: 100 });
    await check("sales", "GET /reports/sales (no reports)", "GET", "/reports/sales", "deny");
    await check("sales", "GET /suppliers (no suppliers)", "GET", "/suppliers", "deny");
    await check("sales", "POST /purchases (no purchase)", "POST", "/purchases", "deny", { supplierId: 1, items: [] });
    await check("sales", "POST /inventory/movement (no inventory)", "POST", "/inventory/movement", "deny", { productId: prodA.id, type: "in", quantity: 5 });
    await check("sales", "GET /ledger/outstanding (no ledger)", "GET", "/ledger/outstanding", "deny");
    await check("sales", "POST /roles (owner only)", "POST", "/roles", "deny", { name: "Escalate" });
    await check("sales", "GET /backup (owner only)", "GET", "/backup", "deny");
    await check("fakeAdminRole", "role *named* Super Admin gets no admin bypass", "GET", "/reports/sales", "deny");

    // ── Inventory Staff (products, inventory, purchase, suppliers) ──────
    await check("stock", "GET /suppliers", "GET", "/suppliers", "ok");
    await check("stock", "GET /inventory/history", "GET", "/inventory/history", "ok");
    await check("stock", "GET /sales (no sales)", "GET", "/sales", "deny");
    await check("stock", "GET /customers (no customers)", "GET", "/customers", "deny");
    await check("stock", "GET /ledger/outstanding (no ledger)", "GET", "/ledger/outstanding", "deny");

    // ── Customers: own data only ────────────────────────────────────────
    await check("custA1", "GET own ledger", "GET", "/customer-portal/ledger", "ok");
    await check("custA1", "GET own bills", "GET", "/customer-portal/bills", (r) => (r.status === 200 ? (JSON.stringify(r.json).includes(`"id":${billId},`) ? "sees A2's bill in list" : true) : `status ${r.status}`));
    await check("custA1", "GET A2's order by id", "GET", `/customer-portal/orders/${orderId}`, "notfound-or-deny");
    await check("custA1", "GET A2's bill by id", "GET", `/customer-portal/bills/${billId}`, "notfound-or-deny");
    await check("custA1", "cancel A2's order", "POST", `/customer-portal/orders/${orderId}/cancel`, "notfound-or-deny");
    await check("custA2", "GET own order by id", "GET", `/customer-portal/orders/${orderId}`, "ok");
    await check("custA2", "GET own bill by id", "GET", `/customer-portal/bills/${billId}`, "ok");
    await check("custB1", "GET shop A order by id", "GET", `/customer-portal/orders/${orderId}`, "notfound-or-deny");
    await check("custA1", "catalog hides purchase price", "GET", "/customer-portal/catalog/products", noSecret(/purchase_?[pP]rice/));
    await check("custA1", "profile hides password hash", "GET", "/customer-portal/me", noSecret(/\$2[aby]\$|password_hash/));
    await check("custA1", "staff API: GET /customers", "GET", "/customers", "deny");
    await check("custA1", "staff API: GET /orders", "GET", "/orders", "deny");
    await check("custA1", "staff API: GET /ledger/:self", "GET", `/ledger/${custA1.c.id}`, "deny");
    await check("ownerA", "owner token on customer portal", "GET", "/customer-portal/cart", (r) => r.status === 401 || r.status === 403);
    await check("sales", "staff token on customer portal", "GET", "/customer-portal/ledger", (r) => r.status === 401 || r.status === 403);

    // ── Public marketplace never leaks private fields ───────────────────
    await check("anon", "public product list hides cost & stock owner data", "GET", "/marketplace/products", noSecret(/purchase_?[pP]rice|owner_id|password/));
  } catch (e: any) {
    failures.push("FIXTURE/RUN ERROR: " + (e?.message || e));
  } finally {
    server.close();
  }

  // ── Report ────────────────────────────────────────────────────────────
  const roles = Object.keys(T);
  console.log("\nPermission matrix (HTTP status per role; ✗ = unexpected)\n");
  for (const [label, row] of Object.entries(matrix)) {
    const cells = roles.filter((r) => row[r]).map((r) => `${r}=${row[r]}`);
    console.log(`  ${label.padEnd(52)} ${cells.join("  ")}`);
  }
  console.log("");
  for (const f of failures) console.log("  ✗ " + f);
  console.log(`\n${pass} passed, ${failures.length} failed`);
  await sequelize.close();
  process.exit(failures.length ? 1 : 0);
}

main();
