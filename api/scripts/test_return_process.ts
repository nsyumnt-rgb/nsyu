/**
 * Test Suite: Returns and Cancellations Workflow (BRD Section 18)
 * Isolated in-memory SQLite, throwaway fixtures, real HTTP API calls.
 * Run via: npm run test:returns
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.NODE_ENV = "test";

import path from "path";
import http from "http";

const API = process.argv[2] || path.join(__dirname, "..", "src");
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const {
  sequelize,
  Owner,
  Shop,
  Customer,
  CustomerAccount,
  Product,
  ProductStock,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Supplier,
  Purchase,
  PurchaseItem,
  SupplierLedger,
  InventoryTransaction,
  CustomerLedger,
  Notification,
} = models;
const { signAccessToken } = require(`${API}/utils/jwt`);

let server: http.Server;
let port: number;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function api(method: string, apiPath: string, token: string, body?: any): Promise<{ status: number; data: any }> {
  const url = `http://127.0.0.1:${port}/api${apiPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, details?: any) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`, details ? JSON.stringify(details) : "");
  }
}

async function runTests() {
  console.log("=== NSYU Returns & Cancellations Test Suite (BRD Section 18) ===");

  await sequelize.sync({ force: true });
  await sequelize.query(`CREATE TABLE IF NOT EXISTS reference_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, scope VARCHAR(80) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME, UNIQUE(owner_id, scope));`);
  await startServer();

  try {
    // 1. Setup Owner & Shop
    const owner = await Owner.create({
      name: "Return Test Owner",
      email: "returns-test@nsyu.com",
      password: "password123",
      phone: "9876543210",
    });

    const shop = await Shop.create({
      owner_id: owner.id,
      name: "Returns Hub",
      code: "RH01",
      currency: "INR",
    });

    const ownerToken = signAccessToken({
      userId: owner.id,
      ownerId: owner.id,
      shopId: shop.id,
      role: "owner",
      isOwner: true,
      permissions: {},
    });

    // 2. Setup Customer & Account
    const customer = await Customer.create({
      owner_id: owner.id,
      shop_id: shop.id,
      name: "Ramesh Sharma",
      phone: "9811122233",
      current_balance: 0,
    });

    const custAccount = await CustomerAccount.create({
      owner_id: owner.id,
      shop_id: shop.id,
      customer_id: customer.id,
      phone: "9811122233",
      password_hash: "hash",
      status: "active",
    });

    const customerToken = signAccessToken({
      userId: custAccount.id,
      ownerId: owner.id,
      shopId: shop.id,
      role: "customer",
      isOwner: false,
      isCustomer: true,
      customerId: customer.id,
      accountId: custAccount.id,
      permissions: {},
    });

    // 3. Setup Product & Initial Stock (50 units)
    const product = await Product.create({
      owner_id: owner.id,
      name: "Wireless Mouse X1",
      sku: "MOU-X1",
      selling_price: 500,
      cost_price: 300,
      tax_rate: 18,
    });

    await ProductStock.create({
      owner_id: owner.id,
      shop_id: shop.id,
      product_id: product.id,
      current_stock: 50,
    });

    console.log("\n--- Suite 1: B2C Sales Return Flow ---");

    // Create a sale for 5 units of product at 500 each = 2500 total (unpaid on credit)
    const saleRes = await api("POST", "/sales", ownerToken, {
      customerId: customer.id,
      paymentMethod: "cash",
      paidAmount: 0,
      items: [{ productId: product.id, quantity: 5, rate: 500 }],
    });

    assert(saleRes.status === 201, "Sale created successfully", saleRes.data);
    const saleId = saleRes.data.data.id;
    const saleItemId = saleRes.data.data.items[0].id;

    // Verify initial stock was reduced from 50 to 45
    let stockRec = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    assert(stockRec?.current_stock === 45, "Stock reduced to 45 after sale");

    // Verify customer balance is 2500 (debit)
    let custRec = await Customer.findByPk(customer.id);
    assert(Number(custRec?.current_balance) === 2500, "Customer balance is 2500 after sale");

    // 1A. Partial Return: Return 2 units
    const retRes1 = await api("POST", `/sales/${saleId}/return`, ownerToken, {
      items: [{ saleItemId, quantity: 2 }],
      reason: "Customer changed mind on 2 units",
    });

    assert(retRes1.status === 201, "Partial return (2 units) recorded with 201", retRes1.data);
    assert(retRes1.data.data.reference_code?.startsWith("RET"), "Return reference code generated");
    assert(Number(retRes1.data.data.refund_amount) === 1000, "Refund amount is 1000 for 2 units @ 500");

    // Verify stock is restored: 45 + 2 = 47
    stockRec = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    assert(stockRec?.current_stock === 47, "Stock restored to 47 after returning 2 units");

    // Verify inventory transaction logged as customer_return
    const invTx = await InventoryTransaction.findOne({
      where: { product_id: product.id, type: "customer_return" },
      order: [["id", "DESC"]],
    });
    assert(invTx !== null && invTx.signed_quantity === 2, "Inventory transaction logged with signed_quantity 2");

    // Verify customer ledger entry exists with entry_type: 'credit'
    const ledEntry = await CustomerLedger.findOne({
      where: { customer_id: customer.id, reference_type: "SaleReturn" },
    });
    assert(ledEntry !== null && Number(ledEntry.amount) === 1000, "CustomerLedger credit entry of 1000 created");

    // Verify customer balance reduced from 2500 to 1500
    custRec = await Customer.findByPk(customer.id);
    assert(Number(custRec?.current_balance) === 1500, "Customer current_balance reduced to 1500");

    // Verify sale status and returned_amount
    let updatedSale = await Sale.findByPk(saleId);
    assert(updatedSale?.status === "partially_returned", "Sale status is now partially_returned");
    assert(Number(updatedSale?.returned_amount) === 1000, "Sale returned_amount is 1000");
    assert(Number(updatedSale?.due_amount) === 1500, "Sale due_amount is 1500");

    // Verify Customer received a notification
    const custNotif = await Notification.findOne({
      where: { recipient_type: "customer", recipient_id: customer.id, type: "return_processed" },
    });
    assert(custNotif !== null, "Customer received return_processed notification");

    // 1B. Return validation: cannot return more than remaining (available: 5 - 2 = 3)
    const excessRes = await api("POST", `/sales/${saleId}/return`, ownerToken, {
      items: [{ saleItemId, quantity: 4 }],
    });
    assert(excessRes.status === 400, "Returning 4 when only 3 available is rejected with 400");

    // 1C. Return validation: 0 or negative quantity rejected
    const zeroRes = await api("POST", `/sales/${saleId}/return`, ownerToken, {
      items: [{ saleItemId, quantity: 0 }],
    });
    assert(zeroRes.status === 400, "Returning 0 quantity is rejected with 400");

    // 1D. Return remaining 3 units (Full return)
    const retRes2 = await api("POST", `/sales/${saleId}/return`, ownerToken, {
      items: [{ saleItemId, quantity: 3 }],
      reason: "Defective batch returned in full",
    });
    assert(retRes2.status === 201, "Remaining 3 units returned with 201", retRes2.data);

    // Verify stock is fully restored back to 50
    stockRec = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    assert(stockRec?.current_stock === 50, "Stock fully restored to initial 50 units");

    // Verify customer balance is now 0 (1500 - 1500)
    custRec = await Customer.findByPk(customer.id);
    assert(Number(custRec?.current_balance) === 0, "Customer current_balance is now 0 after full return");

    // Verify sale status is now 'returned'
    updatedSale = await Sale.findByPk(saleId);
    assert(updatedSale?.status === "returned", "Sale status is now 'returned'");
    assert(Number(updatedSale?.returned_amount) === 2500, "Sale returned_amount is 2500");
    assert(Number(updatedSale?.due_amount) === 0, "Sale due_amount is 0");

    // 1E. Cannot return items on an already fully returned sale
    const doneRes = await api("POST", `/sales/${saleId}/return`, ownerToken, {
      items: [{ saleItemId, quantity: 1 }],
    });
    assert(doneRes.status === 400, "Cannot return further on fully returned sale");

    console.log("\n--- Suite 2: B2B Purchase Return Flow ---");

    // Setup Supplier
    const supplier = await Supplier.create({
      owner_id: owner.id,
      shop_id: shop.id,
      name: "Apex Electronics Wholesale",
      phone: "9988776655",
      current_balance: 0,
    });

    // Create a Purchase of 10 units at 200 each = 2000 total (500 paid now, 1500 due)
    const purRes = await api("POST", "/purchases", ownerToken, {
      supplierId: supplier.id,
      paidAmount: 500,
      paymentMethod: "bank_transfer",
      items: [{ productId: product.id, quantity: 10, rate: 200 }],
    });

    assert(purRes.status === 201, "Purchase created with 201", purRes.data);
    const purchaseId = purRes.data.data.id;
    const purchaseItemId = purRes.data.data.items[0].id;

    // Verify stock increased by 10: 50 + 10 = 60
    stockRec = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    assert(stockRec?.current_stock === 60, "Stock increased to 60 after purchase");

    // Verify supplier payable balance is 1500
    let supRec = await Supplier.findByPk(supplier.id);
    assert(Number(supRec?.current_balance) === 1500, "Supplier payable balance is 1500");

    // 2A. Return 4 units to supplier
    const purRetRes = await api("POST", `/purchases/${purchaseId}/return`, ownerToken, {
      items: [{ purchaseItemId, quantity: 4 }],
      reason: "4 units had manufacturing defects",
    });

    assert(purRetRes.status === 201, "Purchase return of 4 units created with 201", purRetRes.data);
    assert(Number(purRetRes.data.data.returnValue) === 800, "Return value is 800 (4 × 200)");

    // Verify stock decreased by 4: 60 - 4 = 56
    stockRec = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    assert(stockRec?.current_stock === 56, "Stock decreased to 56 after returning to supplier");

    // Verify SupplierLedger debit entry (reduces payable)
    const supLedger = await SupplierLedger.findOne({
      where: { supplier_id: supplier.id, reference_type: "PurchaseReturn" },
    });
    assert(supLedger !== null && Number(supLedger.amount) === 800 && supLedger.entry_type === "debit", "SupplierLedger debit of 800 created");

    // Verify supplier payable balance reduced from 1500 to 700 (1500 - 800)
    supRec = await Supplier.findByPk(supplier.id);
    assert(Number(supRec?.current_balance) === 700, "Supplier balance reduced to 700");

    // Verify purchase status & returned_amount
    const updatedPur = await Purchase.findByPk(purchaseId);
    assert(updatedPur?.status === "partially_returned", "Purchase status is partially_returned");
    assert(Number(updatedPur?.returned_amount) === 800, "Purchase returned_amount is 800");
    assert(Number(updatedPur?.due_amount) === 700, "Purchase due_amount is 700");

    console.log("\n--- Suite 3: Customer Portal Return Request ---");

    // Create another sale for customer portal test
    const portalSaleRes = await api("POST", "/sales", ownerToken, {
      customerId: customer.id,
      paymentMethod: "upi",
      paidAmount: 1000,
      items: [{ productId: product.id, quantity: 2, rate: 500 }],
    });
    const portalSaleId = portalSaleRes.data.data.id;
    const portalSaleItemId = portalSaleRes.data.data.items[0].id;

    // Customer requests return via portal
    const custReqRes = await api("POST", `/customer-portal/bills/${portalSaleId}/return-request`, customerToken, {
      items: [{ saleItemId: portalSaleItemId, quantity: 1 }],
      reason: "Received damaged packaging",
    });

    assert(custReqRes.status === 200, "Customer submitted return request with 200", custReqRes.data);
    assert(custReqRes.data.success === true, "Return request reported success");

    // Verify shop owner received return_requested notification
    const ownerNotif = await Notification.findOne({
      where: { recipient_type: "owner", recipient_id: owner.id, type: "return_requested" },
      order: [["id", "DESC"]],
    });
    assert(ownerNotif !== null, "Owner received return_requested notification");
    assert(ownerNotif?.title.includes("Return Request"), "Notification title mentions Return Request");

    // Customer fetches bill detail in portal and verifies returns include
    const portalBillRes = await api("GET", `/customer-portal/bills/${portalSaleId}`, customerToken);
    assert(portalBillRes.status === 200, "Customer can fetch bill details", portalBillRes.data);
    assert(Array.isArray(portalBillRes.data.data.items), "Bill includes items array");

  } finally {
    await stopServer();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
