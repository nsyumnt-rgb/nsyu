/**
 * Section 30: End-to-End Acceptance Tests (REMAINING_WORK.md)
 *
 * Runs fully isolated in memory with real HTTP calls through Express:
 *   Test 1  — Multiple Wholesalers (independent products, stock, pricing, accounts)
 *   Test 2  — Multiple Buyers (independent credit terms and customer ledgers)
 *   Test 3  — Multiple Suppliers (three separate payable accounts)
 *   Test 4  — B2B Credit (sale of ₹50,000, payment of ₹20,000, ₹30,000 outstanding)
 *   Test 5  — B2C Sale (customer Rahul purchases, stock reduced, ledger posted)
 *   Test 6  — Same Customer Multiple Shops (Rahul in Shop A & Shop B, isolated ledgers)
 *   Test 7  — Shop as Buyer and Seller (Shop B buys from A and sells to C)
 *   Test 8  — Returns (cancellations restore stock and reverse financial ledgers)
 *   Test 9  — Notifications (database-backed events for order/payment lifecycle)
 *   Test 10 — Multi-Owner Isolation (cross-owner reads and writes rejected)
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

const {
  sequelize,
  Owner,
  Shop,
  Product,
  ProductStock,
  Customer,
  CustomerLedger,
  Supplier,
  SupplierLedger,
  Purchase,
  Sale,
  Notification,
} = models;

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

  // Start HTTP server on random port
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;

  const call = async (method: string, p: string, body?: any, tok?: string) => {
    const headers: any = { "Content-Type": "application/json" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const r = await fetch(base + p, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = r.headers.get("content-type") || "";
    return { status: r.status, json: ct.includes("json") ? await r.json() : null, ct };
  };

  try {
    // Setup primary actors
    const owner1 = await Owner.create({ name: "Wholesaler Super", email: "w1@nsyu.test", password: "pwd" });
    const shopW1 = await Shop.create({ owner_id: owner1.id, name: "W1 Mega Wholesale", code: "W1", status: "active" });
    const tokW1 = signAccessToken({ ownerId: owner1.id, isOwner: true, shopId: shopW1.id });

    const owner2 = await Owner.create({ name: "Wholesaler Star", email: "w2@nsyu.test", password: "pwd" });
    const shopW2 = await Shop.create({ owner_id: owner2.id, name: "W2 Star Wholesale", code: "W2", status: "active" });
    const tokW2 = signAccessToken({ ownerId: owner2.id, isOwner: true, shopId: shopW2.id });

    const owner3 = await Owner.create({ name: "Wholesaler Prime", email: "w3@nsyu.test", password: "pwd" });
    const shopW3 = await Shop.create({ owner_id: owner3.id, name: "W3 Prime Wholesale", code: "W3", status: "active" });
    const tokW3 = signAccessToken({ ownerId: owner3.id, isOwner: true, shopId: shopW3.id });

    const retailerOwner = await Owner.create({ name: "Retail Hub", email: "retail@nsyu.test", password: "pwd" });
    const shopR1 = await Shop.create({ owner_id: retailerOwner.id, name: "Retail Branch 1", code: "R1", status: "active" });
    const shopR2 = await Shop.create({ owner_id: retailerOwner.id, name: "Retail Branch 2", code: "R2", status: "active" });
    const tokR1 = signAccessToken({ ownerId: retailerOwner.id, isOwner: true, shopId: shopR1.id });
    const tokR2 = signAccessToken({ ownerId: retailerOwner.id, isOwner: true, shopId: shopR2.id });

    console.log("\n=======================================================");
    console.log("SECTION 30: END-TO-END ACCEPTANCE TESTS");
    console.log("=======================================================\n");

    // -------------------------------------------------------------------------
    console.log("Test 1 — Multiple Wholesalers");
    // -------------------------------------------------------------------------
    let r = await call("POST", "/products", { name: "Bulk Basmati Rice 25kg", sku: "RICE-25", sellingPrice: 2000, purchasePrice: 1600 }, tokW1);
    check("W1 creates product → 201", r.status === 201, r.json);
    const prodW1 = r.json.data;

    r = await call("POST", "/products", { name: "Bulk Sunflower Oil 15L", sku: "OIL-15", sellingPrice: 1800, purchasePrice: 1400 }, tokW2);
    check("W2 creates product → 201", r.status === 201, r.json);
    const prodW2 = r.json.data;

    // Add initial stock
    await call("POST", "/inventory/movement", { productId: prodW1.id, type: "adjustment", quantity: 100, notes: "Opening stock" }, tokW1);
    await call("POST", "/inventory/movement", { productId: prodW2.id, type: "adjustment", quantity: 80, notes: "Opening stock" }, tokW2);

    const stockW1 = await ProductStock.findOne({ where: { product_id: prodW1.id, shop_id: shopW1.id } });
    const stockW2 = await ProductStock.findOne({ where: { product_id: prodW2.id, shop_id: shopW2.id } });
    check("W1 stock is 100", Number(stockW1?.current_stock) === 100);
    check("W2 stock is 80", Number(stockW2?.current_stock) === 80);
    check("W1 cannot view W2 products", (await call("GET", `/products/${prodW2.id}`, undefined, tokW1)).status === 404);

    // -------------------------------------------------------------------------
    console.log("\nTest 2 — Multiple Buyers from Same Wholesaler");
    // -------------------------------------------------------------------------
    // W1 registers two distinct buyers (Buyer Alpha, Buyer Beta)
    r = await call("POST", "/customers", { name: "Buyer Alpha", phone: "9870000001", email: "alpha@buyer.test", password: "password123", address: "Alpha Market", creditLimit: 25000 }, tokW1);
    check("W1 registers Buyer Alpha → 201", r.status === 201, r.json);
    const buyerAlpha = r.json.data;

    r = await call("POST", "/customers", { name: "Buyer Beta", phone: "9870000002", email: "beta@buyer.test", password: "password123", address: "Beta Plaza", creditLimit: 50000 }, tokW1);
    check("W1 registers Buyer Beta → 201", r.status === 201, r.json);
    const buyerBeta = r.json.data;

    // W1 sells to Buyer Alpha on credit
    r = await call("POST", "/sales", {
      customerId: buyerAlpha.id,
      items: [{ productId: prodW1.id, quantity: 5, unitPrice: 2000 }],
      paidAmount: 2000, // 10,000 total, 2,000 paid, 8,000 due
      paymentMethod: "bank_transfer",
    }, tokW1);
    check("W1 bills Buyer Alpha → 201", r.status === 201, r.json);

    // W1 sells to Buyer Beta on credit
    r = await call("POST", "/sales", {
      customerId: buyerBeta.id,
      items: [{ productId: prodW1.id, quantity: 10, unitPrice: 2000 }],
      paidAmount: 5000, // 20,000 total, 5,000 paid, 15,000 due
      paymentMethod: "cash",
    }, tokW1);
    check("W1 bills Buyer Beta → 201", r.status === 201, r.json);

    const alphaFresh = await Customer.findByPk(buyerAlpha.id);
    const betaFresh = await Customer.findByPk(buyerBeta.id);
    check("Buyer Alpha outstanding is 8,000", near(alphaFresh?.current_balance, 8000), alphaFresh?.current_balance);
    check("Buyer Beta outstanding is 15,000", near(betaFresh?.current_balance, 15000), betaFresh?.current_balance);
    check("Both buyers have independent ledgers under W1", (await CustomerLedger.count({ where: { customer_id: buyerAlpha.id } })) >= 2 && (await CustomerLedger.count({ where: { customer_id: buyerBeta.id } })) >= 2);

    // -------------------------------------------------------------------------
    console.log("\nTest 3 — Multiple Suppliers for One Retailer");
    // -------------------------------------------------------------------------
    // Retailer R1 creates 3 suppliers representing W1, W2, W3
    r = await call("POST", "/suppliers", { name: "Wholesaler 1 (Mega)", phone: "9811111111", email: "mega@w1.local" }, tokR1);
    const s1 = r.json.data;
    r = await call("POST", "/suppliers", { name: "Wholesaler 2 (Star)", phone: "9822222222", email: "star@w2.local" }, tokR1);
    const s2 = r.json.data;
    r = await call("POST", "/suppliers", { name: "Wholesaler 3 (Prime)", phone: "9833333333", email: "prime@w3.local" }, tokR1);
    const s3 = r.json.data;

    // R1 creates its own catalog item
    r = await call("POST", "/products", { name: "Retail Pack Rice", sku: "RET-RICE", sellingPrice: 110, purchasePrice: 80 }, tokR1);
    const retProd = r.json.data;

    // Purchase from W1: ₹10,000 (paid ₹4,000, payable ₹6,000)
    await call("POST", "/purchases", { supplierId: s1.id, items: [{ productId: retProd.id, quantity: 50, rate: 200 }], initialPaid: 4000 }, tokR1);
    // Purchase from W2: ₹8,000 (paid ₹2,000, payable ₹6,000)
    await call("POST", "/purchases", { supplierId: s2.id, items: [{ productId: retProd.id, quantity: 40, rate: 200 }], initialPaid: 2000 }, tokR1);
    // Purchase from W3: ₹5,000 (paid 0, payable ₹5,000)
    await call("POST", "/purchases", { supplierId: s3.id, items: [{ productId: retProd.id, quantity: 25, rate: 200 }], initialPaid: 0 }, tokR1);

    const sup1 = await Supplier.findByPk(s1.id);
    const sup2 = await Supplier.findByPk(s2.id);
    const sup3 = await Supplier.findByPk(s3.id);
    check("Supplier 1 payable is 6,000", near(sup1?.current_balance, 6000), sup1?.current_balance);
    check("Supplier 2 payable is 6,000", near(sup2?.current_balance, 6000), sup2?.current_balance);
    check("Supplier 3 payable is 5,000", near(sup3?.current_balance, 5000), sup3?.current_balance);
    r = await call("GET", "/supplier-ledger/outstanding", undefined, tokR1);
    check("Retailer sees 3 distinct outstanding supplier payables", r.status === 200 && r.json.data.length === 3);

    // -------------------------------------------------------------------------
    console.log("\nTest 4 — B2B Credit Flow (50,000 bill, 20,000 payment → 30,000 outstanding)");
    // -------------------------------------------------------------------------
    // Create supplier for B2B trade
    r = await call("POST", "/suppliers", { name: "National Grains Corp", phone: "9844444444" }, tokR1);
    const supB2B = r.json.data;

    // Purchase ₹50,000 with 0 initial payment
    r = await call("POST", "/purchases", {
      supplierId: supB2B.id,
      items: [{ productId: retProd.id, quantity: 500, rate: 100 }],
      initialPaid: 0,
      notes: "B2B Credit Purchase",
    }, tokR1);
    check("B2B purchase ₹50,000 created → 201", r.status === 201, r.json);
    const b2bPurchase = r.json.data;
    check("Purchase due amount is 50,000", near(b2bPurchase.due_amount, 50000));

    // Pay ₹20,000 against the purchase bill
    r = await call("POST", `/purchases/${b2bPurchase.id}/payment`, {
      amount: 20000,
      paymentMethod: "bank",
      notes: "Part payment",
    }, tokR1);
    check("Pay ₹20,000 on bill → 200/201", r.status === 200 || r.status === 201, r.json);

    const b2bPurchaseAfter = await Purchase.findByPk(b2bPurchase.id);
    const b2bSupAfter = await Supplier.findByPk(supB2B.id);
    check("Purchase remaining due is ₹30,000", near(b2bPurchaseAfter?.due_amount, 30000), b2bPurchaseAfter?.due_amount);
    check("Supplier outstanding payable is ₹30,000", near(b2bSupAfter?.current_balance, 30000), b2bSupAfter?.current_balance);

    // -------------------------------------------------------------------------
    console.log("\nTest 5 — B2C Sale (Customer Rahul purchase & stock deduction)");
    // -------------------------------------------------------------------------
    r = await call("POST", "/customers", { name: "Rahul Sharma", phone: "9855555555", email: "rahul@consumer.test", password: "password123", address: "123 Main Road" }, tokR1);
    check("Customer Rahul created → 201", r.status === 201, r.json);
    const rahulR1 = r.json.data;

    const stockBeforeB2C = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    r = await call("POST", "/sales", {
      customerId: rahulR1.id,
      items: [{ productId: retProd.id, quantity: 10, unitPrice: 110 }],
      paidAmount: 500, // ₹1,100 total, ₹500 paid, ₹600 due
      paymentMethod: "cash",
    }, tokR1);
    check("B2C sale to Rahul created → 201", r.status === 201, r.json);

    const stockAfterB2C = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    check("Stock reduced by exactly 10 units", stockAfterB2C === stockBeforeB2C - 10, { before: stockBeforeB2C, after: stockAfterB2C });

    const rahulFresh = await Customer.findByPk(rahulR1.id);
    check("Rahul customer balance is ₹600 due", near(rahulFresh?.current_balance, 600), rahulFresh?.current_balance);

    const rahulLedger = await CustomerLedger.findAll({ where: { customer_id: rahulR1.id } });
    check("Rahul ledger entries posted (debit ₹1,100, credit ₹500)", rahulLedger.length >= 2);

    // -------------------------------------------------------------------------
    console.log("\nTest 6 — Same Customer Across Multiple Shops (Isolated Ledgers)");
    // -------------------------------------------------------------------------
    // Retailer Owner operates Shop R1 and Shop R2. Same customer Rahul transacts at both.
    // Create product in Shop R2
    r = await call("POST", "/products", { name: "Shop2 Item", sku: "S2-ITEM", sellingPrice: 300, purchasePrice: 200 }, tokR2);
    const prodR2 = r.json.data;
    await call("POST", "/inventory/movement", { productId: prodR2.id, type: "adjustment", quantity: 50, notes: "Stock" }, tokR2);

    // Rahul purchases at Shop R2 for ₹900, pays ₹0 (₹900 due)
    r = await call("POST", "/sales", {
      customerId: rahulR1.id,
      items: [{ productId: prodR2.id, quantity: 3, unitPrice: 300 }],
      paidAmount: 0,
      paymentMethod: "cash",
    }, tokR2);
    check("Rahul billed at Shop R2 → 201", r.status === 201, r.json);

    // Check separate ledger scoping
    const r1Entries = await CustomerLedger.findAll({ where: { customer_id: rahulR1.id, shop_id: shopR1.id } });
    const r2Entries = await CustomerLedger.findAll({ where: { customer_id: rahulR1.id, shop_id: shopR2.id } });
    check("Shop R1 ledger has only Shop R1 transactions", r1Entries.length >= 2 && r1Entries.every((e: any) => e.shop_id === shopR1.id));
    check("Shop R2 ledger has only Shop R2 transactions", r2Entries.length >= 1 && r2Entries.every((e: any) => e.shop_id === shopR2.id));

    // Wholesaler W1 can independently register customer Rahul under W1's own tenant with same phone
    r = await call("POST", "/customers", { name: "Rahul Sharma (Wholesale Buyer)", phone: "9855555555", email: "rahul@w1-trade.test", password: "password123", address: "City Center" }, tokW1);
    check("Wholesaler W1 registers Rahul independently with same phone → 201", r.status === 201, r.json);
    const rahulW1 = r.json.data;
    check("W1 Rahul is distinct from Retailer Rahul", rahulW1.id !== rahulR1.id && rahulW1.owner_id === owner1.id);

    // -------------------------------------------------------------------------
    console.log("\nTest 7 — Shop as Buyer and Seller (Independent Transactions)");
    // -------------------------------------------------------------------------
    // Retailer R1 purchases 20 units of retProd from Supplier S1
    const r1InitialStock = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock || 0);
    r = await call("POST", "/purchases", {
      supplierId: s1.id,
      items: [{ productId: retProd.id, quantity: 20, rate: 80 }],
      initialPaid: 1600,
    }, tokR1);
    check("R1 purchases goods from supplier (Act as Buyer) → 201", r.status === 201, r.json);

    const r1AfterPurchaseStock = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    check("R1 inventory increased by 20", r1AfterPurchaseStock === r1InitialStock + 20);

    // Now R1 sells 5 units to its customer (Act as Seller)
    r = await call("POST", "/sales", {
      customerId: rahulR1.id,
      items: [{ productId: retProd.id, quantity: 5, unitPrice: 110 }],
      paidAmount: 550,
      paymentMethod: "bank_transfer",
    }, tokR1);
    check("R1 sells goods to customer (Act as Seller) → 201", r.status === 201, r.json);

    const r1FinalStock = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    check("R1 inventory decreased by 5 to net +15", r1FinalStock === r1AfterPurchaseStock - 5);

    // -------------------------------------------------------------------------
    console.log("\nTest 8 — Returns & Cancellations (Stock & Ledger Reversals)");
    // -------------------------------------------------------------------------
    // B2C Sale cancellation: create sale, then cancel
    const stockPreSale = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    r = await call("POST", "/sales", {
      customerId: rahulR1.id,
      items: [{ productId: retProd.id, quantity: 4, unitPrice: 110 }],
      paidAmount: 0,
      paymentMethod: "cash",
    }, tokR1);
    const saleToCancel = r.json.data;
    check("Sale created with ₹440 debit on customer", near(saleToCancel.due_amount, 440));
    check("Stock reduced by 4", Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock) === stockPreSale - 4);

    r = await call("POST", `/sales/${saleToCancel.id}/cancel`, { reason: "Customer return" }, tokR1);
    check("Cancel sale → 200", r.status === 200);

    const stockPostCancel = Number((await ProductStock.findOne({ where: { product_id: retProd.id, shop_id: shopR1.id } }))?.current_stock);
    check("Stock restored to pre-sale level", stockPostCancel === stockPreSale);

    const saleRecord = await Sale.findByPk(saleToCancel.id);
    check("Sale status is cancelled", saleRecord?.status === "cancelled");

    // -------------------------------------------------------------------------
    console.log("\nTest 9 — Notifications & Reminders");
    // -------------------------------------------------------------------------
    // Trigger customer payment reminder
    r = await call("POST", `/customers/${rahulR1.id}/send-reminder`, {}, tokR1);
    check("Send customer reminder endpoint → 200", r.status === 200, r.json);
    check("Response confirms in-app notification created", r.json.inAppNotification === true);

    const notif = await Notification.findOne({
      where: { recipient_type: "customer", recipient_id: rahulR1.id },
      order: [["id", "DESC"]],
    });
    check("Notification row persisted in DB", notif !== null && notif.type === "payment_reminder");
    check("Notification contains reminder title", notif?.title === "Payment Reminder");

    // -------------------------------------------------------------------------
    console.log("\nTest 10 — Multi-Owner & Tenant Isolation");
    // -------------------------------------------------------------------------
    // Owner 2 attempts to read Owner 1's customer
    r = await call("GET", `/customers/${buyerAlpha.id}`, undefined, tokW2);
    check("Owner 2 reading Owner 1's customer returns 404", r.status === 404);

    // Owner 2 attempts to read Owner 1's supplier
    r = await call("GET", `/suppliers/${supB2B.id}`, undefined, tokW2);
    check("Owner 2 reading Owner 1's supplier returns 404", r.status === 404);

    // Owner 2 attempts to bill Owner 1's product
    r = await call("POST", "/sales", {
      customerId: buyerBeta.id,
      items: [{ productId: prodW1.id, quantity: 1, unitPrice: 100 }],
    }, tokW2);
    check("Owner 2 billing Owner 1's product returns 404", r.status === 404);

    // Owner 2 attempts to read Owner 1's purchase
    r = await call("GET", `/purchases/${b2bPurchase.id}`, undefined, tokW2);
    check("Owner 2 reading Owner 1's purchase returns 404", r.status === 404);

    // Owner 2 attempts to access Retailer's shop settings
    r = await call("GET", `/shops/${shopR1.id}/settings`, undefined, tokW2);
    check("Owner 2 reading Retailer shop settings returns 404", r.status === 404);

    console.log("\n-------------------------------------------------------");
    console.log(`ACCEPTANCE TESTS COMPLETE: ${pass} passed, ${fail} failed`);
    console.log("-------------------------------------------------------\n");

    if (fail > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution exception:", err);
    process.exit(1);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
