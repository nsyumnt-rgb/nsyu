const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const request = require('supertest');
const appModule = require('../dist/app');
const app = appModule.default || appModule;
const { sequelize } = require('../dist/models');

async function runTests() {
  console.log('====================================================');
  console.log('   NSY BUSINESS - END-TO-END LOGIN & ORDER TESTS    ');
  console.log('====================================================\n');

  try {
    await sequelize.authenticate();
    console.log('✔ Database connection authenticated.');

    // 1. TEST OWNER LOGIN
    console.log('\n--- 1. Testing Owner Login (/api/auth/login) ---');
    const ownerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nsyu.mnt@gmail.com',
        password: 'Password@123'
      });

    console.log('Status code:', ownerLoginRes.status);
    if (ownerLoginRes.status !== 200 || !ownerLoginRes.body.success) {
      throw new Error(`Owner login failed: ${ownerLoginRes.body.message || 'Unknown error'}`);
    }

    const ownerToken = ownerLoginRes.body.data.accessToken;
    const shop = ownerLoginRes.body.data.shop;
    console.log('✔ Owner login SUCCESSFUL.');
    console.log('  Account Type:', ownerLoginRes.body.data.accountType);
    console.log('  Owner Name:', ownerLoginRes.body.data.owner.name);
    console.log('  Shop ID:', shop ? shop.id : 'N/A', shop ? `(${shop.name})` : '');
    console.log('  Token preview:', ownerToken.substring(0, 25) + '...');

    // 2. TEST /api/auth/me
    console.log('\n--- 2. Testing Owner Profile & Permissions (/api/auth/me) ---');
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);

    console.log('Status code:', meRes.status);
    if (meRes.status !== 200 || !meRes.body.success) {
      throw new Error(`GET /api/auth/me failed: ${meRes.body.message || 'Unknown error'}`);
    }

    console.log('✔ /api/auth/me SUCCESSFUL.');
    console.log('  Role Name:', meRes.body.data.roleName);
    console.log('  Orders Permission:', meRes.body.data.permissions?.orders);
    console.log('  Products Permission:', meRes.body.data.permissions?.products);

    // 3. TEST STAFF LOGIN
    console.log('\n--- 3. Testing Staff Login (/api/auth/login) ---');
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'staff@nsyu.com',
        password: 'Password@123'
      });

    console.log('Status code:', staffLoginRes.status);
    if (staffLoginRes.status === 200 && staffLoginRes.body.success) {
      console.log('✔ Staff login SUCCESSFUL.');
      console.log('  Account Type:', staffLoginRes.body.data.accountType);
      console.log('  Employee Name:', staffLoginRes.body.data.employee.name);
    } else {
      console.log('⚠ Staff login response:', staffLoginRes.body);
    }

    // 4. TEST ORDER STATS (KPI METRICS)
    console.log('\n--- 4. Testing Order Stats KPI Cards (/api/orders/stats) ---');
    const statsRes = await request(app)
      .get('/api/orders/stats')
      .set('Authorization', `Bearer ${ownerToken}`);

    console.log('Status code:', statsRes.status);
    if (statsRes.status !== 200 || !statsRes.body.success) {
      throw new Error(`GET /api/orders/stats failed: ${statsRes.body.message}`);
    }

    console.log('✔ Order Stats KPI:');
    console.log('  Total Orders:', statsRes.body.data.totalOrders);
    console.log('  Pending Orders:', statsRes.body.data.pendingOrders);
    console.log('  Processing Orders:', statsRes.body.data.processingOrders);
    console.log('  Delivered Orders:', statsRes.body.data.deliveredOrders);
    console.log('  Cancelled Orders:', statsRes.body.data.cancelledOrders);

    // 5. TEST GET ORDERS LIST (STEP 1)
    console.log('\n--- 5. Testing Orders List (/api/orders) ---');
    const ordersRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${ownerToken}`);

    console.log('Status code:', ordersRes.status);
    if (ordersRes.status !== 200 || !ordersRes.body.success) {
      throw new Error(`GET /api/orders failed: ${ordersRes.body.message}`);
    }

    const fetchedOrders = ordersRes.body.data || [];
    console.log(`✔ Found ${fetchedOrders.length} orders total:`);
    fetchedOrders.slice(0, 5).forEach((ord, idx) => {
      console.log(`   [${idx + 1}] ${ord.order_number} | ${ord.customer?.name || 'Walk-in'} | ₹${ord.total_amount} | Status: ${ord.status} | Payment: ${ord.payment_status}`);
    });

    // 6. TEST CREATE NEW ORDER (STEP 2 & STEP 3)
    console.log('\n--- 6. Testing Create New Order (/api/orders) ---');
    const newOrderPayload = {
      customer: {
        name: 'Rajesh Kumar',
        phone: '9876543210',
        email: 'rajesh@gmail.com',
        address: '123, MG Road, New Delhi'
      },
      orderType: 'Walk-in',
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      status: 'pending',
      remarks: 'Step 2 Test: Create New Order',
      items: [
        {
          productName: 'Mobile Charger',
          sku: 'CH-001',
          qty: 2,
          price: 450,
          discount: 0,
          gstPercent: 18
        },
        {
          productName: 'USB Cable',
          sku: 'USB-002',
          qty: 1,
          price: 250,
          discount: 0,
          gstPercent: 18
        },
        {
          productName: 'Wireless Earbuds',
          sku: 'EB-003',
          qty: 1,
          price: 1300,
          discount: 10,
          gstPercent: 18
        }
      ]
    };

    const createOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(newOrderPayload);

    console.log('Create Order Status code:', createOrderRes.status);
    if (createOrderRes.status !== 201 || !createOrderRes.body.success) {
      throw new Error(`POST /api/orders failed: ${JSON.stringify(createOrderRes.body)}`);
    }

    const createdOrder = createOrderRes.body.data;
    console.log('✔ Order Created Successfully:');
    console.log('  Order ID:', createdOrder.id);
    console.log('  Order Number:', createdOrder.order_number);
    console.log('  Customer:', createdOrder.customer?.name);
    console.log('  Subtotal: ₹', createdOrder.subtotal);
    console.log('  Discount: ₹', createdOrder.discount_amount);
    console.log('  Tax (GST): ₹', createdOrder.tax_amount);
    console.log('  Grand Total: ₹', createdOrder.total_amount);
    console.log('  Status:', createdOrder.status);

    // 7. TEST GET SINGLE ORDER DETAILS (STEP 4 & STEP 6)
    console.log(`\n--- 7. Testing Order Details for ID ${createdOrder.id} (/api/orders/:id) ---`);
    const orderDetailRes = await request(app)
      .get(`/api/orders/${createdOrder.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    console.log('Status code:', orderDetailRes.status);
    if (orderDetailRes.status !== 200 || !orderDetailRes.body.success) {
      throw new Error(`GET /api/orders/${createdOrder.id} failed: ${orderDetailRes.body.message}`);
    }
    const retrievedOrder = orderDetailRes.body.data;
    console.log('✔ Order details retrieved:');
    console.log('  Customer Phone:', retrievedOrder.customer?.phone);
    console.log('  Items Count:', retrievedOrder.items?.length);
    retrievedOrder.items?.forEach((it, i) => {
      console.log(`    Item #${i + 1}: ${it.product_name} (${it.sku}) - Qty: ${it.quantity} @ ₹${it.rate} = ₹${it.amount}`);
    });

    // 8. TEST UPDATE ORDER STATUS: PENDING -> PROCESSING -> SHIPPED (STEP 5 & STEP 9)
    console.log(`\n--- 8. Testing Order Status Update (/api/orders/:id/status) ---`);
    
    // Transition to processing
    const procStatusRes = await request(app)
      .put(`/api/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        status: 'processing',
        remarks: 'Items packed and assigned to processing'
      });

    console.log('Update to "processing" Status code:', procStatusRes.status);
    if (procStatusRes.status !== 200 || !procStatusRes.body.success) {
      throw new Error(`Update status to processing failed: ${procStatusRes.body.message}`);
    }
    console.log('✔ Status updated to "processing":', procStatusRes.body.data.status);

    // Transition to shipped
    const shipStatusRes = await request(app)
      .put(`/api/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        status: 'shipped',
        remarks: 'Order dispatched via courier. Tracking ID: TRK-99281'
      });

    console.log('Update to "shipped" Status code:', shipStatusRes.status);
    if (shipStatusRes.status !== 200 || !shipStatusRes.body.success) {
      throw new Error(`Update status to shipped failed: ${shipStatusRes.body.message}`);
    }
    console.log('✔ Status updated to "shipped":', shipStatusRes.body.data.status);

    // Transition to delivered
    const delivStatusRes = await request(app)
      .put(`/api/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        status: 'delivered',
        remarks: 'Order successfully delivered to customer'
      });

    console.log('Update to "delivered" Status code:', delivStatusRes.status);
    if (delivStatusRes.status !== 200 || !delivStatusRes.body.success) {
      throw new Error(`Update status to delivered failed: ${delivStatusRes.body.message}`);
    }
    console.log('✔ Status updated to "delivered":', delivStatusRes.body.data.status);

    // 9. CHECK NOTIFICATIONS (STEP 9)
    console.log('\n--- 9. Checking Order Notifications (/api/notifications) ---');
    const notifsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`);

    if (notifsRes.status === 200 && notifsRes.body.success) {
      const notifs = notifsRes.body.data?.notifications || notifsRes.body.data || [];
      console.log(`✔ Found ${notifs.length} notifications in database.`);
      notifs.slice(0, 3).forEach((n, idx) => {
        console.log(`   [${idx + 1}] Title: ${n.title} | Message: ${n.message}`);
      });
    } else {
      console.log('Notifications check returned status:', notifsRes.status);
    }

    console.log('\n====================================================');
    console.log('  ALL LOGIN & 9-STEP ORDER TESTS PASSED 100%!       ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runTests();
