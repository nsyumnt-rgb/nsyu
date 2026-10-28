import fs from "fs";
import path from "path";
import sequelize from "../config/database";
import {
  Category,
  Product,
  ProductStock,
  Supplier,
  InventoryTransaction,
} from "../models";
import { nextDateReferenceCode } from "../utils/referenceCode";

export async function importProducts() {
  console.log("🚀 Starting Products Import from CSV...");

  const csvPath = path.join(__dirname, "../data/products.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    return;
  }
  const rawData = fs.readFileSync(csvPath, "utf-8");
  const lines = rawData.split(/\r?\n/);

  // 1. Ensure supplier "ERD Technologies" exists
  let supplier = await Supplier.findOne({
    where: { owner_id: 1, name: "ERD Technologies" },
  });
  if (!supplier) {
    supplier = await Supplier.create({
      owner_id: 1,
      name: "ERD Technologies",
      phone: "011-45678900",
      email: "sales@erdglobal.com",
      address: "B-21, Sector 65, Noida, UP - 201301",
      gstin: "07AAACE1234F1Z5",
      reference_code: "SUP-000001",
      current_balance: 0,
      status: "active",
    });
    console.log("Created supplier: ERD Technologies (SUP-000001)");
  }

  // Helper to normalize and categorize
  const categoryMap = new Map<string, number>();

  async function getCategoryId(catName: string): Promise<number> {
    const cleanName = catName
      .replace(/^TC\s*-\s*/i, "")
      .replace(/^CC\s*-\s*/i, "")
      .replace(/^DC\s*-\s*/i, "")
      .replace(/\(FOR AUTOMOBILE\)/i, "")
      .replace(/\(HIGH STRENGTH\)/i, "")
      .trim();

    const formattedName = cleanName.length > 0 ? cleanName : "General Accessories";

    if (categoryMap.has(formattedName)) {
      return categoryMap.get(formattedName)!;
    }

    let existing = await Category.findOne({
      where: { owner_id: 1, name: formattedName },
    });
    if (!existing) {
      const catCount = (await Category.count({ where: { owner_id: 1 } })) + 1;
      const catRef = `CAT-${String(catCount).padStart(6, "0")}`;
      existing = await Category.create({
        owner_id: 1,
        name: formattedName,
        status: "active",
        reference_code: catRef,
      });
      console.log(`Created category: ${formattedName} (${catRef})`);
    }
    categoryMap.set(formattedName, existing.id);
    return existing.id;
  }

  let currentCategory = "Mobile Chargers";
  let importedCount = 0;
  const skuCounts = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Header line detection
    if (line.includes("ERD ORDER FORMAT") || line.includes("S.No.,CODE NO.")) {
      continue;
    }

    // CSV line parser handling quotes
    const cols = parseCsvLine(line);
    const col0 = (cols[0] || "").trim();
    const col1 = (cols[1] || "").trim();
    const col2 = (cols[2] || "").trim();
    const col3 = (cols[3] || "").trim();
    const col4 = (cols[4] || "").trim();
    const col6 = (cols[6] || "").trim(); // Purchase price
    const col8 = (cols[8] || "").trim(); // Margin
    const col9 = (cols[9] || "").trim(); // SL-PRICE (Selling price)

    // Category separator line (e.g. ",,TC - MOBILE CHARGER DUAL USB,,,,,,,0,0")
    if (!col0 && !col1 && col2) {
      currentCategory = col2;
      continue;
    }

    // Must have a product code or description
    if (!col1 && !col2) continue;

    let sku = col1 || `PRD-${i}`;
    let name = col2 || sku;
    const spec = col3;
    const stdPkg = parseInt(col4, 10) || 20;

    const purchasePrice = parseFloat(col6.replace(/[^0-9.]/g, "")) || 0;
    const margin = parseFloat(col8.replace(/[^0-9.]/g, "")) || 0;
    let sellingPrice = parseFloat(col9.replace(/[^0-9.]/g, "")) || 0;

    if (sellingPrice === 0) {
      sellingPrice = purchasePrice + (margin > 0 ? margin : Math.round(purchasePrice * 0.2));
    }
    const mrp = Math.round(sellingPrice * 1.3);

    // Brand detection
    let brand = "ERD";
    const upperName = name.toUpperCase();
    if (upperName.includes("BOAT")) brand = "Boat";
    else if (upperName.includes("ABREE")) brand = "Abree";
    else if (upperName.includes("OUD")) brand = "Oud";
    else if (upperName.includes("EDENIC")) brand = "Edenic";

    // Handle SKU collision by appending counter
    sku = sku.trim();
    const count = (skuCounts.get(sku) || 0) + 1;
    skuCounts.set(sku, count);
    const finalSku = count > 1 ? `${sku}-${count}` : sku;

    const categoryId = await getCategoryId(currentCategory);

    // Check if product with this SKU already exists
    let product = await Product.findOne({
      where: { owner_id: 1, sku: finalSku },
    });

    if (!product) {
      const prdNum = (await Product.count({ where: { owner_id: 1 } })) + 1;
      const refCode = `PRD-${String(prdNum).padStart(6, "0")}`;

      product = await Product.create({
        owner_id: 1,
        name,
        sku: finalSku,
        barcode: finalSku,
        category_id: categoryId,
        brand,
        description: spec || currentCategory,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        mrp,
        discount: 0,
        tax_percent: 18,
        min_stock: 5,
        supplier_id: supplier.id,
        reference_code: refCode,
        status: "active",
      });

      // Stock for shop 1
      await ProductStock.create({
        owner_id: 1,
        product_id: product.id,
        shop_id: 1,
        current_stock: stdPkg,
      });

      // Initial Stock Movement
      const stmRef = await nextDateReferenceCode({ ownerId: 1, prefix: "STM" });
      await InventoryTransaction.create({
        owner_id: 1,
        shop_id: 1,
        product_id: product.id,
        type: "opening",
        signed_quantity: stdPkg,
        balance_after: stdPkg,
        actor_type: "owner",
        actor_id: 1,
        notes: `Initial stock from price list (${stdPkg} units)`,
        reference_code: stmRef,
      });

      importedCount++;
      if (importedCount % 25 === 0) {
        console.log(`Imported ${importedCount} products...`);
      }
    }
  }

  // Update reference_counters for PRD
  const totalProducts = await Product.count({ where: { owner_id: 1 } });
  await sequelize.query(`
    INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
    VALUES (1, 'PRD', ${totalProducts}, NOW(), NOW())
    ON CONFLICT (owner_id, scope)
    DO UPDATE SET last_number = ${totalProducts}, updated_at = NOW();
  `);

  console.log(`✅ Successfully synced ${importedCount} new products into database!`);
  console.log(`Total products in catalog: ${totalProducts}`);
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

if (require.main === module) {
  importProducts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Import failed:", err);
      process.exit(1);
    });
}
