/**
 * Staff (employee) accounts — real logins over the HTTP API on an isolated in-memory DB.
 * Owner creates staff, assigns shop + role; staff sign in with email + password; access follows
 * the CURRENT assignment (role change / removal / deactivation take effect immediately).
 *                                                         npm run test:staff
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Op } = require("sequelize");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operatorsMixin = require("sequelize/lib/dialects/abstract/query-generator/operators");
operatorsMixin.OperatorMap[Op.iLike] = "LIKE";
operatorsMixin.OperatorMap[Op.notILike] = "NOT LIKE";
process.on("unhandledRejection", (e: any) => console.warn("  (handler error)", e?.message || e));

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { seedOwnerDefaults } = require(`${API}/utils/seed`);
const { sequelize, Owner, Shop, Role, Product, ProductStock, Customer } = m;

let pass = 0;
const failures: string[] = [];
const ok = (cond: any, label: string, detail?: any) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    failures.push(label + (detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 240)}` : ""));
    console.log("  ✗ " + label);
  }
};

async function main() {
  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);

  const ownerPass = "Owner-Test-Pass-1";
  const ownerA = await Owner.create({ name: "Staff Owner A", email: "staff-owner-a@test.local", password: await bcrypt.hash(ownerPass, 10) });
  const ownerB = await Owner.create({ name: "Staff Owner B", email: "staff-owner-b@test.local", password: await bcrypt.hash(ownerPass, 10) });
  await seedOwnerDefaults(ownerA.id);
  await seedOwnerDefaults(ownerB.id);
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Main Shop", code: "SMA", status: "active" });
  const shopA2 = await Shop.create({ owner_id: ownerA.id, name: "Second Shop", code: "SMA2", status: "active" });
  const shopA3 = await Shop.create({ owner_id: ownerA.id, name: "Third Shop", code: "SMA3", status: "active" });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Other Owner Shop", code: "SMB", status: "active" });
  const role = async (ownerId: number, name: string) => (await Role.findOne({ where: { owner_id: ownerId, name } })).id;
  const salesA = await role(ownerA.id, "Sales Staff");
  const stockA = await role(ownerA.id, "Inventory Staff");
  const managerA = await role(ownerA.id, "Manager");
  const ownerRoleA = await role(ownerA.id, "Owner");
  const salesB = await role(ownerB.id, "Sales Staff");
  const prod = await Product.create({ owner_id: ownerA.id, name: "Staff Test Cable", sku: "ST-1", selling_price: 100, status: "active" });
  await ProductStock.create({ owner_id: ownerA.id, shop_id: shopA.id, product_id: prod.id, current_stock: 50 });
  const cust = await Customer.create({ owner_id: ownerA.id, name: "Staff Test Customer", phone: "9500000001", email: "stc@test.local" });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, p: string, tok: string | null, body?: any) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const r = await fetch(base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* */ }
    return { status: r.status, json, text };
  };
  const login = (email: string, password: string) => call("POST", "/auth/login", null, { email, password });

  try {
    console.log("\nOwner manages staff");
    const la = await login("staff-owner-a@test.local", ownerPass);
    ok(la.status === 200 && la.json.data.accountType === "owner", "owner A signs in", la.text);
    const tokA = la.json.data.accessToken;
    const tokB = (await login("staff-owner-b@test.local", ownerPass)).json.data.accessToken;

    const staffPass = "Staff-Pass-123";
    const c1 = await call("POST", "/employees", tokA, { name: "Riya Sales", email: "Riya@Test.Local", phone: "9600000001", password: staffPass, shopId: shopA.id, roleId: salesA });
    ok(c1.status === 201, "create staff with shop + Sales Staff role", c1.text);
    ok(!/password|\$2[aby]\$/i.test(c1.text), "response never contains the password hash");
    ok(c1.json?.data?.shopAssignments?.[0]?.role?.name === "Sales Staff", "assignment returned with role name");
    const riya = c1.json.data.id;
    ok((await call("POST", "/employees", tokA, { name: "Dup", email: "riya@test.local", password: staffPass })).status === 409, "duplicate email (case-insensitive) refused");
    ok((await call("POST", "/employees", tokA, { name: "Owner clash", email: "staff-owner-b@test.local", password: staffPass })).status === 409, "an owner's email can't be reused for staff");
    ok((await call("POST", "/employees", tokA, { name: "Short", email: "short@test.local", password: "1234567" })).status === 400, "password under 8 chars refused");
    ok((await call("POST", "/employees", tokA, { name: "Bad", email: "bad@test.local", password: staffPass, shopId: shopB.id, roleId: salesA })).status === 400, "cannot assign to another owner's shop");
    ok((await call("POST", "/employees", tokA, { name: "Bad", email: "bad2@test.local", password: staffPass, shopId: shopA.id, roleId: salesB })).status === 400, "cannot use another owner's role");
    ok((await call("POST", "/employees", tokA, { name: "Bad", email: "bad3@test.local", password: staffPass, shopId: shopA.id, roleId: ownerRoleA })).status === 400, "the Owner role cannot be given to staff");
    ok((await call("POST", "/employees", tokA, { name: "Bad", email: "bad4@test.local", password: staffPass, shopId: shopA.id, roleId: await role(ownerA.id, "Super Admin") })).status === 400, "the Super Admin role cannot be given to staff");
    ok((await call("POST", "/employees", tokA, { name: "Bad", email: "bad5@test.local", password: staffPass, shopId: shopA.id, roleId: await role(ownerA.id, "User") })).status === 400, "the customer User role cannot be given to staff");
    const listA = await call("GET", "/employees", tokA);
    ok(listA.status === 200 && listA.json.data.length === 1 && !/\$2[aby]\$/.test(listA.text), "owner lists own staff (no hashes)", listA.json?.data?.length);

    console.log("\nCross-owner protection");
    ok((await call("GET", "/employees", tokB)).json?.data?.length === 0, "owner B sees none of A's staff");
    ok((await call("GET", `/employees/${riya}`, tokB)).status === 404, "owner B can't read A's staff member");
    ok((await call("PATCH", `/employees/${riya}/status`, tokB, { status: "inactive" })).status === 404, "owner B can't deactivate A's staff");
    ok((await call("PATCH", `/employees/${riya}/password`, tokB, { password: "Hijack-Pass-1" })).status === 404, "owner B can't reset A's staff password");
    ok((await call("POST", "/employees/assign-shop", tokB, { employeeId: riya, shopId: shopB.id, roleId: salesB })).status === 404, "owner B can't pull A's staff into B's shop");

    console.log("\nStaff sign-in (single shop)");
    ok((await login("riya@test.local", "wrong-password")).status === 401, "wrong password refused");
    const lr = await login("RIYA@test.local", staffPass);
    ok(lr.status === 200 && lr.json.data.accountType === "employee", "staff signs in (email case-insensitive)", lr.text);
    ok(lr.json?.data?.shop?.id === shopA.id && lr.json?.data?.roleName === "Sales Staff", "lands directly in the only assigned shop");
    let tokR = lr.json.data.accessToken;
    const refreshR = lr.json.data.refreshToken;
    const me = await call("GET", "/auth/me", tokR);
    ok(me.status === 200 && me.json.data.accountType === "employee" && me.json.data.roleName === "Sales Staff", "/auth/me returns employee + role", me.text);
    ok(me.json?.data?.permissions?.sales?.can_view === true && me.json?.data?.permissions?.reports?.can_view === false, "permission grid matches Sales Staff");
    ok((await call("GET", "/products", tokR)).status === 200, "staff can view products");
    ok((await call("POST", "/sales", tokR, { customerId: cust.id, items: [{ productId: prod.id, quantity: 1, rate: 100 }], paymentMethod: "cash", paidAmount: 100 })).status === 201, "staff can bill a customer");
    ok((await call("GET", "/reports/sales", tokR)).status === 403, "staff blocked from reports");
    ok((await call("GET", "/backup", tokR)).status === 403, "staff blocked from backup export");
    ok((await call("POST", "/employees", tokR, { name: "x", email: "x@test.local", password: staffPass })).status === 403, "staff cannot create staff");
    ok((await call("POST", "/roles", tokR, { name: "Escalate" })).status === 403, "staff cannot create roles");
    ok((await call("GET", "/admin/dashboard", tokR)).status === 403, "staff blocked from super admin");
    ok([401, 403].includes((await call("GET", "/customer-portal/cart", tokR)).status), "staff token rejected on customer portal");
    ok((await call("POST", "/shops/switch", tokR, { shopId: shopA2.id })).status === 404, "can't switch into an unassigned shop");
    ok((await call("POST", "/shops/switch", tokR, { shopId: shopB.id })).status === 404, "can't switch into another owner's shop");

    console.log("\nChanges apply to the existing token immediately");
    ok((await call("POST", "/employees/assign-shop", tokA, { employeeId: riya, shopId: shopA.id, roleId: stockA })).status === 200, "owner changes role to Inventory Staff");
    ok((await call("GET", "/sales", tokR)).status === 403, "old token loses sales access at once");
    ok((await call("GET", "/suppliers", tokR)).status === 200, "old token gains supplier access at once");

    console.log("\nMulti-shop staff");
    ok((await call("POST", "/employees/assign-shop", tokA, { employeeId: riya, shopId: shopA2.id, roleId: managerA })).status === 200, "assign a second shop as Manager");
    const lr2 = await login("riya@test.local", staffPass);
    ok(lr2.status === 200 && lr2.json.data.shop === null && lr2.json.data.assignedShopIds.length === 2, "two shops → picker (no shop pre-selected)", lr2.json?.data);
    tokR = lr2.json.data.accessToken;
    const shops = await call("GET", "/shops", tokR);
    ok(shops.status === 200 && shops.json.data.length === 2 && shops.json.data.every((s: any) => s.roleName), "shop list shows only assigned shops with role", shops.json?.data?.map((s: any) => s.code));
    ok(!shops.json.data.some((s: any) => s.id === shopA3.id), "unassigned shop not listed");
    const sw = await call("POST", "/shops/switch", tokR, { shopId: shopA2.id });
    ok(sw.status === 200, "switch to second shop", sw.text);
    const tokMgr = sw.json.data.accessToken;
    ok((await call("GET", "/reports/sales", tokMgr)).status === 200, "Manager role applies in second shop (reports allowed)");
    ok((await call("GET", "/products", tokR)).status === 400, "no shop selected → shop routes ask to choose a shop");

    console.log("\nRemoval, deactivation, password reset");
    ok((await call("POST", "/employees/remove-shop", tokA, { employeeId: riya, shopId: shopA2.id })).status === 200, "owner removes second shop");
    ok((await call("GET", "/products", tokMgr)).status === 401, "token for removed shop stops working");
    ok((await call("PATCH", `/employees/${riya}/status`, tokA, { status: "inactive" })).status === 200, "owner deactivates staff");
    ok((await login("riya@test.local", staffPass)).status === 403, "inactive staff can't sign in");
    ok((await call("POST", "/auth/refresh", null, { refreshToken: refreshR })).status === 401, "inactive staff refresh token refused");
    ok((await call("PATCH", `/employees/${riya}/status`, tokA, { status: "active" })).status === 200, "owner re-activates staff");
    ok((await call("PATCH", `/employees/${riya}/password`, tokA, { password: "New-Staff-Pass-9" })).status === 200, "owner resets password");
    ok((await login("riya@test.local", staffPass)).status === 401, "old password no longer works");
    ok((await login("riya@test.local", "New-Staff-Pass-9")).status === 200, "new password works");

    const unassigned = await call("POST", "/employees", tokA, { name: "No Shop", email: "noshop@test.local", password: staffPass });
    ok(unassigned.status === 201, "staff can exist without a shop");
    ok((await login("noshop@test.local", staffPass)).status === 403, "staff with no shop can't sign in (clear message)");

    const adminDash = await Owner.count();
    ok(adminDash >= 2, "fixtures intact");
  } catch (e: any) {
    failures.push("RUN ERROR: " + (e?.stack || e));
  } finally {
    server.close();
  }

  console.log("");
  for (const f of failures) console.log("  ✗ " + f);
  console.log(`\n${pass} passed, ${failures.length} failed`);
  await sequelize.close();
  process.exit(failures.length ? 1 : 0);
}

main();
