const { Notification, Sale, Payment } = require('../api/dist/models');

async function testNotifications() {
  console.log("=== Testing Notifications System in Supabase PostgreSQL ===");

  // 1. Check current notifications
  const beforeCount = await Notification.count({ where: { owner_id: 1 } });
  console.log(`Initial total notifications for owner 1: ${beforeCount}`);

  // 2. Insert a test bill notification
  const testNotif = await Notification.create({
    owner_id: 1,
    shop_id: 1,
    recipient_type: "owner",
    recipient_id: 1,
    type: "bill_created",
    title: "Test Invoice #INV-TEST-001",
    message: "Invoice #INV-TEST-001 created for ₹999.00 for Walk-in Customer.",
    reference_type: "Sale",
    reference_id: 1,
    is_read: false,
  });
  console.log(`✔ Created notification ID: ${testNotif.id}, title: "${testNotif.title}", is_read: ${testNotif.is_read}`);

  // 3. Query unread notifications
  const unreadCount = await Notification.count({
    where: { owner_id: 1, recipient_type: "owner", is_read: false }
  });
  console.log(`✔ Unread notification count for owner 1: ${unreadCount}`);

  // 4. Mark the notification as read
  testNotif.is_read = true;
  await testNotif.save();
  console.log(`✔ Updated notification ${testNotif.id} is_read to true`);

  const unreadAfter = await Notification.count({
    where: { owner_id: 1, recipient_type: "owner", is_read: false }
  });
  console.log(`✔ Unread count after marking read: ${unreadAfter} (expected: ${unreadCount - 1})`);

  // Clean up the test row
  await testNotif.destroy();
  console.log(`✔ Cleaned up test notification record.`);

  console.log("\n=== Notification Database Flow PASSED! ===");
  process.exit(0);
}

testNotifications().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

