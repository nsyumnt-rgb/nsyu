const {
  sequelize,
  Owner,
  Shop,
  Customer,
  CustomerAccount,
  Product,
  ProductStock,
  CustomerCart,
  CustomerCartItem,
  Order,
  OrderItem,
  OrderStatusHistory,
  Sale,
  SaleItem,
  CustomerLedger,
} = require('../dist/models');
const { signAccessToken } = require('../dist/utils/jwt');
const { setCartItem, getCart } = require('../dist/controllers/customerCartController');
const { placeOrder, listPortalOrders, getPortalOrder } = require('../dist/controllers/customerOrderController');
const { updateOrderStatus, convertOrderToBill } = require('../dist/controllers/orderController');
const { listPortalLedger, listPortalBills } = require('../dist/controllers/customerFinancialsController');

function createMockReqRes({ auth, customer, params = {}, body = {}, query = {} }) {
  const req = {
    auth,
    customer,
    params,
    body,
    query,
    headers: {},
    ip: '127.0.0.1',
  };
  let statusCode = 200;
  let jsonResult = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };
  return { req, res, getResult: () => ({ statusCode, jsonResult }) };
}

(async () => {
  console.log('===============================================================');
  console.log('  NSYU - FULL END-TO-END CYCLE AUTOMATED VERIFICATION TEST     ');
  console.log('===============================================================\n');

  try {
    // ------------------------------------------------------------------------
    // STEP 1: Verify Customer Account & Owner in Supabase
    // ------------------------------------------------------------------------
    console.log('📍 STEP 1: Setting up Test Customer and Shop');
    const customerAccount = await CustomerAccount.findByPk(8, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Shop, as: 'shop' },
      ],
    });

    if (!customerAccount || !customerAccount.customer) {
      throw new Error('Test customer account ID 8 not found in database');
    }

    const customer = customerAccount.customer;
    const shop = customerAccount.shop;
    console.log(`   Customer: ${customer.name} (Phone: ${customer.phone}, ID: ${customer.id})`);
    console.log(`   Shop: ${shop.name} (ID: ${shop.id}, Owner ID: ${shop.owner_id})\n`);

    const customerContext = {
      customerId: customer.id,
      shopId: shop.id,
      ownerId: shop.owner_id,
      accountId: customerAccount.id,
      phone: customer.phone,
    };

    const ownerAuth = {
      ownerId: shop.owner_id,
      shopId: shop.id,
      isOwner: true,
      roleCode: 'owner',
      roleName: 'Owner',
    };

    // ------------------------------------------------------------------------
    // STEP 2: Customer Browses Products & Adds to Cart
    // ------------------------------------------------------------------------
    console.log('📍 STEP 2: Customer Adding Products to Cart');
    const product1 = await Product.findByPk(35); // ERD BT-11, ₹95
    const product2 = await Product.findByPk(36); // ERD BT-12, ₹115

    if (!product1 || !product2) {
      throw new Error('Test products 35 and 36 not found');
    }

    // Clear any previous cart items for a clean test
    await CustomerCartItem.destroy({
      where: {
        cart_id: (
          await CustomerCart.findOrCreate({
            where: { customer_id: customer.id, shop_id: shop.id },
            defaults: { owner_id: shop.owner_id, customer_id: customer.id, shop_id: shop.id },
          })
        )[0].id,
      },
    });

    // Add 2 of Product 1 (2 * 95 = 190)
    const cartReq1 = createMockReqRes({
      customer: customerContext,
      params: { productId: String(product1.id) },
      body: { quantity: 2 },
    });
    await setCartItem(cartReq1.req, cartReq1.res);
    console.log(`   + Added 2x ${product1.name} (₹${product1.selling_price}/unit) -> ₹${2 * Number(product1.selling_price)}`);

    // Add 1 of Product 2 (1 * 115 = 115)
    const cartReq2 = createMockReqRes({
      customer: customerContext,
      params: { productId: String(product2.id) },
      body: { quantity: 1 },
    });
    await setCartItem(cartReq2.req, cartReq2.res);
    console.log(`   + Added 1x ${product2.name} (₹${product2.selling_price}/unit) -> ₹${1 * Number(product2.selling_price)}`);

    const expectedTotal = 2 * Number(product1.selling_price) + 1 * Number(product2.selling_price);
    console.log(`   Expected Order Total: ₹${expectedTotal}\n`);

    // ------------------------------------------------------------------------
    // STEP 3: Customer Places the Order
    // ------------------------------------------------------------------------
    console.log('📍 STEP 3: Customer Placing Order');
    const placeReq = createMockReqRes({
      customer: customerContext,
      body: {
        clientRequestId: `test_cycle_${Date.now()}`,
        note: 'Full cycle automated verification order',
        deliveryType: 'standard',
        shippingAddress: customer.address || 'H 33 Vaishali',
      },
    });

    await placeOrder(placeReq.req, placeReq.res);
    const placeResult = placeReq.getResult();
    if (placeResult.statusCode !== 201 && placeResult.statusCode !== 200) {
      throw new Error(`Order placement failed: ${JSON.stringify(placeResult.jsonResult)}`);
    }

    const createdOrder = placeResult.jsonResult.data;
    console.log(`   ✅ Order Placed Successfully!`);
    console.log(`   Order ID: ${createdOrder.id}`);
    console.log(`   Order Number: ${createdOrder.order_number}`);
    console.log(`   Initial Status: ${createdOrder.status}`);
    console.log(`   Total Amount: ₹${createdOrder.total_amount}\n`);

    if (createdOrder.status.toLowerCase() !== 'pending') {
      throw new Error(`Expected initial status 'pending', got '${createdOrder.status}'`);
    }

    // ------------------------------------------------------------------------
    // STEP 4: Owner Reviews & Confirms Order (pending -> confirmed)
    // ------------------------------------------------------------------------
    console.log('📍 STEP 4: Owner Progressing Order (pending -> confirmed)');
    const confirmReq = createMockReqRes({
      auth: ownerAuth,
      params: { id: String(createdOrder.id) },
      body: { status: 'confirmed', remarks: 'Order verified and accepted by owner' },
    });
    await updateOrderStatus(confirmReq.req, confirmReq.res);
    const confirmResult = confirmReq.getResult();
    console.log(`   Status updated: ${confirmResult.jsonResult.data?.status}`);

    if (confirmResult.jsonResult.data?.status.toLowerCase() !== 'confirmed') {
      throw new Error(`Failed to update status to confirmed: ${JSON.stringify(confirmResult.jsonResult)}`);
    }

    // STEP 4b: Test Requirement: Attempting to convert while 'confirmed' MUST fail
    console.log('   🧪 Validation Check: Converting un-delivered order to bill must be blocked...');
    const invalidConvertReq = createMockReqRes({
      auth: ownerAuth,
      params: { id: String(createdOrder.id) },
      body: { paidAmount: expectedTotal, paymentMethod: 'cash' },
    });
    await convertOrderToBill(invalidConvertReq.req, invalidConvertReq.res);
    const invalidConvertRes = invalidConvertReq.getResult();
    console.log(`   HTTP Code: ${invalidConvertRes.statusCode} (${invalidConvertRes.jsonResult?.message})`);
    if (invalidConvertRes.statusCode !== 400) {
      throw new Error('Order conversion did NOT reject un-delivered order!');
    }
    console.log('   ✅ Correctly blocked conversion before delivery.\n');

    // ------------------------------------------------------------------------
    // STEP 5: Owner Marks Order as Delivered (confirmed -> delivered)
    // ------------------------------------------------------------------------
    console.log('📍 STEP 5: Owner Updating Status (confirmed -> delivered)');
    const deliverReq = createMockReqRes({
      auth: ownerAuth,
      params: { id: String(createdOrder.id) },
      body: { status: 'delivered', remarks: 'Items handed over to customer' },
    });
    await updateOrderStatus(deliverReq.req, deliverReq.res);
    const deliverResult = deliverReq.getResult();
    console.log(`   Status updated: ${deliverResult.jsonResult.data?.status}`);

    if (deliverResult.jsonResult.data?.status.toLowerCase() !== 'delivered') {
      throw new Error(`Failed to update status to delivered: ${JSON.stringify(deliverResult.jsonResult)}`);
    }
    console.log('   ✅ Order is now DELIVERED and ready for billing conversion.\n');

    // ------------------------------------------------------------------------
    // STEP 6: Convert Order to Bill (Strictly One Time) with Full Payment
    // ------------------------------------------------------------------------
    console.log('📍 STEP 6: Converting Order to Bill with Full Payment');
    const prevBalance = Number(customer.current_balance || 0);
    console.log(`   Customer Current Balance before conversion: ₹${prevBalance}`);

    const convertReq = createMockReqRes({
      auth: ownerAuth,
      params: { id: String(createdOrder.id) },
      body: {
        paidAmount: expectedTotal, // Full payment
        paymentMethod: 'cash',
        notes: 'Full payment on delivery',
      },
    });

    await convertOrderToBill(convertReq.req, convertReq.res);
    const convertResult = convertReq.getResult();
    if (convertResult.statusCode !== 200 && convertResult.statusCode !== 201) {
      throw new Error(`Conversion failed: ${JSON.stringify(convertResult.jsonResult)}`);
    }

    const conversionData = convertResult.jsonResult.data;
    const generatedSale = conversionData.bill || conversionData.sale;
    console.log(`   ✅ Bill Generated Successfully!`);
    console.log(`   Invoice Number: ${generatedSale.invoice_number}`);
    console.log(`   Payment Status: ${generatedSale.payment_status}`);
    console.log(`   Total Amount: ₹${generatedSale.total_amount}`);
    console.log(`   Paid Amount: ₹${generatedSale.paid_amount}`);
    console.log(`   Due Amount: ₹${generatedSale.due_amount}`);
    console.log(`   Order Status after conversion: ${conversionData.order.status}\n`);

    if (generatedSale.payment_status !== 'PAID') {
      throw new Error(`Expected payment_status 'PAID', got '${generatedSale.payment_status}'`);
    }
    if (Number(generatedSale.due_amount) !== 0) {
      throw new Error(`Expected due_amount 0, got ${generatedSale.due_amount}`);
    }

    // ------------------------------------------------------------------------
    // STEP 7: Strict One-Time Conversion Check (Duplicate Prevention)
    // ------------------------------------------------------------------------
    console.log('📍 STEP 7: Testing Duplicate Conversion Prevention (Strictly One Time)');
    const dupConvertReq = createMockReqRes({
      auth: ownerAuth,
      params: { id: String(createdOrder.id) },
      body: { paidAmount: expectedTotal, paymentMethod: 'cash' },
    });
    await convertOrderToBill(dupConvertReq.req, dupConvertReq.res);
    const dupResult = dupConvertReq.getResult();
    console.log(`   Duplicate Conversion HTTP Status: ${dupResult.statusCode}`);
    console.log(`   Response Message: "${dupResult.jsonResult?.message}"`);

    if (dupResult.statusCode !== 409) {
      throw new Error('Duplicate order conversion was NOT blocked with 409 Conflict!');
    }
    console.log('   ✅ Duplicate conversion strictly blocked!\n');

    // ------------------------------------------------------------------------
    // STEP 8: Customer Ledger & Running Balance Verification
    // ------------------------------------------------------------------------
    console.log('📍 STEP 8: Customer Ledger Verification');
    const updatedCustomer = await Customer.findByPk(customer.id);
    const newBalance = Number(updatedCustomer.current_balance || 0);
    console.log(`   Customer Current Balance after full payment: ₹${newBalance}`);

    // Since this bill was fully paid (₹305 debit, ₹305 credit), outstanding balance change must be 0!
    const balanceChange = newBalance - prevBalance;
    console.log(`   Net Outstanding Change for this Bill: ₹${balanceChange}`);
    if (Math.abs(balanceChange) > 0.01) {
      throw new Error(`Expected outstanding change of ₹0 for fully paid bill, got ₹${balanceChange}`);
    }
    console.log('   ✅ Outstanding balance unchanged (₹0 net change for full payment)!\n');

    // ------------------------------------------------------------------------
    // STEP 9: Customer Portal Verification (Orders, Ledger, Bills)
    // ------------------------------------------------------------------------
    console.log('📍 STEP 9: Customer Portal Screens Verification');

    // 9a: Check Customer Orders list
    const custOrdersReq = createMockReqRes({ customer: customerContext });
    await listPortalOrders(custOrdersReq.req, custOrdersReq.res);
    const portalOrders = custOrdersReq.getResult().jsonResult.data || [];
    const myOrder = portalOrders.find((o) => o.id === createdOrder.id);
    console.log(`   Portal Order Status: ${myOrder?.status} (Linked Bill ID: ${myOrder?.converted_sale_id || myOrder?.billed_bill_id})`);
    if (!myOrder || myOrder.status.toLowerCase() !== 'billed') {
      throw new Error('Order does not show as BILLED in customer portal!');
    }

    // 9b: Check Customer Ledger
    const custLedgerReq = createMockReqRes({ customer: customerContext });
    await listPortalLedger(custLedgerReq.req, custLedgerReq.res);
    const ledgerData = custLedgerReq.getResult().jsonResult.data;
    const recentTx = (ledgerData.transactions || []).slice(0, 2);
    console.log(`   Portal Ledger Outstanding Balance: ₹${ledgerData.outstandingBalance}`);
    console.log(`   Recent Ledger Transactions:`);
    for (const tx of recentTx) {
      console.log(`     - [${tx.type}] ${tx.description} | Debit: ₹${tx.debit} | Credit: ₹${tx.credit} | Balance: ₹${tx.running_balance}`);
    }

    // 9c: Check Customer Bills list
    const custBillsReq = createMockReqRes({ customer: customerContext });
    await listPortalBills(custBillsReq.req, custBillsReq.res);
    const billsList = custBillsReq.getResult().jsonResult.data || [];
    const myBill = billsList.find((b) => b.id === generatedSale.id || b.invoice_number === generatedSale.invoice_number);
    console.log(`   Portal Bill Found: Invoice #${myBill?.invoice_number} | Status: ${myBill?.payment_status} | Due: ₹${myBill?.due_amount}`);

    if (!myBill) {
      throw new Error('Generated bill not found in customer portal bills list!');
    }

    console.log('\n===============================================================');
    console.log('  🎉 FULL CYCLE TEST COMPLETED AND VERIFIED 100% SUCCESSFULLY! ');
    console.log('===============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ FULL CYCLE TEST FAILED:', err);
    process.exit(1);
  }
})();
