import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../models";
import { seedDemoData } from "./seed";

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

  await sequelize.authenticate();
  await sequelize.sync(); // create tables if this is a brand-new DB; never drops/alters existing data
  await seedDemoData();
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
