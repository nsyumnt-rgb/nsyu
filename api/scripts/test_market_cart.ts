/**
 * MultiShop phase 1 step 3 — cart grouped by shop.
 * Isolated: in-memory SQLite, throwaway fixtures, real HTTP. Never touches the configured DB.
 *   npm run test:market-cart
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);
const { sequelize, Owner, Shop, Product, ProductStock, Customer, CustomerAccount, ShopPortalSettings } = models;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra?: any) => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
  }
};

async function main() {
  await sequelize.sync({ force: true });

  // Stock-limit checks use shops that turned "sell without stock" off; `defaultStock` leaves the setting unset.
  async function mkShop(code: string, opts: { status?: string; selfReg?: boolean; defaultStock?: boolean } = {}) {
    const owner = await Owner.create({ name: `Owner ${code}`, email: `${code}@test.local`, password: "x" });
    const shop = await Shop.create({
      owner_id: owner.id,
      name: `Shop ${code}`,
      code,
      status: opts.status || "active",
      ...(opts.defaultStock ? {} : { settings: { allowNegativeStock: false } }),
    });
    await ShopPortalSettings.create({ shop_id: shop.id, allow_orders: true, allow_self_registration: opts.selfReg !== false });
    const product = await Product.create({ owner_id: owner.id, name: `Item ${code}`, sku: `SKU-${code}`, selling_price: 100 });
    await ProductStock.create({ owner_id: owner.id, shop_id: shop.id, product_id: product.id, current_stock: 5 });
    return { owner, shop, product };
  }
  const A = await mkShop("A");
  const B = await mkShop("B");
  const P = await mkShop("P", { selfReg: false });
  const Q = await mkShop("Q");
  const S = await mkShop("S", { status: "suspended" });
  const N = await mkShop("N", { defaultStock: true });

  async function mkCustomer(shopRec: any, name: string, phone: string, email: string) {
    const c = await Customer.create({ owner_id: shopRec.owner.id, name, phone, email });
    const acc = await CustomerAccount.create({
      customer_id: c.id, shop_id: shopRec.shop.id, owner_id: shopRec.owner.id, phone, email, password_hash: "hash-" + name, status: "active",
    });
    const token = signAccessToken({ ownerId: shopRec.owner.id, isOwner: false, isCustomer: true, customerId: c.id, accountId: Number(acc.id), shopId: shopRec.shop.id });
    return { c, acc, token };
  }
  const C = await mkCustomer(A, "Ravi", "9000000001", "ravi@test.local");
  const D = await mkCustomer(A, "Sita", "9000000002", "sita@test.local");
  // Shop Q already has its own customer record for Ravi's mobile (its khata):
  await Customer.create({ owner_id: Q.owner.id, name: "Ravi (shop record)", phone: "9000000001" });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/customer-portal/market`;
  const call = async (method: string, p: string, tok: string, body?: any) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() };
  };
  const put = (tok: string, shopId: number, productId: number, quantity: number) => call("PUT", `/cart/${shopId}/items/${productId}`, tok, { quantity });

  try {
    console.log("Cart grouped by shop");
    let r = await call("GET", "/cart", C.token);
    check("empty cart → no groups", r.status === 200 && r.json.data.groups.length === 0, r.json);
    r = await fetch(base + "/cart").then(async (x) => ({ status: x.status, json: await x.json() }));
    check("no login → 401", r.status === 401);

    r = await put(C.token, A.shop.id, A.product.id, 2);
    check("add from own shop", r.status === 200 && r.json.data.groups.length === 1 && r.json.data.groups[0].cart.items[0].quantity === 2, r.json);

    r = await put(C.token, B.shop.id, B.product.id, 1);
    check("add from a second shop → 2 groups", r.status === 200 && r.json.data.groups.length === 2, r.json);
    check("grand total sums both shops (₹300)", r.json.data.total === 300, r.json.data);
    const bAcc = await CustomerAccount.findAll({ where: { shop_id: B.shop.id } });
    check("account created at shop B, same login, linked identity", bAcc.length === 1 && bAcc[0].password_hash === "hash-Ravi" && !!bAcc[0].identity_group, bAcc.map((a: any) => a.toJSON()));
    const aAcc = await CustomerAccount.findByPk(C.acc.id);
    check("both accounts share identity group", aAcc.identity_group === bAcc[0].identity_group);
    check("separate customer record (own khata) at shop B", bAcc[0].customer_id !== C.c.id);

    r = await put(C.token, B.shop.id, B.product.id, 3);
    check("second add reuses the shop account", (await CustomerAccount.count({ where: { shop_id: B.shop.id } })) === 1 && r.json.data.groups.find((g: any) => g.shop.id === B.shop.id).cart.items[0].quantity === 3);

    r = await put(C.token, B.shop.id, B.product.id, 9);
    check("over stock → 400 from existing cart rules", r.status === 400, r.json);
    r = await put(C.token, N.shop.id, N.product.id, 9);
    check("shop that never set the option sells beyond stock (new default)", r.status === 200 && r.json.data.groups.find((g: any) => g.shop.id === N.shop.id)?.cart.items[0].quantity === 9, r.json);
    r = await put(C.token, N.shop.id, N.product.id, 0);

    console.log("Rules");
    r = await put(C.token, P.shop.id, P.product.id, 1);
    check("shop requiring approval → 403 AWAITING_APPROVAL", r.status === 403 && r.json.code === "AWAITING_APPROVAL", r.json);
    r = await call("GET", "/cart", C.token);
    check("pending shop shown in cart as awaiting approval", r.json.data.groups.some((g: any) => g.shop.id === P.shop.id && g.status === "pending_approval"), r.json.data.groups);

    r = await put(C.token, Q.shop.id, Q.product.id, 1);
    check("shop already has a record for this mobile → 409, not auto-linked", r.status === 409 && r.json.code === "SHOP_RECORD_EXISTS", r.json);
    check("no account created at shop Q", (await CustomerAccount.count({ where: { shop_id: Q.shop.id } })) === 0);

    r = await put(C.token, S.shop.id, S.product.id, 1);
    check("suspended shop → 404", r.status === 404, r.json);

    r = await put(C.token, A.shop.id, A.product.id, 0);
    check("quantity 0 removes the line (shop A group gone)", !r.json.data.groups.some((g: any) => g.shop.id === A.shop.id), r.json.data.groups);
    const before = await CustomerAccount.count();
    await put(C.token, Q.shop.id, Q.product.id, 0);
    check("removing from an unlinked shop never creates an account", (await CustomerAccount.count()) === before);

    console.log("Isolation between customers");
    r = await call("GET", "/cart", D.token);
    check("another customer sees none of Ravi's cart", r.json.data.groups.length === 0, r.json.data);
    r = await put(D.token, B.shop.id, B.product.id, 1);
    const dAcc = await CustomerAccount.findOne({ where: { shop_id: B.shop.id, phone: "9000000002" } });
    check("Sita gets her own shop-B account, not Ravi's group", !!dAcc && dAcc.identity_group !== bAcc[0].identity_group);
    r = await call("GET", "/cart", C.token);
    const ravisB = r.json.data.groups.find((g: any) => g.shop.id === B.shop.id);
    check("Ravi's shop-B cart unchanged (qty 3)", ravisB?.cart.items[0].quantity === 3, ravisB);

    console.log("Checkout — one order per shop");
    const { Order } = models;
    const addr = { name: "Ravi", phone: "9000000001", line: "12 MG Road", city: "Pune", pincode: "411001" };
    await put(C.token, A.shop.id, A.product.id, 2); // cart: A x2, B x3
    let co = await call("POST", "/checkout", C.token, { checkoutId: "chk-11111111", address: { name: "Ravi" }, shops: [{ shopId: A.shop.id, deliveryType: "delivery", paymentMethod: "cod" }] });
    check("delivery without full address → 400", co.status === 400, co.json);

    const opts = await call("GET", "/checkout/options", C.token);
    check("checkout options list shops + saved address", opts.status === 200 && opts.json.data.shops.length >= 2 && opts.json.data.address.phone === "9000000001", opts.json);

    B.shop.settings = { ...(B.shop.settings || {}), enableCredit: false };
    await B.shop.save();
    co = await call("POST", "/checkout", C.token, { checkoutId: "chk-22222222", address: addr, shops: [{ shopId: B.shop.id, deliveryType: "pickup", paymentMethod: "khata" }] });
    check("khata refused where shop disallows credit", co.status === 400 && co.json.data.results[0].ok === false, co.json);

    const ordersBefore = await Order.count();
    co = await call("POST", "/checkout", C.token, {
      checkoutId: "chk-33333333",
      address: addr,
      shops: [
        { shopId: A.shop.id, deliveryType: "delivery", paymentMethod: "khata", note: "Ring the bell" },
        { shopId: B.shop.id, deliveryType: "pickup", paymentMethod: "upi" },
      ],
    });
    check("checkout two shops → 201, both placed", co.status === 201 && co.json.data.results.every((x: any) => x.ok), co.json);
    const orders = await Order.findAll({ order: [["id", "ASC"]] });
    const oA = orders.find((o: any) => o.shop_id === A.shop.id);
    const oB = orders.find((o: any) => o.shop_id === B.shop.id);
    check("2 new orders, one per shop", (await Order.count()) - ordersBefore === 2 && !!oA && !!oB);
    check("each order belongs to that shop's owner and account", oA.owner_id === A.owner.id && oB.owner_id === B.owner.id && oA.customer_account_id === Number(C.acc.id) && oB.customer_account_id !== Number(C.acc.id));
    check("order totals from shop prices (₹200 + ₹300)", Number(oA.total_amount) === 200 && Number(oB.total_amount) === 300, [oA.total_amount, oB.total_amount]);
    check("delivery vs pickup recorded", oA.order_type === "Delivery" && oB.order_type === "Pickup" && String(oA.shipping_address).includes("411001"), [oA.order_type, oB.order_type, oA.shipping_address]);
    check("payment choice recorded for the shop", oA.payment_method === "Khata (pay later)" && oB.payment_method === "UPI" && oA.payment_status === "UNPAID");
    check("note passed to the shop", oA.remarks === "Ring the bell");
    check("cart emptied after checkout (only the awaiting-approval notice remains)", co.json.data.cart.itemCount === 0 && co.json.data.cart.groups.every((g: any) => g.status === "pending_approval"), co.json.data.cart);

    co = await call("POST", "/checkout", C.token, { checkoutId: "chk-33333333", address: addr, shops: [{ shopId: A.shop.id, deliveryType: "delivery", paymentMethod: "cod" }] });
    check("retry with same checkoutId → no duplicate order", (await Order.count()) - ordersBefore === 2 && co.json.data.results[0].repeated === true, co.json);

    console.log("Partial success");
    await put(C.token, A.shop.id, A.product.id, 2);
    await put(C.token, B.shop.id, B.product.id, 1);
    await ProductStock.update({ current_stock: 1 }, { where: { shop_id: A.shop.id, product_id: A.product.id } }); // stock dropped under the cart
    co = await call("POST", "/checkout", C.token, {
      checkoutId: "chk-44444444",
      address: addr,
      shops: [
        { shopId: A.shop.id, deliveryType: "delivery", paymentMethod: "cod" },
        { shopId: B.shop.id, deliveryType: "pickup", paymentMethod: "cod" },
      ],
    });
    const rA = co.json.data.results.find((x: any) => x.shopId === A.shop.id);
    const rB = co.json.data.results.find((x: any) => x.shopId === B.shop.id);
    check("shop with changed stock fails, the other shop still orders", co.status === 201 && rA.ok === false && rB.ok === true, co.json.data.results);
    check("failed shop's items stay in the cart", co.json.data.cart.groups.some((g: any) => g.shop.id === A.shop.id), co.json.data.cart);

    console.log("Checkout isolation");
    co = await call("POST", "/checkout", D.token, { checkoutId: "chk-55555555", address: addr, shops: [{ shopId: A.shop.id, deliveryType: "delivery", paymentMethod: "cod" }] });
    check("Sita can't order Ravi's cart (her own A cart is empty)", co.status === 400, co.json);
    co = await call("POST", "/checkout", D.token, { checkoutId: "chk-66666666", address: addr, shops: [{ shopId: P.shop.id, deliveryType: "delivery", paymentMethod: "cod" }] });
    check("checkout at a shop she has no account with → refused", co.status === 400 && co.json.data.results[0].ok === false, co.json);

    console.log("My orders across multiple shops");
    const port = (server.address() as any).port;
    const ordersRes = await fetch(`http://127.0.0.1:${port}/api/customer-portal/orders`, {
      headers: { Authorization: `Bearer ${C.token}` },
    });
    const ordersJson = await ordersRes.json();
    check("list orders returns 200", ordersRes.status === 200, ordersJson);
    const shopIdsInOrders = new Set((ordersJson.data || []).map((o: any) => o.shop_id));
    check("orders from shop A present in My orders", shopIdsInOrders.has(A.shop.id));
    check("orders from shop B present in My orders", shopIdsInOrders.has(B.shop.id));
    check("order includes shop association", ordersJson.data?.[0]?.shop?.name !== undefined);

    const firstOrder = ordersJson.data?.[0];
    if (firstOrder) {
      const orderDetail = await fetch(`http://127.0.0.1:${port}/api/customer-portal/orders/${firstOrder.id}`, {
        headers: { Authorization: `Bearer ${C.token}` },
      });
      const orderDetailJson = await orderDetail.json();
      check("get order detail across shops returns 200", orderDetail.status === 200, orderDetailJson);
      check("order detail includes shop details", orderDetailJson.data?.shop?.name !== undefined);
    }
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
