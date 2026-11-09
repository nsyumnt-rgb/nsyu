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
  Order,
  OrderItem,
  StatusHistory,
  PlatformAuditLog,
} = require("../api/dist/models");

async function runComprehensiveVerification() {
  console.log("================================================================================");
  console.log("🎯 NSYU SHOP MANAGEMENT SYSTEM (SMS) - COMPREHENSIVE INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✔ Database connection pool established with Supabase PostgreSQL.\n");

    // =========================================================================
    // SCENARIO 1: SUPER ADMIN PERMISSIONS & STRICT SECURITY BOUNDARIES
    // =========================================================================
    console.log("--- SCENARIO 1: Super Admin Permissions & Security Boundary ---");
    const superAdminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "superadmin@nsyu.com", password: "SuperAdmin@123" });

    if (superAdminLogin.status !== 200 || !superAdminLogin.body.data?.accessToken) {
      throw new Error(`Super Admin login failed: ${superAdminLogin.status}`);
    }
    const superAdminToken = superAdminLogin.body.data.accessToken;
    console.log("✔ Super Admin authenticated successfully (Role: super_admin)");

    // 1.1 Verify Super Admin has access to Platform Dashboard
    const adminDashRes = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${superAdminToken}`);
    if (adminDashRes.status !== 200) {
      throw new Error(`Super Admin dashboard access failed: ${adminDashRes.status}`);
    }
    console.log("✔ Super Admin accessed /api/admin/dashboard (Real DB metrics returned)");

    // 1.2 Verify Super Admin CANNOT perform transactional writes (Bill Creation)
    const product = await Product.findOne();
    const customer = await Customer.findOne();
    if (!product || !customer) throw new Error("Product or Customer missing for test");

    const superAdminWriteRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 1, rate: 100 }],
        paidAmount: 100,
        paymentMethod: "cash",
      });

    // Super Admin must NOT be allowed to create bills (either 400 No shop / 403 / RLS block)
    if (superAdminWriteRes.status === 201) {
      throw new Error("Security violation! Super Admin was able to create a bill directly!");
    }
    console.log(`✔ Super Admin transactional write strictly prevented (Status: ${superAdminWriteRes.status})`);

    // =========================================================================
    // SCENARIO 2: MULTI-TENANT ISOLATION & SUSPENDED SHOP GATE
    // =========================================================================
    console.log("\n--- SCENARIO 2: Multi-Tenant Isolation & Suspended Shop Gate ---");
    const shop = await Shop.findOne({ where: { status: "active" } });
    if (!shop) throw new Error("No active shop found to test suspension");

    console.log(`Testing with Shop ID ${shop.id} ("${shop.name}")`);

    // 2.1 Suspend the shop via Super Admin API
    const suspendRes = await request(app)
      .patch(`/api/admin/shops/${shop.id}/status`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ status: "suspended", reason: "Automated test suspension" });

    if (suspendRes.status !== 200) {
      throw new Error(`Failed to suspend shop: ${suspendRes.status}`);
    }
    console.log("✔ Shop suspended via /api/admin/shops/:id/status");

    // 2.2 Verify Owner of suspended shop is blocked from login
    const owner = await Owner.findByPk(shop.owner_id);
    const blockedLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: owner.email, password: "Password@123" });

    if (blockedLoginRes.status !== 403) {
      throw new Error(`Suspended shop gate failure! Expected 403, got ${blockedLoginRes.status}`);
    }
    console.log(`✔ Suspended shop user login blocked with 403: "${blockedLoginRes.body.message}"`);

    // 2.3 Reactivate shop
    const activateRes = await request(app)
      .patch(`/api/admin/shops/${shop.id}/status`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ status: "active", reason: "Automated test reactivation" });

    if (activateRes.status !== 200) {
      throw new Error(`Failed to reactivate shop: ${activateRes.status}`);
    }
    console.log("✔ Shop reactivated successfully");

    // 2.4 Verify Owner login succeeds now
    const unblockedLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: owner.email, password: "Password@123" });

    if (unblockedLoginRes.status !== 200) {
      throw new Error(`Owner login after reactivation failed: ${unblockedLoginRes.status}`);
    }
    const ownerToken = unblockedLoginRes.body.data.accessToken;
    console.log("✔ Owner access fully restored after reactivation!");

    // 2.5 Verify regular owner CANNOT access /api/admin/*
    const ownerForbiddenRes = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${ownerToken}`);
    if (ownerForbiddenRes.status !== 403) {
      throw new Error(`Owner was not forbidden from /api/admin/dashboard: ${ownerForbiddenRes.status}`);
    }
    console.log("✔ Regular Owner strictly rejected from /api/admin/* with 403 Forbidden");

    // =========================================================================
    // SCENARIO 3: BILLING, OVERPAYMENT, CANCELLATION & LEDGER MATH
    // =========================================================================
    console.log("\n--- SCENARIO 3: Transactional Billing, Overpayment & Cancellation ---");
    let stock = await ProductStock.findOne({ where: { product_id: product.id, shop_id: shop.id } });
    if (!stock) {
      stock = await ProductStock.create({
        owner_id: shop.owner_id,
        shop_id: shop.id,
        product_id: product.id,
        current_stock: 20,
      });
    }
    const stockBefore = Number(stock.current_stock);
    await customer.reload();
    const balanceBefore = Number(customer.current_balance);

    // Create bill
    const billRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 1, rate: 100 }],
        paidAmount: 50,
        paymentMethod: "cash",
      });

    if (billRes.status !== 200 && billRes.status !== 201) {
      throw new Error(`Create bill failed: ${billRes.status}`);
    }
    const sale = billRes.body.data;
    console.log(`✔ Bill created: #${sale.invoice_number} (Total: ₹${sale.total_amount}, Paid: ₹${sale.paid_amount}, Due: ₹${sale.due_amount})`);

    // Verify stock deducted by 1
    await stock.reload();
    if (Number(stock.current_stock) !== stockBefore - 1) {
      throw new Error("Stock was not deducted by 1!");
    }
    console.log(`✔ Stock accurately deducted: ${stockBefore} -> ${stock.current_stock}`);

    // Overpayment prevention
    const overpayRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        customerId: customer.id,
        saleId: sale.id,
        amount: Number(sale.due_amount) + 100,
        method: "cash",
      });
    if (overpayRes.status !== 400) {
      throw new Error(`Overpayment allowed! Got ${overpayRes.status}`);
    }
    console.log(`✔ Overpayment prevention verified: rejected with 400`);

    // Cancel the bill
    const cancelRes = await request(app)
      .post(`/api/sales/${sale.id}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reason: "Integration test cancellation" });

    if (cancelRes.status !== 200) {
      throw new Error(`Cancel failed: ${cancelRes.status}`);
    }
    console.log(`✔ Bill #${sale.invoice_number} cancelled successfully`);

    // Verify stock restored
    await stock.reload();
    if (Number(stock.current_stock) !== stockBefore) {
      throw new Error(`Stock not restored! Expected ${stockBefore}, got ${stock.current_stock}`);
    }
    console.log(`✔ Stock restored to original value: ${stock.current_stock}`);

    // Verify customer balance restored
    await customer.reload();
    if (Math.abs(Number(customer.current_balance) - balanceBefore) > 0.01) {
      throw new Error(`Balance not restored! Expected ${balanceBefore}, got ${customer.current_balance}`);
    }
    console.log(`✔ Customer ledger balance restored to initial value: ₹${customer.current_balance}`);

    // Verify status history recorded
    const historyEntries = await StatusHistory.findAll({
      where: { entity_type: "bill", entity_id: sale.id },
    });
    if (!historyEntries.length) {
      throw new Error("StatusHistory entry was not recorded for cancelled bill!");
    }
    console.log(`✔ Status history confirmed: ${historyEntries.length} log(s) captured`);

    // =========================================================================
    // SCENARIO 4: ORDER CONVERSION WITH BILLED_BILL_ID
    // =========================================================================
    console.log("\n--- SCENARIO 4: Order Conversion to Bill with billed_bill_id ---");
    const order = await Order.create({
      owner_id: shop.owner_id,
      shop_id: shop.id,
      customer_id: customer.id,
      order_number: `ORD-TEST-${Date.now()}`,
      order_date: new Date(),
      subtotal: 100,
      total_amount: 100,
      advance_amount: 25,
      status: "pending",
    });

    await OrderItem.create({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      sku: product.sku || "SKU-TEST",
      quantity: 1,
      unit_price: 100,
      total_amount: 100,
    });

    const convertRes = await request(app)
      .post(`/api/orders/${order.id}/convert`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ paidAmount: 25, paymentMethod: "cash" });

    if (convertRes.status !== 200) {
      throw new Error(`Order conversion failed: ${convertRes.status}`);
    }

    await order.reload();
    if (!order.billed_bill_id || order.status !== "converted_to_bill") {
      throw new Error(`Order not properly linked! Status: ${order.status}, billed_bill_id: ${order.billed_bill_id}`);
    }
    console.log(`✔ Order #${order.order_number} converted. Status: "${order.status}", billed_bill_id: ${order.billed_bill_id}`);

    // =========================================================================
    // SCENARIO 5: PLATFORM AUDIT LOGGING
    // =========================================================================
    console.log("\n--- SCENARIO 5: Platform Audit Log Validation ---");
    const auditRes = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${superAdminToken}`);

    if (auditRes.status !== 200) {
      throw new Error(`Failed to fetch platform audit logs: ${auditRes.status}`);
    }
    const auditLogs = auditRes.body.data.logs;
    console.log(`✔ Platform audit logs verified: ${auditLogs.length} recent entries recorded`);
    const suspendAction = auditLogs.find((l) => l.action === "SUSPEND_SHOP" || l.action === "ACTIVATE_SHOP");
    if (!suspendAction) {
      throw new Error("Audit log for shop suspension/activation was not found!");
    }
    console.log(`✔ Found verified audit entry: [${suspendAction.action}] on target "${suspendAction.target_name}" by ${suspendAction.super_admin_email}`);

    console.log("\n================================================================================");
    console.log("🎉 ALL INTEGRATION TEST SCENARIOS PASSED WITH 100% SUCCESS!");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("\n❌ Integration test failed:", err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runComprehensiveVerification();

