require("dotenv").config({ path: __dirname + "/../.env" });
const { sequelize, Shop, Customer, EmailNotification } = require("../dist/models");
const {
  getTransporterForShop,
  sendBillEmail,
  sendPaymentReceiptEmail,
  sendOutstandingReminderEmail,
  retryEmailNotification,
} = require("../dist/utils/mailer");

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING CUSTOMER EMAIL NOTIFICATIONS TEST");
  console.log("=================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.\n");

    // 1. Verify SMTP Transporter Connectivity
    console.log("Step 1: Verifying Gmail SMTP configuration for Shop 1...");
    const active = await getTransporterForShop(1);
    if (!active) {
      throw new Error("❌ SMTP transporter not configured for Shop 1!");
    }
    await active.transporter.verify();
    console.log(`✅ SMTP verified! Connected to Gmail as sender: ${active.from || "nsyu.mnt@gmail.com"}\n`);

    // 2. Fetch Customer from Supabase Database
    console.log("Step 2: Fetching test customer from Supabase database...");
    const customer = await Customer.findOne({
      where: { email: "nazim1581994@gmail.com" },
    });
    if (!customer) {
      throw new Error("❌ Test customer with email nazim1581994@gmail.com not found in database!");
    }
    console.log(`✅ Found customer in Supabase: ID=${customer.id}, Name="${customer.name}", Email="${customer.email}", Balance=₹${customer.current_balance}\n`);

    // 3. Test New Bill Notification
    console.log("Step 3: Testing New Bill Notification Email...");
    const testInvoiceNum = `INV-TEST-${Date.now().toString().slice(-4)}`;
    const billResult = await sendBillEmail({
      ownerId: customer.owner_id || 1,
      shopId: 1,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      invoiceNumber: testInvoiceNum,
      totalAmount: 1850.00,
      paidAmount: 850.00,
      dueAmount: 1000.00,
      paymentStatus: "PARTIAL",
      invoiceDate: new Date(),
      items: [
        { productName: "Premium Cotton Fabric 2M", quantity: 2, rate: 450.00, totalAmount: 900.00 },
        { productName: "Silk Embroidery Thread Pack", quantity: 1, rate: 350.00, totalAmount: 350.00 },
        { productName: "Designer Buttons (Set of 12)", quantity: 2, rate: 300.00, totalAmount: 600.00 },
      ],
    });
    console.log("Bill Email Result:", billResult);
    if (!billResult.success) throw new Error("Bill email dispatch failed: " + billResult.error);
    console.log(`✅ New Bill Email dispatched successfully! Log ID: ${billResult.emailNotificationId}\n`);

    // 4. Test Payment Received Confirmation
    console.log("Step 4: Testing Payment Received Confirmation Email...");
    const testReceiptCode = `RCPT-${Date.now().toString().slice(-4)}`;
    const paymentResult = await sendPaymentReceiptEmail({
      ownerId: customer.owner_id || 1,
      shopId: 1,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      receiptCode: testReceiptCode,
      amount: 850.00,
      paymentMethod: "UPI",
      paymentDate: new Date(),
      invoiceNumber: testInvoiceNum,
      currentBalance: 1000.00,
      notes: "GPay payment received with thanks",
    });
    console.log("Payment Receipt Result:", paymentResult);
    if (!paymentResult.success) throw new Error("Payment receipt email dispatch failed: " + paymentResult.error);
    console.log(`✅ Payment Confirmation Email dispatched successfully! Log ID: ${paymentResult.emailNotificationId}\n`);

    // 5. Test Outstanding Payment Reminder Email
    console.log("Step 5: Testing Outstanding Payment Reminder Email...");
    const reminderResult = await sendOutstandingReminderEmail({
      ownerId: customer.owner_id || 1,
      shopId: 1,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      outstandingBalance: 1000.00,
      unpaidBills: [
        {
          invoiceNumber: testInvoiceNum,
          invoiceDate: new Date(),
          totalAmount: 1850.00,
          dueAmount: 1000.00,
        },
      ],
    });
    console.log("Payment Reminder Result:", reminderResult);
    if (!reminderResult.success) throw new Error("Payment reminder email dispatch failed: " + reminderResult.error);
    console.log(`✅ Payment Reminder Email dispatched successfully! Log ID: ${reminderResult.emailNotificationId}\n`);

    // 6. Verify Database Audit History
    console.log("Step 6: Verifying Email Notification History in Supabase DB...");
    const recentLogs = await EmailNotification.findAll({
      where: { customer_id: customer.id },
      order: [["created_at", "DESC"]],
      limit: 3,
    });
    console.log(`Found ${recentLogs.length} recent email notification log records:`);
    recentLogs.forEach((log) => {
      console.log(` - ID: ${log.id} | Type: ${log.notification_type} | To: ${log.recipient_email} | Status: ${log.status} | Attempts: ${log.attempts} | SentAt: ${log.sent_at}`);
    });

    console.log("\n=================================================");
    console.log("🎉 ALL EMAIL NOTIFICATION TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runTests();
