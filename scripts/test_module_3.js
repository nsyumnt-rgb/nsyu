const path = require("path");
const request = require(path.join(__dirname, "../api/node_modules/supertest"));

const app = require("../api/dist/app").default;
const {
  sequelize,
  Owner,
  Shop,
  Product,
  ProductStock,
  Customer,
  Sale,
  Payment,
  CustomerLedger,
  Order,
  OrderItem,
  StatusHistory,
} = require("../api/dist/models");

async function runTest() {
  console.log("🧪 Starting Module 3 Core Transactional Logic Verification Test...\n");
  try {
    await sequelize.authenticate();
    console.log("✔ Database connection established.");

    // 1. Login as Owner
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "nsyu.mnt@gmail.com", password: "Password@123" });

    if (loginRes.status !== 200 || !loginRes.body.data?.accessToken) {
      throw new Error(`Owner login failed: ${loginRes.status}`);
    }
    const token = loginRes.body.data.accessToken;
    const ownerId = loginRes.body.data.owner.id;
    const shopId = loginRes.body.data.shop.id;
    console.log(`✔ Owner logged in (Owner ID: ${ownerId}, Shop ID: ${shopId})`);

    // Find or create test customer
    let customer = await Customer.findOne({ where: { owner_id: ownerId } });
    if (!customer) {
      customer = await Customer.create({
        owner_id: ownerId,
        name: "Test Customer M3",
        phone: "9876543210",
        current_balance: 0,
      });
    }
    const initialCustomerBalance = Number(customer.current_balance);
    console.log(`✔ Using Customer: ${customer.name} (Balance: ₹${initialCustomerBalance})`);

    // Find a test product
    const product = await Product.findOne({ where: { owner_id: ownerId } });
    if (!product) throw new Error("No product found in DB to test");

    let stockRecord = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shopId } });
    if (!stockRecord) {
      stockRecord = await ProductStock.create({
        owner_id: ownerId,
        shop_id: shopId,
        product_id: product.id,
        current_stock: 50,
      });
    }
    const initialStock = Number(stockRecord.current_stock);
    console.log(`✔ Using Product: "${product.name}" (Current Stock: ${initialStock}, Price: ₹${product.selling_price})`);

    // TEST 1: Single-Transaction Bill Creation with Partial Payment
    console.log("\n--- TEST 1: Single-Transaction Bill Creation ---");
    const billQty = 2;
    const billUnitPrice = 100;
    const billTotal = billQty * billUnitPrice; // ₹200
    const partialPaid = 80; // ₹80 paid, ₹120 due

    const createBillRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: billQty, rate: billUnitPrice }],
        paymentMethod: "cash",
        paidAmount: partialPaid,
        notes: "Automated Module 3 Verification Bill",
      });

    if (createBillRes.status !== 201 && createBillRes.status !== 200) {
      throw new Error(`Create bill failed: ${createBillRes.status} ${JSON.stringify(createBillRes.body)}`);
    }

    const createdSale = createBillRes.body.data;
    console.log(`✔ Bill created: #${createdSale.invoice_number} (Total: ₹${createdSale.total_amount}, Paid: ₹${createdSale.paid_amount}, Due: ₹${createdSale.due_amount})`);

    // Verify stock was deducted by billQty
    await stockRecord.reload();
    console.log(`✔ Stock updated: ${initialStock} -> ${stockRecord.current_stock} (Deducted: ${initialStock - stockRecord.current_stock})`);
    if (Number(stockRecord.current_stock) !== initialStock - billQty) {
      throw new Error(`Stock deduction mismatch! Expected ${initialStock - billQty}, got ${stockRecord.current_stock}`);
    }

    // Verify Customer Balance updated: +due
    await customer.reload();
    const expectedBalanceAfterBill = initialCustomerBalance + (Number(createdSale.total_amount) - partialPaid);
    console.log(`✔ Customer balance: ₹${initialCustomerBalance} -> ₹${customer.current_balance} (Expected: ₹${expectedBalanceAfterBill})`);
    if (Math.abs(Number(customer.current_balance) - expectedBalanceAfterBill) > 0.01) {
      throw new Error(`Customer balance mismatch! Expected ₹${expectedBalanceAfterBill}, got ₹${customer.current_balance}`);
    }

    // TEST 2: Overpayment Prevention
    console.log("\n--- TEST 2: Overpayment Prevention ---");
    const remainingDue = Number(createdSale.due_amount);
    const overpayAmount = remainingDue + 50;
    const overpayRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId: customer.id,
        saleId: createdSale.id,
        amount: overpayAmount,
        method: "cash",
      });

    if (overpayRes.status !== 400) {
      throw new Error(`Overpayment security flaw! Expected 400, got ${overpayRes.status}`);
    }
    console.log(`✔ Overpayment of ₹${overpayAmount} on ₹${remainingDue} due strictly rejected with 400: "${overpayRes.body.message}"`);

    // TEST 3: Exact Payment of Remaining Due
    console.log("\n--- TEST 3: Exact Remaining Payment ---");
    const exactPayRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId: customer.id,
        saleId: createdSale.id,
        amount: remainingDue,
        method: "cash",
      });

    if (exactPayRes.status !== 200 && exactPayRes.status !== 201) {
      throw new Error(`Exact payment failed: ${exactPayRes.status} ${JSON.stringify(exactPayRes.body)}`);
    }

    const reloadedSale = await Sale.findByPk(createdSale.id);
    console.log(`✔ Payment accepted. Bill status: "${reloadedSale.status}", Paid: ₹${reloadedSale.paid_amount}, Due: ₹${reloadedSale.due_amount}`);
    if (reloadedSale.status !== "paid" || Number(reloadedSale.due_amount) !== 0) {
      throw new Error(`Sale should be marked "paid" with 0 due! Got ${reloadedSale.status}`);
    }

    // TEST 4: Bill Cancellation, Stock Reversal & Status History
    console.log("\n--- TEST 4: Bill Cancellation, Stock Reversal & Ledger Math ---");
    const cancelRes = await request(app)
      .post(`/api/sales/${createdSale.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Testing automated cancellation & reversal" });

    if (cancelRes.status !== 200) {
      throw new Error(`Cancel bill failed: ${cancelRes.status} ${JSON.stringify(cancelRes.body)}`);
    }
    console.log(`✔ Bill #${createdSale.invoice_number} successfully cancelled!`);

    // Verify Stock Restored
    await stockRecord.reload();
    console.log(`✔ Stock restored: ${stockRecord.current_stock} (Initial: ${initialStock})`);
    if (Number(stockRecord.current_stock) !== initialStock) {
      throw new Error(`Stock not fully restored! Expected ${initialStock}, got ${stockRecord.current_stock}`);
    }

    // Verify Payments marked reversed
    const paymentsForSale = await Payment.findAll({ where: { sale_id: createdSale.id } });
    const allReversed = paymentsForSale.every((p) => p.status === "reversed");
    console.log(`✔ Attached payments count: ${paymentsForSale.length}, All marked reversed: ${allReversed}`);
    if (!allReversed) {
      throw new Error("Attached payments were not marked 'reversed'!");
    }

    // Verify Customer balance returned to original
    await customer.reload();
    console.log(`✔ Customer balance after cancellation: ₹${customer.current_balance} (Initial: ₹${initialCustomerBalance})`);
    if (Math.abs(Number(customer.current_balance) - initialCustomerBalance) > 0.01) {
      throw new Error(`Customer balance did not return to initial! Expected ₹${initialCustomerBalance}, got ₹${customer.current_balance}`);
    }

    // Verify Status History logged
    const statusLogs = await StatusHistory.findAll({
      where: { entity_type: "bill", entity_id: createdSale.id },
      order: [["created_at", "DESC"]],
    });
    console.log(`✔ Status history recorded: ${statusLogs.length} entry(ies) found. Latest new_status: "${statusLogs[0]?.new_status}"`);
    if (!statusLogs.length || statusLogs[0].new_status !== "cancelled") {
      throw new Error("StatusHistory entry for cancellation was not found!");
    }

    // Double cancellation prevention
    const doubleCancelRes = await request(app)
      .post(`/api/sales/${createdSale.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Attempt double cancellation" });

    if (doubleCancelRes.status !== 400) {
      throw new Error(`Double cancellation allowed! Expected 400, got ${doubleCancelRes.status}`);
    }
    console.log(`✔ Double cancellation strictly rejected with 400: "${doubleCancelRes.body.message}"`);

    // TEST 5: Order Conversion to Bill
    console.log("\n--- TEST 5: Order Conversion to Bill with billed_bill_id ---");
    const orderNumber = `ORD-${Date.now()}`;
    const order = await Order.create({
      owner_id: ownerId,
      shop_id: shopId,
      customer_id: customer.id,
      order_number: orderNumber,
      order_date: new Date(),
      subtotal: 150,
      total_amount: 150,
      advance_amount: 50,
      status: "pending",
    });

    await OrderItem.create({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      sku: product.sku || "TEST-SKU",
      quantity: 1,
      unit_price: 150,
      total_amount: 150,
    });

    const convertRes = await request(app)
      .post(`/api/orders/${order.id}/convert`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paidAmount: 50, paymentMethod: "cash" });

    if (convertRes.status !== 200) {
      throw new Error(`Convert order failed: ${convertRes.status} ${JSON.stringify(convertRes.body)}`);
    }

    await order.reload();
    console.log(`✔ Order #${order.order_number} converted. Status: "${order.status}", billed_bill_id: ${order.billed_bill_id}`);
    if (!order.billed_bill_id || order.status !== "converted_to_bill") {
      throw new Error("Order was not updated with billed_bill_id!");
    }

    console.log("\n🎉 ALL MODULE 3 TRANSACTIONAL LOGIC TESTS PASSED 100%!");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runTest();
