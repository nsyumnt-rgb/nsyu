import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { sequelize } from "./models";

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`🚀 NSYU Business API running on port ${PORT} (0.0.0.0)`);
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
