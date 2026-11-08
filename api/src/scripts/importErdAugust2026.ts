import fs from "fs";
import path from "path";
import { parseProductsCsv, executeProductImport } from "../utils/productImporter";
import { Shop, Owner, Product } from "../models";

export async function importErdAugust2026() {
  console.log("🚀 Starting Import of ERD August-2026 Price List (305 items)...");

  let csvPath = path.join(__dirname, "../data/erd_august_2026.csv");
  if (!fs.existsSync(csvPath)) {
    csvPath = path.join(__dirname, "../../src/data/erd_august_2026.csv");
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const csvText = fs.readFileSync(csvPath, "utf-8");
  const parsed = parseProductsCsv(csvText, { defaultBrand: "ERD" });

  console.log(`📋 Parsed ${parsed.items.length} items across ${parsed.categories.length} categories.`);

  // Find owner 1
  const owner = await Owner.findByPk(1);
  if (!owner) {
    throw new Error("Owner with ID 1 not found!");
  }

  const shops = await Shop.findAll({ where: { owner_id: 1 } });
  console.log(`🏪 Found ${shops.length} shops for owner ${owner.name}:`, shops.map((s) => `${s.id}: ${s.name}`).join(", "));

  // Primary shop for opening stock
  const primaryShop = shops[0];
  if (!primaryShop) {
    throw new Error("No shops found for owner!");
  }

  const result = await executeProductImport({
    ownerId: 1,
    shopId: primaryShop.id,
    items: parsed.items,
    actorType: "owner",
    actorId: 1,
  });

  console.log(`✅ Shop ${primaryShop.name} Import Completed:`);
  console.log(`   - Total items processed: ${result.total}`);
  console.log(`   - New products created: ${result.created}`);
  console.log(`   - Existing products updated: ${result.updated}`);
  console.log(`   - Categories synced: ${result.categories}`);

  // Also ensure second shop (Shop 4 - MNT) has stock for all products
  if (shops.length > 1) {
    for (let i = 1; i < shops.length; i++) {
      const otherShop = shops[i];
      console.log(`📦 Syncing stock for secondary shop: ${otherShop.name} (ID: ${otherShop.id})...`);
      await executeProductImport({
        ownerId: 1,
        shopId: otherShop.id,
        items: parsed.items,
        actorType: "owner",
        actorId: 1,
      });
      console.log(`✅ Shop ${otherShop.name} stock synced!`);
    }
  }

  const finalCount = await Product.count({ where: { owner_id: 1 } });
  const activeCount = await Product.count({ where: { owner_id: 1, status: "active" } });
  console.log(`🎉 Total Products in DB: ${finalCount} (${activeCount} active).`);
}

if (require.main === module) {
  importErdAugust2026()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Import failed:", err);
      process.exit(1);
    });
}
