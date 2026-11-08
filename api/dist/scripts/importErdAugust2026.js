"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importErdAugust2026 = importErdAugust2026;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const productImporter_1 = require("../utils/productImporter");
const models_1 = require("../models");
async function importErdAugust2026() {
    console.log("🚀 Starting Import of ERD August-2026 Price List (305 items)...");
    let csvPath = path_1.default.join(__dirname, "../data/erd_august_2026.csv");
    if (!fs_1.default.existsSync(csvPath)) {
        csvPath = path_1.default.join(__dirname, "../../src/data/erd_august_2026.csv");
    }
    if (!fs_1.default.existsSync(csvPath)) {
        throw new Error(`CSV file not found at ${csvPath}`);
    }
    const csvText = fs_1.default.readFileSync(csvPath, "utf-8");
    const parsed = (0, productImporter_1.parseProductsCsv)(csvText, { defaultBrand: "ERD" });
    console.log(`📋 Parsed ${parsed.items.length} items across ${parsed.categories.length} categories.`);
    // Find owner 1
    const owner = await models_1.Owner.findByPk(1);
    if (!owner) {
        throw new Error("Owner with ID 1 not found!");
    }
    const shops = await models_1.Shop.findAll({ where: { owner_id: 1 } });
    console.log(`🏪 Found ${shops.length} shops for owner ${owner.name}:`, shops.map((s) => `${s.id}: ${s.name}`).join(", "));
    // Primary shop for opening stock
    const primaryShop = shops[0];
    if (!primaryShop) {
        throw new Error("No shops found for owner!");
    }
    const result = await (0, productImporter_1.executeProductImport)({
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
            await (0, productImporter_1.executeProductImport)({
                ownerId: 1,
                shopId: otherShop.id,
                items: parsed.items,
                actorType: "owner",
                actorId: 1,
            });
            console.log(`✅ Shop ${otherShop.name} stock synced!`);
        }
    }
    const finalCount = await models_1.Product.count({ where: { owner_id: 1 } });
    const activeCount = await models_1.Product.count({ where: { owner_id: 1, status: "active" } });
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
//# sourceMappingURL=importErdAugust2026.js.map