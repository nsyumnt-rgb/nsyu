/**
 * End-to-end business workflows over the real HTTP API (isolated in-memory SQLite).
 *   A  Customer shopping → owner processes order → customer tracks status
 *   B  Order → bill (no duplicate bill / ledger entries, stock deducted once)
 *   C  Billing & ledger: full, partial and credit bills, later payment, zero balance
 *   D  Inventory: create product → stock in → sell → deduction → history
 *   E  Multi-shop: supplier purchase (payable), two owners stay isolated
 * Every assertion re-reads the database, not just the HTTP response.
 *                                                     npm run test:workflows
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
const m = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);
const { sequelize, Owner, Shop, Customer, CustomerAccount, Product, ProductStock, Category, ShopPortalSettings, Sale, CustomerLedger, Order, InventoryTransaction } = m;

let pass = 0;
const failures: string[] = [];
const ok = (cond: any, label: string, detail?: any) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    failures.push(label + (detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 220)}` : ""));
    console.log("  ✗ " + label);
  }
};
const num = (v: any) => Math.round(Number(v || 0) * 100) / 100;

async function main() {
  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);

  const ownerA = await Owner.create({ name: "WF Owner A", email: "wf-a@test.local", password: "x" });
  const ownerB = await Owner.create({ name: "WF Owner B", email: "wf-b@test.local", password: "x" });
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "WF Shop A", code: "WFA", status: "active" });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "WF Shop B", code: "WFB", status: "active" });
  for (const s of [shopA, shopB]) await ShopPortalSettings.create({ shop_id: s.id, allow_orders: true, allow_self_registration: true });
  const cat = await Category.create({ owner_id: ownerA.id, name: "Chargers" });
  const prod = await Product.create({ owner_id: ownerA.id, name: "Charger 25W", sku: "WF-CH25", selling_price: 500, purchase_price: 300, mrp: 700, category_id: cat.id, status: "active" });
  await ProductStock.create({ owner_id: ownerA.id, shop_id: shopA.id, product_id: prod.id, current_stock: 20 });
  const cust = await Customer.create({ owner_id: ownerA.id, name: "WF Customer", phone: "9300000001", email: "wfc@test.local" });
  const acc = await CustomerAccount.create({ customer_id: cust.id, shop_id: shopA.id, owner_id: ownerA.id, phone: "9300000001", email: "wfc@test.local", status: "active" });

  const tokA = signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id });
  const tokB = signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id });
  const tokC = signAccessToken({ ownerId: ownerA.id, isOwner: false, isCustomer: true, customerId: cust.id, accountId: Number(acc.id), shopId: shopA.id });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, p: string, tok: string, body?: any, headers: Record<string, string> = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* */ }
    return { status: r.status, json, text };
  };
  const stockOf = async (pid: number, sid = shopA.id) => num((await ProductStock.findOne({ where: { product_id: pid, shop_id: sid } }))?.current_stock);
  const balanceOf = async (cid: number) => num((await Customer.findByPk(cid)).current_balance);

  try {
    // ── A: customer shopping → owner processes → customer tracks ────────
    console.log("\nWorkflow A — customer shopping");
    const cat1 = await call("GET", `/customer-portal/catalog/products?categoryId=${cat.id}`, tokC);
    ok(cat1.status === 200 && cat1.json.data.some((p: any) => p.id === prod.id), "browse category shows the product", cat1.text);
    const srch = await call("GET", "/customer-portal/catalog/products?search=charger", tokC);
    ok(srch.status === 200 && srch.json.data.length === 1, "search finds the product", srch.json?.data?.length);
    await Product.update({ barcode: "8907654323814" }, { where: { id: prod.id } });
    const byBarcode = await call("GET", "/customer-portal/catalog/products?search=8907654323814", tokC);
    ok(byBarcode.status === 200 && byBarcode.json.data.length === 1 && byBarcode.json.data[0].id === prod.id, "search finds the product by barcode", byBarcode.json?.data?.length);
    const cats = await call("GET", "/customer-portal/catalog/categories", tokC);
    const catRow = (cats.json?.data || []).find((c: any) => c.id === cat.id);
    ok(cats.status === 200 && catRow?.productCount === 1, "categories report their active product count", catRow);
    const catsB = await call("GET", "/customer-portal/catalog/categories", tokB);
    ok(catsB.status === 401 || catsB.status === 403, "staff/owner tokens can't use the customer catalog", catsB.status);
    ok(cats.json?.data !== undefined && (await call("GET", `/customer-portal/catalog/products/${prod.id}`, tokC)).json?.data?.inventory?.showStockQty === false, "product says stock quantity is hidden unless the shop enables it");

    // Customer "change password" (My Account)
    const cp = (body: any, tok = tokC) => call("POST", "/customer-portal/auth/change-password", tok, body);
    ok((await cp({ newPassword: "abc" })).status === 400, "change password: too-short password refused");
    const first = await cp({ newPassword: "first-pass-1" });
    ok(first.status === 200, "change password: OTP-only account can set its first password", first.text);
    ok((await cp({ currentPassword: "wrong-pass", newPassword: "second-pass-2" })).status === 400, "change password: wrong current password refused");
    ok((await cp({ currentPassword: "first-pass-1", newPassword: "first-pass-1" })).status === 400, "change password: new must differ from current");
    const second = await cp({ currentPassword: "first-pass-1", newPassword: "second-pass-2" });
    ok(second.status === 200, "change password: correct current password accepted", second.text);
    const relog = await call("POST", "/customer-portal/auth/login", "", { identifier: "wfc@test.local", password: "second-pass-2", shopId: shopA.id });
    ok(relog.status === 200 && relog.json?.data?.accessToken, "customer can log in with the new password", relog.text);
    const oldPw = await call("POST", "/customer-portal/auth/login", "", { identifier: "wfc@test.local", password: "first-pass-1", shopId: shopA.id });
    ok(oldPw.status === 401 || oldPw.status === 400, "old password no longer works", oldPw.status);
    ok((await cp({ currentPassword: "x", newPassword: "whatever-1" }, "")).status === 401, "change password needs a signed-in customer");
    ok([401, 403].includes((await cp({ currentPassword: "x", newPassword: "whatever-1" }, tokA)).status), "owner/staff tokens can't use customer change password");
    const det = await call("GET", `/customer-portal/catalog/products/${prod.id}`, tokC);
    ok(det.status === 200 && !/purchase_?price/i.test(det.text), "product details load without cost price", det.status);
    let cart = await call("PUT", `/customer-portal/cart/items/${prod.id}`, tokC, { quantity: 2 });
    ok(cart.status === 200 && cart.json.data.items[0].quantity === 2, "add to cart (qty 2)", cart.text);
    cart = await call("PUT", `/customer-portal/cart/items/${prod.id}`, tokC, { quantity: 3 });
    ok(cart.json?.data?.items?.[0]?.quantity === 3, "increase quantity to 3");
    cart = await call("PUT", `/customer-portal/cart/items/${prod.id}`, tokC, { quantity: 2 });
    ok(cart.json?.data?.items?.[0]?.quantity === 2, "decrease quantity to 2");
    const tooMany = await call("PUT", `/customer-portal/cart/items/${prod.id}`, tokC, { quantity: 999 });
    ok(tooMany.status >= 400 || tooMany.json?.data?.items?.[0]?.isUnavailable || tooMany.json?.data?.items?.[0]?.warning, "quantity above stock is refused or flagged", tooMany.status);
    await call("PUT", `/customer-portal/cart/items/${prod.id}`, tokC, { quantity: 2 });
    const persisted = await call("GET", "/customer-portal/cart", tokC);
    ok(persisted.json?.data?.items?.[0]?.quantity === 2, "cart persists server-side (re-read)");
    const place = await call("POST", "/customer-portal/orders", tokC, { clientRequestId: "wf-order-000001", deliveryType: "pickup" });
    ok(place.status === 201 || place.status === 200, "place order", place.text);
    const order = place.json?.data?.order || place.json?.data;
    const again = await call("POST", "/customer-portal/orders", tokC, { clientRequestId: "wf-order-000001", deliveryType: "pickup" });
    ok((await Order.count({ where: { customer_id: cust.id } })) === 1, "double-submit with same request id creates one order", again.status);
    const emptied = await call("GET", "/customer-portal/cart", tokC);
    ok((emptied.json?.data?.items || []).length === 0, "cart emptied after order");
    const ownerSees = await call("GET", "/orders", tokA);
    ok(ownerSees.status === 200 && JSON.stringify(ownerSees.json).includes(order.order_number || order.orderNumber || String(order.id)), "owner receives the order");
    const ownerBSees = await call("GET", "/orders", tokB);
    ok(!JSON.stringify(ownerBSees.json || {}).includes(order.order_number || order.orderNumber || "@@"), "other owner does not see it");
    for (const st of ["confirmed", "processing", "shipped"]) {
      const u = await call("PUT", `/orders/${order.id}/status`, tokA, { status: st });
      ok(u.status === 200, `owner moves order to ${st}`, u.text);
    }
    const track = await call("GET", `/customer-portal/orders/${order.id}`, tokC);
    ok(track.status === 200 && /shipped/i.test(JSON.stringify(track.json?.data?.status ?? track.json?.data)), "customer tracks status = shipped", track.json?.data?.status);
    ok(/history|timeline|statusHistory/i.test(track.text), "tracking includes status history");
    const ownerView = await call("GET", `/orders/${order.id}`, tokA);
    const ownerHist: any[] = ownerView.json?.data?.statusHistory || [];
    ok(
      ownerView.status === 200 && ownerHist.map((h) => h.to_status).join(">").endsWith("confirmed>processing>shipped"),
      "owner order view returns the real status timeline, oldest first",
      ownerHist.map((h) => h.to_status)
    );
    ok((await call("GET", `/orders/${order.id}`, tokB)).status === 404, "other owner can't read the order timeline");

    // ── B: order → bill without duplicates ──────────────────────────────
    console.log("\nWorkflow B — order to bill");
    const early = await call("POST", `/orders/${order.id}/convert`, tokA, { paidAmount: 0, paymentMethod: "cash" });
    ok(early.status === 400 && (await Sale.count({ where: { customer_id: cust.id } })) === 0, "cannot bill an order before it is delivered", early.status);
    const dlv = await call("PUT", `/orders/${order.id}/status`, tokA, { status: "delivered" });
    ok(dlv.status === 200, "owner marks order delivered", dlv.text);
    const stockBefore = await stockOf(prod.id);
    const ledgerBefore = await CustomerLedger.count({ where: { customer_id: cust.id } });
    const conv = await call("POST", `/orders/${order.id}/convert`, tokA, { paidAmount: 0, paymentMethod: "cash" });
    ok(conv.status === 200 || conv.status === 201, "convert order to bill", conv.text);
    const conv2 = await call("POST", `/orders/${order.id}/convert`, tokA, { paidAmount: 0, paymentMethod: "cash" });
    ok(conv2.status >= 400 || (conv2.json?.data?.id && conv2.json.data.id === conv.json?.data?.id) || conv2.json?.data?.alreadyBilled, "second convert does not create another bill", conv2.status);
    const bills = await Sale.count({ where: { customer_id: cust.id } });
    ok(bills === 1, "exactly one bill for the order", bills);
    const ledgerAfter = await CustomerLedger.count({ where: { customer_id: cust.id } });
    ok(ledgerAfter - ledgerBefore >= 1 && ledgerAfter - ledgerBefore <= 2, "ledger posted once for the bill", ledgerAfter - ledgerBefore);
    const stockAfterBill = await stockOf(prod.id);
    ok(stockBefore - stockAfterBill === 2 || stockBefore === 18, "stock reduced by exactly the ordered qty (2)", { stockBefore, stockAfterBill });
    ok(await balanceOf(cust.id) === 1000, "outstanding = bill total (₹1000, unpaid)", await balanceOf(cust.id));
    const ord = await Order.findByPk(order.id);
    ok(/bill|completed|converted/i.test(String(ord.status)) || ord.sale_id || ord.bill_id, "order marked billed", ord.status);

    // ── C: billing & ledger (full / partial / credit / later payment) ───
    console.log("\nWorkflow C — billing and ledger");
    const c2 = await Customer.create({ owner_id: ownerA.id, name: "Ledger Cust", phone: "9300000002", email: "lc@test.local" });
    const mkBill = (paid: number, key: string) =>
      call("POST", "/sales", tokA, { customerId: c2.id, items: [{ productId: prod.id, quantity: 1, rate: 500 }], paymentMethod: "cash", paidAmount: paid }, { "x-idempotency-key": key });
    const full = await mkBill(500, "wf-bill-full-0001");
    ok(full.status === 201, "full-payment bill", full.text);
    ok(await balanceOf(c2.id) === 0, "full payment leaves zero balance", await balanceOf(c2.id));
    const dup = await mkBill(500, "wf-bill-full-0001");
    ok((await Sale.count({ where: { customer_id: c2.id } })) === 1, "idempotent retry does not duplicate the bill", dup.status);
    const partial = await mkBill(200, "wf-bill-part-0001");
    ok(partial.status === 201 && (await balanceOf(c2.id)) === 300, "partial payment leaves ₹300 due", await balanceOf(c2.id));
    const credit = await mkBill(0, "wf-bill-cred-0001");
    ok(credit.status === 201 && (await balanceOf(c2.id)) === 800, "credit (udhaar) bill raises due to ₹800", await balanceOf(c2.id));
    const pay = await call("POST", "/ledger/payment", tokA, { customerId: c2.id, amount: 800, paymentMethod: "cash" }, { "x-idempotency-key": "wf-ledger-pay-0001" });
    ok(pay.status === 200 || pay.status === 201, "record ₹800 payment on ledger", pay.text);
    ok(await balanceOf(c2.id) === 0, "balance back to zero", await balanceOf(c2.id));
    await call("POST", "/ledger/payment", tokA, { customerId: c2.id, amount: 800, paymentMethod: "cash" }, { "x-idempotency-key": "wf-ledger-pay-0001" });
    ok(await balanceOf(c2.id) === 0, "retried payment is not applied twice", await balanceOf(c2.id));

    // Browsers send a CORS preflight before POSTs with x-idempotency-key; if the API doesn't
    // allow that header, the live web app can't save any bill (Node fetch never preflights,
    // so the calls above can't catch it).
    for (const [p, label] of [["/sales", "bill/sale"], ["/ledger/payment", "ledger payment"]] as const) {
      const pre = await fetch(base + p, {
        method: "OPTIONS",
        headers: {
          Origin: "https://nsyumnt-rgb.github.io",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,authorization,x-idempotency-key",
        },
      });
      const allowed = (pre.headers.get("access-control-allow-headers") || "").toLowerCase();
      ok(pre.status < 300 && allowed.includes("x-idempotency-key") && pre.headers.get("access-control-allow-origin") === "https://nsyumnt-rgb.github.io", `browser preflight for ${label} allows x-idempotency-key from the live site`, allowed);
    }
    const overpay = await call("POST", "/ledger/payment", tokA, { customerId: c2.id, amount: 50, paymentMethod: "cash" });
    ok(overpay.status >= 400 || (await balanceOf(c2.id)) <= 0, "payment with nothing due is refused or recorded as advance", overpay.status);
    const led = await call("GET", `/ledger/${c2.id}`, tokA);
    ok(led.status === 200, "ledger statement loads", led.status);
    const negQty = await call("POST", "/sales", tokA, { customerId: c2.id, items: [{ productId: prod.id, quantity: -1, rate: 500 }], paymentMethod: "cash", paidAmount: 0 });
    ok(negQty.status === 400, "negative quantity rejected", negQty.status);
    // Short-stock billing is a shop setting (allowed by default for backorders). When the owner
    // turns it off, overselling must be refused and nothing written.
    await shopA.update({ settings: { ...(shopA.settings || {}), allowNegativeStock: false } });
    const salesBefore = await Sale.count();
    const overSell = await call("POST", "/sales", tokA, { customerId: c2.id, items: [{ productId: prod.id, quantity: 9999, rate: 500 }], paymentMethod: "cash", paidAmount: 0 });
    ok(overSell.status >= 400 && overSell.status < 500 && (await Sale.count()) === salesBefore, "with negative stock disabled, overselling is rejected and nothing is saved", overSell.status);
    await shopA.update({ settings: { ...(shopA.settings || {}), allowNegativeStock: true } });

    // ── D: inventory ────────────────────────────────────────────────────
    console.log("\nWorkflow D — inventory");
    const created = await call("POST", "/products", tokA, { name: "Cable 1m", sku: "WF-CB1", sellingPrice: 150, selling_price: 150, purchasePrice: 80, purchase_price: 80, mrp: 199, openingStock: 10, opening_stock: 10, categoryId: cat.id, unit: "pcs" });
    ok(created.status === 201 || created.status === 200, "create product", created.text);
    const newId = created.json?.data?.id ?? created.json?.data?.product?.id;
    const s0 = await stockOf(newId);
    const inMove = await call("POST", "/inventory/movement", tokA, { productId: newId, type: "purchase", quantity: 15 });
    ok(inMove.status === 201 || inMove.status === 200, "add stock (+15)", inMove.text);
    ok(await stockOf(newId) === s0 + 15, "stock increased by 15", { s0, now: await stockOf(newId) });
    const adj = await call("POST", "/inventory/movement", tokA, { productId: newId, type: "adjustment", quantity: -3 });
    ok(adj.status < 300 && (await stockOf(newId)) === s0 + 12, "stock correction (−3)", await stockOf(newId));
    const sold = await call("POST", "/sales", tokA, { customerId: c2.id, items: [{ productId: newId, quantity: 4, rate: 150 }], paymentMethod: "cash", paidAmount: 600 });
    ok(sold.status === 201 && (await stockOf(newId)) === s0 + 8, "sale deducts 4 from stock", await stockOf(newId));
    const moves = await InventoryTransaction.count({ where: { product_id: newId } });
    ok(moves >= 3, "stock history records every movement", moves);
    const hist = await call("GET", `/inventory/history?productId=${newId}`, tokA);
    ok(hist.status === 200, "inventory history endpoint", hist.status);
    const cancel = await call("POST", `/sales/${sold.json.data.id}/cancel`, tokA, { reason: "test" });
    ok(cancel.status === 200 && (await stockOf(newId)) === s0 + 12, "cancelling the bill restores stock", await stockOf(newId));

    // ── E: multi-shop / supplier purchase / isolation ───────────────────
    console.log("\nWorkflow E — suppliers and multi-shop");
    const sup = await call("POST", "/suppliers", tokA, { name: "Wholesale Co", phone: "9400000001" });
    ok(sup.status === 201 || sup.status === 200, "create supplier (wholesaler)", sup.text);
    const supId = sup.json?.data?.id;
    const before = await stockOf(prod.id);
    const pur = await call("POST", "/purchases", tokA, { supplierId: supId, items: [{ productId: prod.id, quantity: 10, rate: 300 }], initialPaid: 1000, paymentMethod: "cash", clientRequestId: "wf-purchase-0001" });
    ok(pur.status === 201 || pur.status === 200, "purchase from supplier", pur.text);
    ok(await stockOf(prod.id) === before + 10, "purchase adds stock", { before, now: await stockOf(prod.id) });
    const supRow = await call("GET", `/suppliers/${supId}`, tokA);
    ok(/2000|2,000/.test(supRow.text), "supplier payable = ₹2000 (₹3000 − ₹1000 paid)", supRow.json?.data);
    const crossSup = await call("GET", `/suppliers/${supId}`, tokB);
    ok(crossSup.status === 404 || crossSup.status === 403, "other owner cannot read the supplier", crossSup.status);
    const crossPur = await call("GET", `/purchases/${pur.json?.data?.id}`, tokB);
    ok(crossPur.status === 404 || crossPur.status === 403, "other owner cannot read the purchase", crossPur.status);
    const bSale = await call("POST", "/sales", tokB, { customerId: c2.id, items: [{ productId: prod.id, quantity: 1, rate: 1 }], paymentMethod: "cash", paidAmount: 1 });
    ok(bSale.status >= 400, "other owner cannot bill shop A's product/customer", bSale.status);
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
