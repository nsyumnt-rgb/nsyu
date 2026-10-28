import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { sequelize } from "./models";
import { seedDemoData } from "./seed/seed";

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Dev-only convenience. In production, use proper Sequelize
    // migrations (sequelize-cli) instead of sync({ alter: true }).
    if (process.env.SYNC_DB === "true") {
      await sequelize.sync({ alter: true });
      console.log("✅ Models synced");
    }

    // Automatic demo/dev data seeding — see src/seed/. Gated by BOTH
    // NODE_ENV !== "production" AND ENABLE_DEMO_SEED=true, and the
    // seed itself is idempotent (checks for the demo owner before
    // creating anything), so this is safe to leave on across restarts.
    // A failure here is logged but never crashes the server — the API
    // is still usable without demo data.
    if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_SEED === "true") {
      try {
        await seedDemoData();
      } catch (seedErr) {
        console.error("⚠️  Demo seed failed (server will continue starting):", seedErr);
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 NSYU Business API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Unable to start server:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ Uncaught Exception thrown:", error);
});

start();
