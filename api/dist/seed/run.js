"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const models_1 = require("../models");
const seed_1 = require("./seed");
/**
 * Manual seed trigger: `npm run seed`. Same production guard as the
 * automatic startup hook in server.ts — this is a convenience CLI,
 * not a bypass.
 */
async function main() {
    if (process.env.NODE_ENV === "production") {
        console.error("[DEMO SEED] Refusing to seed: NODE_ENV=production");
        process.exit(1);
    }
    await models_1.sequelize.authenticate();
    await models_1.sequelize.sync(); // create tables if this is a brand-new DB; never drops/alters existing data
    await (0, seed_1.seedDemoData)();
    await models_1.sequelize.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=run.js.map