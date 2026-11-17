/**
 * Tenant isolation test (BRD §27, acceptance Test 10).
 *
 * Owner A creates real records through the API; owner B then calls every
 * ID-based staff route against A's records. Any 2xx response is a leak.
 * Finally A's records are re-read to prove nothing was modified.
 *
 * Fully isolated: in-memory SQLite + throwaway fixtures; never touches the
 * configured database.   npm run test:isolation
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";

// Test-only SQLite shim: production uses PostgreSQL ILIKE; SQLite's LIKE is already
// case-insensitive for ASCII. This changes nothing outside this test process.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Op } = require("sequelize");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operatorsMixin = require("sequelize/lib/dialects/abstract/query-generator/operators");
operatorsMixin.OperatorMap[Op.iLike] = "LIKE";
operatorsMixin.OperatorMap[Op.notILike] = "NOT LIKE";
// A controller error must fail its probe, not crash the whole run.
process.on("unhandledRejection", (e: any) => console.warn("  (handler error)", e?.message || e));

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);
const { sequelize, Owner, Shop, Customer, Product, ProductStock, Category, Notification, Sale, CustomerLedger } = models;

let pass = 0;
const leaks: string[] = [];
const errors: string[] = [];

async function main() {
  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);

  const ownerA = await Owner.create({ name: "Isolation A", email: "iso-a@test.local", password: "x" });
  const ownerB = await Owner.create({ name: "Isolation B", email: "iso-b@test.local", password: "x" });
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Iso Shop A", code: "ISA", status: "active" });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Iso Shop B", code: "ISB", status: "active" });
  const tokA = signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id });
  const tokB = signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, p: string, body: any, tok: string) => {
    const r = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = r.headers.get("content-type") || "";
    return { status: r.status, json: ct.includes("json") ? await r.json().catch(() => null) : null };
  };

  try {
    // ── Owner A's real records ────────────────────────────────────────────
    const category = await Category.create({ owner_id: ownerA.id, name: "Iso Category" });
    const customer = await Customer.create({ owner_id: ownerA.id, name: "Iso Customer", phone: "9000000001", email: "isocust@test.local" });
    const product = await Product.create({ owner_id: ownerA.id, name: "Iso Product", sku: "ISO-1", selling_price: 100, category_id: category.id });
    await ProductStock.create({ owner_id: ownerA.id, shop_id: shopA.id, product_id: product.id, current_stock: 50 });
    const notif = await Notification.create({
      owner_id: ownerA.id, shop_id: shopA.id, recipient_type: "owner", recipient_id: ownerA.id, type: "general", title: "A only", message: "secret",
    });
    const saleRes = await call("POST", "/sales", { customerId: customer.id, items: [{ productId: product.id, quantity: 2, rate: 100 }], paymentMethod: "cash", paidAmount: 50 }, tokA);
    if (saleRes.status >= 300) throw new Error("fixture sale failed: " + JSON.stringify(saleRes.json));
    const sale = saleRes.json.data;
    const ledgerRow = await CustomerLedger.findOne({ where: { customer_id: customer.id, entry_type: "credit" } });
    const paymentId = ledgerRow?.id ?? 999999;

    const before = {
      customer: JSON.stringify((await Customer.findByPk(customer.id)).toJSON()),
      product: JSON.stringify((await Product.findByPk(product.id)).toJSON()),
      sale: JSON.stringify((await Sale.findByPk(sale.id)).toJSON()),
      stock: (await ProductStock.findOne({ where: { product_id: product.id, shop_id: shopA.id } })).current_stock,
      shop: JSON.stringify((await Shop.findByPk(shopA.id)).toJSON()),
      category: JSON.stringify((await Category.findByPk(category.id)).toJSON()),
    };

    // ── Owner B attacks every ID-based route ──────────────────────────────
    const C = customer.id, P = product.id, S = sale.id, CAT = category.id, SH = shopA.id, N = notif.id;
    const probes: Array<[string, string, any?]> = [
      ["GET", `/customers/${C}`],
      ["PUT", `/customers/${C}`, { name: "hacked", password: "hacked123" }],
      ["POST", `/customers/${C}/portal/invite`, {}],
      ["POST", `/customers/${C}/portal/disable`, {}],
      ["POST", `/customers/${C}/portal/enable`, {}],
      ["POST", `/customers/${C}/send-reminder`, {}],
      ["GET", `/products/${P}`],
      ["PUT", `/products/${P}`, { name: "hacked", selling_price: 1 }],
      ["DELETE", `/products/${P}`],
      ["POST", `/products/${P}/location`, { location: "x" }],
      ["GET", `/products/${P}/location/history`],
      ["GET", `/inventory/products/${P}`],
      ["PUT", `/inventory/products/${P}`, { name: "hacked" }],
      ["PATCH", `/inventory/products/${P}/status`, { status: "inactive" }],
      ["GET", `/inventory/stock/${P}`],
      ["GET", `/sales/${S}`],
      ["PUT", `/sales/${S}`, { notes: "hacked" }],
      ["PATCH", `/sales/${S}`, { notes: "hacked" }],
      ["POST", `/sales/${S}/payments`, { amount: 10, method: "cash" }],
      ["POST", `/sales/${S}/cancel`, { reason: "x" }],
      ["POST", `/sales/${S}/returns`, { items: [] }],
      ["GET", `/sales/${S}/bill/pdf`],
      ["GET", `/ledger/customer/${C}`],
      ["GET", `/ledger/${C}`],
      ["POST", `/ledger/${C}/payment`, { amount: 10, paymentMethod: "cash" }],
      ["GET", `/payments/${paymentId}`],
      ["POST", `/payments/${paymentId}/cancel`, {}],
      ["GET", `/payments/${paymentId}/receipt/pdf`],
      ["PUT", `/categories/${CAT}`, { name: "hacked" }],
      ["PATCH", `/categories/${CAT}/status`, { status: "inactive" }],
      ["GET", `/shops/${SH}`],
      ["PUT", `/shops/${SH}`, { name: "hacked" }],
      ["GET", `/shops/${SH}/settings`],
      ["PUT", `/shops/${SH}/settings`, { settings: { x: 1 } }],
      ["GET", `/shops/${SH}/portal-settings`],
      ["PUT", `/shops/${SH}/portal-settings`, { show_stock_qty: true }],
      ["PATCH", `/shops/${SH}/status`, {}],
      ["DELETE", `/shops/${SH}`],
      ["POST", `/shops/switch`, { shopId: SH }],
      ["POST", `/notifications/${N}/read`, {}],
      ["GET", `/roles/shop-modules/${SH}`],
      ["PUT", `/roles/shop-modules/${SH}`, { module_code: "sales", is_enabled: false }],
    ];

    for (const [method, p, body] of probes) {
      try {
        const r = await call(method, p, body, tokB);
        if (r.status >= 200 && r.status < 300) {
          leaks.push(`${method} ${p} → ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
        } else {
          pass++;
        }
      } catch (e: any) {
        errors.push(`${method} ${p} → ${e.message}`);
      }
    }

    // Positive controls: the rightful owner still has access after the ownership checks
    for (const p of [`/roles/shop-modules/${SH}`, `/customers/${C}`, `/sales/${S}`, `/shops/${SH}`]) {
      const r = await call("GET", p, null, tokA);
      if (r.status >= 200 && r.status < 300) pass++;
      else leaks.push(`owner A was DENIED own resource: GET ${p} → ${r.status}`);
    }

    // Owner B's own lists must not contain A's records
    for (const [p, needle] of [["/customers", "Iso Customer"], ["/products", "Iso Product"], ["/sales", sale.invoice_number], ["/notifications", "A only"]] as const) {
      const r = await call("GET", p, null, tokB);
      if (JSON.stringify(r.json ?? "").includes(String(needle))) leaks.push(`GET ${p} (list) exposes owner A's "${needle}"`);
      else pass++;
    }

    // Nothing of A's may have changed
    const after = {
      customer: JSON.stringify((await Customer.findByPk(customer.id)).toJSON()),
      product: JSON.stringify((await Product.findByPk(product.id))?.toJSON() ?? null),
      sale: JSON.stringify((await Sale.findByPk(sale.id)).toJSON()),
      stock: (await ProductStock.findOne({ where: { product_id: product.id, shop_id: shopA.id } })).current_stock,
      shop: JSON.stringify((await Shop.findByPk(shopA.id))?.toJSON() ?? null),
      category: JSON.stringify((await Category.findByPk(category.id)).toJSON()),
    };
    for (const k of Object.keys(before) as (keyof typeof before)[]) {
      if (before[k] !== after[k]) leaks.push(`owner A's ${k} was MODIFIED by owner B`);
      else pass++;
    }
    const notifAfter = await Notification.findByPk(N);
    if (notifAfter?.is_read) leaks.push("owner A's notification was marked read by owner B");
    else pass++;
  } finally {
    server.close();
    await sequelize.close();
  }

  console.log(`\nIsolation checks passed: ${pass}`);
  if (errors.length) console.log(`Probe errors (${errors.length}):\n  ` + errors.join("\n  "));
  if (leaks.length) {
    console.log(`\n❌ LEAKS (${leaks.length}):\n  ` + leaks.join("\n  "));
    process.exit(1);
  }
  console.log("✅ No cross-owner access");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
