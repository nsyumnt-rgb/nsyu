require("dotenv").config({ path: __dirname + "/../.env" });
const { sequelize, EmailNotification } = require("../dist/models");
const { retryEmailNotification, retryAllFailedEmails } = require("../dist/utils/mailer");

async function testRetry() {
  console.log("=================================================");
  console.log("🧪 TESTING EMAIL RETRY & FAILURE HANDLING");
  console.log("=================================================\n");

  try {
    await sequelize.authenticate();

    // 1. Create a simulated failed email record
    console.log("Creating a simulated failed email record in DB...");
    const failedLog = await EmailNotification.create({
      owner_id: 1,
      shop_id: 1,
      customer_id: 17,
      recipient_email: "nazim1581994@gmail.com",
      recipient_name: "Mohd Zakir",
      notification_type: "general",
      subject: "Test Retry Email Notification - NSYU",
      status: "failed",
      attempts: 1,
      max_attempts: 3,
      last_attempt_at: new Date(),
      error_message: "Simulated network timeout during initial attempt",
      payload: {
        textSnippet: "This is a test notification to verify the retry mechanism.",
        htmlBody: "<p>This is a test notification to verify the retry mechanism works perfectly.</p>",
      },
    });

    console.log(`Created failed log ID: ${failedLog.id}`);

    // 2. Execute retry
    console.log(`Invoking retryEmailNotification(${failedLog.id}, 1)...`);
    const retryResult = await retryEmailNotification(failedLog.id, 1);
    console.log("Retry Result:", retryResult);

    if (!retryResult.success) {
      throw new Error("Retry failed: " + retryResult.message);
    }

    // 3. Re-fetch from DB to assert status
    await failedLog.reload();
    console.log(`Updated Log Status in DB: status="${failedLog.status}", attempts=${failedLog.attempts}, sent_at=${failedLog.sent_at}, error_message=${failedLog.error_message}`);

    if (failedLog.status !== "delivered") {
      throw new Error("Log status was not updated to delivered!");
    }

    console.log("\n=================================================");
    console.log("🎉 RETRY & RECOVERY VERIFIED SUCCESSFULLY!");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Retry test failed:", err);
    process.exit(1);
  }
}

testRetry();
