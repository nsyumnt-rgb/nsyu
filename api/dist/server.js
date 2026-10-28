"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const models_1 = require("./models");
const seed_1 = require("./seed/seed");
const PORT = process.env.PORT || 5000;
async function start() {
    try {
        await models_1.sequelize.authenticate();
        console.log("✅ Database connected");
        // Dev-only convenience. In production, use proper Sequelize
        // migrations (sequelize-cli) instead of sync({ alter: true }).
        if (process.env.SYNC_DB === "true") {
            await models_1.sequelize.sync({ alter: true });
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
                await (0, seed_1.seedDemoData)();
            }
            catch (seedErr) {
                console.error("⚠️  Demo seed failed (server will continue starting):", seedErr);
            }
        }
        app_1.default.listen(PORT, () => {
            console.log(`🚀 NSYU Business API running on port ${PORT}`);
        });
    }
    catch (err) {
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
//# sourceMappingURL=server.js.map