/**
 * Phase A (Suppliers, Purchases, Supplier Ledger) end-to-end test.
 *
 * Runs fully isolated: in-memory SQLite, throwaway fixtures created and
 * destroyed in this process, real HTTP calls through the Express app.
 * It never connects to the configured production database.
 *
 *   npm run test:phase-a
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

import path from "path";
const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);

const { sequelize, Owner, Shop, Product, ProductStock, Supplier, SupplierLedger, Purchase } = models;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
  }
}
const near = (a: any, b: number) => Math.abs(Number(a) - b) < 0.006;

async function main() {
  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);

  const ownerA = await Owner.create({ name: "Test Owner A", email: "a@test.local", password: "x" });
  const ownerB = await Owner.create({ name: "Test Owner B", email: "b@test.local", password: "x" });
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Test Shop A", code: "TA", status: "active" });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Test Shop B", code: "TB", status: "active" });
  const prod = await Product.create({ owner_id: ownerA.id, name: "Test Cable", sku: "T-CABLE" });

  const tokA = signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id });
  const tokB = signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, path: string, body?: any, tok = tokA) => {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = r.headers.get("content-type") || "";
    return { status: r.status, json: ct.includes("json") ? await r.json() : null, ct };
  };
  const stock = async () => Number((await ProductStock.findOne({ where: { product_id: prod.id, shop_id: shopA.id } }))?.current_stock ?? 0);
  const supBal = async (id: number) => Number((await Supplier.findByPk(id)).current_balance);

  try {
    console.log("Suppliers");
    let r = await call("POST", "/suppliers", { name: "Acme Traders", phone: "+91 98123 45678", email: "Acme@Test.local", openingBalance: 500 });
    check("create supplier → 201", r.status === 201, r.json);
    const sup = r.json.data;
    check("phone normalized, email lowercased", sup.phone === "9812345678" && sup.email === "acme@test.local", sup);
    check("opening balance posted via ledger (500)", near(sup.current_balance, 500), sup);
    r = await call("POST", "/suppliers", { name: "Dup", phone: "9812345678" });
    check("duplicate phone rejected → 409", r.status === 409, r.json);
    r = await call("GET", "/suppliers");
    check("list suppliers", r.status === 200 && r.json.data.length === 1);

    console.log("Purchases");
    r = await call("POST", "/purchases", {
      supplierId: sup.id, items: [{ productId: prod.id, quantity: 10, rate: 100 }], initialPaid: 300, paymentMethod: "bank", clientRequestId: "req-1",
    });
    check("create purchase → 201", r.status === 201, r.json);
    const p1 = r.json.data;
    check("total 1000 / paid 300 / due 700", near(p1.total_amount, 1000) && near(p1.paid_amount, 300) && near(p1.due_amount, 700), p1);
    check("status partially_paid", p1.status === "partially_paid", p1.status);
    check("number format PUR000001", p1.purchase_number === "PUR000001", p1.purchase_number);
    check("'bank' normalized to bank_transfer", p1.payment_method === "bank_transfer", p1.payment_method);
    check("payments[] derived from ledger", p1.payments?.length === 1 && near(p1.payments[0].amount, 300), p1.payments);
    check("stock-in +10", (await stock()) === 10);
    check("supplier payable 500+1000−300 = 1200", near(await supBal(sup.id), 1200));

    r = await call("POST", "/purchases", {
      supplierId: sup.id, items: [{ productId: prod.id, quantity: 10, rate: 100 }], initialPaid: 300, clientRequestId: "req-1",
    });
    check("idempotent retry returns same bill", r.json?.idempotent === true && r.json.data.id === p1.id, r.json);
    check("idempotent retry did not double stock", (await stock()) === 10);

    r = await call("POST", "/purchases", { supplierId: sup.id, items: [{ productId: prod.id, quantity: 1, rate: 50 }], initialPaid: 60 });
    check("overpaying a new bill rejected → 400", r.status === 400, r.json);
    check("failed bill wrote nothing (stock unchanged)", (await stock()) === 10);

    console.log("Payments");
    r = await call("POST", `/purchases/${p1.id}/payment`, { amount: 200, method: "upi", transactionId: "UTR123" });
    check("record payment → 201", r.status === 201, r.json);
    r = await call("POST", `/purchases/${p1.id}/payment`, { amount: 600, method: "cash" });
    check("overpayment rejected → 400", r.status === 400, r.json);
    r = await call("GET", `/purchases/${p1.id}`);
    check("due now 500, paid 500", near(r.json.data.due_amount, 500) && near(r.json.data.paid_amount, 500), r.json.data);
    check("payable 1000", near(await supBal(sup.id), 1000));

    console.log("Returns & cancel");
    const lineId = r.json.data.items[0].id;
    r = await call("POST", `/purchases/${p1.id}/return`, { items: [{ purchaseItemId: lineId, quantity: 2 }], reason: "Damaged" });
    check("return 2 units → 201, value 200", r.status === 201 && near(r.json.data.returnValue, 200), r.json);
    check("stock 8 after return", (await stock()) === 8);
    r = await call("GET", `/purchases/${p1.id}`);
    check("status partially_returned, due 300", r.json.data.status === "partially_returned" && near(r.json.data.due_amount, 300), r.json.data);
    check("payable 800", near(await supBal(sup.id), 800));
    r = await call("POST", `/purchases/${p1.id}/return`, { items: [{ purchaseItemId: lineId, quantity: 9 }] });
    check("returning more than remaining rejected", r.status === 400, r.json);
    r = await call("POST", `/purchases/${p1.id}/cancel`, { reason: "x" });
    check("cancel blocked once paid", r.status === 400, r.json);

    r = await call("POST", "/purchases", { supplierId: sup.id, items: [{ productId: prod.id, quantity: 3, rate: 40 }] });
    const p2 = r.json.data;
    check("unpaid bill → status unpaid, PUR000002", p2.status === "unpaid" && p2.purchase_number === "PUR000002", p2);
    check("payable 920", near(await supBal(sup.id), 920));
    r = await call("POST", `/purchases/${p2.id}/cancel`, { reason: "Wrong supplier" });
    check("cancel unpaid bill → cancelled", r.status === 200 && r.json.data.status === "cancelled", r.json);
    check("stock back to 8", (await stock()) === 8);
    check("payable back to 800", near(await supBal(sup.id), 800));
    r = await call("POST", `/purchases/${p2.id}/payment`, { amount: 10 });
    check("no payment on cancelled bill", r.status === 400, r.json);

    console.log("Ledger reconciliation");
    const rows = await SupplierLedger.findAll({ where: { supplier_id: sup.id }, order: [["id", "ASC"]] });
    let run = 0;
    let ok = true;
    for (const e of rows) {
      // Legacy convention: credit raises the payable, debit lowers it.
      run = Math.round((run + (e.entry_type === "credit" ? 1 : -1) * Number(e.amount)) * 100) / 100;
      if (!near(e.running_balance, run)) ok = false;
    }
    check("every running_balance equals replayed balance (credit +, debit −)", ok);
    check("last running_balance == Supplier.current_balance", near(rows[rows.length - 1].running_balance, await supBal(sup.id)));
    check("purchase posted as credit, payment as debit (legacy convention)",
      rows.some((e: any) => e.reference_type === "Purchase" && e.entry_type === "credit") &&
      rows.some((e: any) => e.reference_type === "SupplierPayment" && e.entry_type === "debit"));
    r = await call("GET", `/supplier-ledger/${sup.id}`);
    check("statement credit−debit == balance", near(r.json.data.totalCredit - r.json.data.totalDebit, r.json.data.balance), r.json.data);
    check("entries expose balance_after for the web page", r.json.data.entries.every((e: any) => e.balance_after !== undefined && near(e.balance_after, e.running_balance)));
    r = await call("GET", "/supplier-ledger/payments");
    check("supplier payments list: 2 payments (300 + 200)", r.json.data.length === 2, r.json.data);
    r = await call("GET", "/supplier-ledger/outstanding");
    check("outstanding lists supplier", r.json.data.length === 1);
    r = await call("GET", "/reports/supplier-outstanding");
    check("report totalPayable 800", near(r.json?.data?.summary?.totalPayable, 800), r.json);
    r = await call("GET", `/suppliers/${sup.id}`);
    check("supplier detail has purchases + ledgerEntries", r.json.data.purchases.length >= 2 && r.json.data.ledgerEntries.length === rows.length, r.json.data);

    console.log("Legacy data compatibility");
    // A payment row as the pre-cleanup code wrote it: no purchase_id, no method, reference to supplier_payments.
    await SupplierLedger.create({
      owner_id: ownerA.id, shop_id: shopA.id, supplier_id: sup.id, entry_type: "debit", amount: 100,
      running_balance: 700, reference_type: "SupplierPayment", reference_id: 9999, description: "Legacy payment",
      actor_type: "owner", actor_id: ownerA.id,
    });
    await Supplier.update({ current_balance: 700 }, { where: { id: sup.id } });
    r = await call("GET", "/supplier-ledger/payments");
    check("legacy SupplierPayment row listed with new payments (3)", r.json.data.length === 3, r.json.data);
    // A purchase number already taken (e.g. by older data) must be skipped, not crash.
    await Purchase.create({
      owner_id: ownerA.id, shop_id: shopA.id, supplier_id: sup.id, purchase_number: "PUR000003", total_amount: 0,
      actor_type: "owner", actor_id: ownerA.id,
    });
    r = await call("POST", "/purchases", { supplierId: sup.id, items: [{ productId: prod.id, quantity: 1, rate: 10 }] });
    check("taken number skipped → PUR000004", r.status === 201 && r.json.data.purchase_number === "PUR000004", r.json);
    check("payable continues from legacy balance (700 + 10)", near(await supBal(sup.id), 710));

    console.log("PDF");
    r = await call("GET", `/purchases/${p1.id}/pdf`);
    check("purchase PDF streams", r.status === 200 && r.ct.includes("pdf"), r.ct);

    console.log("Tenant isolation");
    r = await call("GET", `/suppliers/${sup.id}`, undefined, tokB);
    check("owner B cannot read owner A's supplier → 404", r.status === 404, r.json);
    r = await call("GET", `/purchases/${p1.id}`, undefined, tokB);
    check("owner B cannot read owner A's purchase → 404", r.status === 404, r.json);
    r = await call("POST", `/purchases/${p1.id}/payment`, { amount: 1 }, tokB);
    check("owner B cannot pay owner A's bill → 404", r.status === 404, r.json);
    r = await call("POST", "/purchases", { supplierId: sup.id, items: [{ productId: prod.id, quantity: 1, rate: 1 }] }, tokB);
    check("owner B cannot buy from owner A's supplier → 404", r.status === 404, r.json);
    r = await call("GET", "/supplier-ledger/payments", undefined, tokB);
    check("owner B sees no supplier payments", r.json.data.length === 0);
  } finally {
    server.close();
    await sequelize.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
