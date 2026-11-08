import sequelize from "../config/database";
import { Category, Product, ProductStock, Supplier, InventoryTransaction } from "../models";
import { nextDateReferenceCode } from "./referenceCode";

export interface ParsedProductItem {
  sno?: number;
  sku: string;
  name: string;
  spec?: string;
  pkg?: number;
  purchase_price: number;
  selling_price?: number;
  mrp?: number;
  tax_percent?: number;
  category: string;
  brand?: string;
}

export interface ParseResult {
  format: "erd" | "standard";
  items: ParsedProductItem[];
  categories: string[];
}

/**
 * Parses a single CSV line respecting double quotes.
 */
export function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
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

/**
 * Clean and normalize category names from ERD headers
 */
export function normalizeCategoryName(raw: string): string {
  const clean = raw
    .replace(/^TC\s*-\s*/i, "")
    .replace(/^CC\s*-\s*/i, "")
    .replace(/^DC\s*-\s*/i, "")
    .replace(/\(FOR AUTOMOBILE\)/i, "")
    .replace(/\(HIGH STRENGTH\)/i, "")
    .replace(/\(FOR PESTICIDE DISINFECTANT SPRAY MACHINES\)/i, "")
    .replace(/\(HIGH CAPACITY WITH BEST PERFORMANCE\) - REMOVABLE TYPE/i, "")
    .trim();

  if (!clean || clean.length === 0) return "General Accessories";

  // Check common classifications
  const upper = clean.toUpperCase();
  if (upper.includes("MOBILE CHARGER")) return "CHARGER";
  if (upper.includes("POWER BANK")) return "POWER BANK";
  if (upper.includes("EARPHONE") || upper.includes("EARBUDS")) return "BLUETOOTH";
  if (upper.includes("CABLE")) return "CABLES";
  if (upper.includes("SPEAKER")) return "SPEAKER";
  if (upper.includes("BATTERIES") || upper.includes("BATTERY")) return "BATTERIES";
  if (upper.includes("EXTENSION") || upper.includes("TORCH")) return "EXTENSION & TORCH";
  if (upper.includes("ADAPTOR") || upper.includes("SMPS")) return "ADAPTOR";
  if (upper.includes("GIFT")) return "GIFT PACKS";

  return clean.toUpperCase();
}

/**
 * Calculates standard retail margin and selling price from wholesale purchase price
 */
export function calculateSellingPrice(purchasePrice: number, explicitSelling?: number): { sellingPrice: number; mrp: number } {
  if (explicitSelling && explicitSelling > 0) {
    const mrp = Math.round(explicitSelling * 1.3);
    return { sellingPrice: explicitSelling, mrp };
  }

  let margin = 10;
  if (purchasePrice <= 100) {
    margin = 10;
  } else if (purchasePrice <= 200) {
    margin = 15;
  } else {
    margin = Math.round(purchasePrice * 0.20);
  }

  const sellingPrice = purchasePrice + margin;
  const mrp = Math.round(sellingPrice * 1.3);
  return { sellingPrice, mrp };
}

/**
 * Parses raw CSV text into structured product items.
 * Supports both ERD Order Sheet format and Standard CSV format.
 */
export function parseProductsCsv(csvText: string, options: { defaultBrand?: string; defaultMarginPercent?: number } = {}): ParseResult {
  const cleanText = csvText.replace(/^\uFEFF/, "").trim(); // strip UTF-8 BOM
  const lines = cleanText.split(/\r?\n/);
  const items: ParsedProductItem[] = [];
  const categoriesSet = new Set<string>();

  // Format detection
  const isErdFormat = lines.some(
    (l) =>
      l.toUpperCase().includes("ERD ORDER FORMAT") ||
      l.includes("S.No.,CODE NO.") ||
      l.toUpperCase().includes("TC - MOBILE CHARGER")
  );

  if (isErdFormat) {
    let currentCategory = "CHARGER";
    categoriesSet.add(currentCategory);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header and terms lines
      if (
        line.toUpperCase().includes("ERD ORDER FORMAT") ||
        line.includes("S.No.,CODE NO.") ||
        line.toUpperCase().includes("TERMS & CONDITIONS") ||
        line.includes("Total,,")
      ) {
        continue;
      }

      const cols = parseCsvLine(line);
      const col0 = (cols[0] || "").trim(); // S.No
      const col1 = (cols[1] || "").trim(); // CODE NO.
      const col2 = (cols[2] || "").trim(); // PRODUCT DESCRIPTION
      const col3 = (cols[3] || "").trim(); // Voltage/Amp/Type
      const col4 = (cols[4] || "").trim(); // STD.PKG.
      const col6 = (cols[6] || "").trim(); // PRICE (INCL. GST)

      // Category divider row: S.No and CODE are blank, but description is present
      if (!col0 && !col1 && col2 && !col2.toLowerCase().includes("total")) {
        currentCategory = normalizeCategoryName(col2);
        categoriesSet.add(currentCategory);
        continue;
      }

      // Valid product row
      if (col0 && /^\d+$/.test(col0) && (col1 || col2)) {
        const sno = parseInt(col0, 10);
        const sku = col1 || `PRD-${sno}`;
        const name = col2.trim();
        const spec = col3.trim();
        const pkg = parseInt(col4.replace(/[^0-9]/g, ""), 10) || 20;
        const purchasePrice = parseFloat(col6.replace(/[^0-9.]/g, "")) || 0;

        const { sellingPrice, mrp } = calculateSellingPrice(purchasePrice);

        // Detect brand
        let brand = options.defaultBrand || "ERD";
        const upper = name.toUpperCase();
        if (upper.includes("BOAT")) brand = "Boat";
        else if (upper.includes("ABREE")) brand = "Abree";
        else if (upper.includes("OUD")) brand = "Oud";
        else if (upper.includes("EDENIC")) brand = "Edenic";

        items.push({
          sno,
          sku,
          name,
          spec,
          pkg,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          mrp,
          tax_percent: 18,
          category: currentCategory,
          brand,
        });
      }
    }

    return {
      format: "erd",
      items,
      categories: Array.from(categoriesSet),
    };
  }

  // Standard CSV Format (name, sku, category, brand, purchase_price, selling_price, mrp, min_stock, opening_stock)
  let headerMap: Record<string, number> = {};
  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line).map((c) => c.trim().toLowerCase());

    if (!headerFound) {
      if (cols.includes("name") || cols.includes("product name") || cols.includes("sku")) {
        cols.forEach((col, idx) => {
          if (col.includes("name") && !col.includes("category")) headerMap["name"] = idx;
          else if (col.includes("sku") || col.includes("code")) headerMap["sku"] = idx;
          else if (col.includes("category")) headerMap["category"] = idx;
          else if (col.includes("brand")) headerMap["brand"] = idx;
          else if (col.includes("purchase") || col.includes("cost")) headerMap["purchase_price"] = idx;
          else if (col.includes("selling") || col.includes("price") || col.includes("rate")) headerMap["selling_price"] = idx;
          else if (col.includes("mrp")) headerMap["mrp"] = idx;
          else if (col.includes("stock") || col.includes("pkg") || col.includes("qty")) headerMap["pkg"] = idx;
          else if (col.includes("spec") || col.includes("desc")) headerMap["spec"] = idx;
        });
        headerFound = true;
        continue;
      }
    }

    const row = parseCsvLine(line);
    const sku = (row[headerMap["sku"] ?? 1] || "").trim();
    const name = (row[headerMap["name"] ?? 0] || "").trim();
    if (!name && !sku) continue;

    const catRaw = (row[headerMap["category"] ?? 2] || "General").trim();
    const cat = normalizeCategoryName(catRaw);
    categoriesSet.add(cat);

    const purchasePrice = parseFloat((row[headerMap["purchase_price"] ?? 4] || "0").replace(/[^0-9.]/g, "")) || 0;
    const rawSelling = parseFloat((row[headerMap["selling_price"] ?? 5] || "0").replace(/[^0-9.]/g, "")) || 0;
    const { sellingPrice, mrp } = calculateSellingPrice(purchasePrice, rawSelling > 0 ? rawSelling : undefined);

    items.push({
      sku: sku || `SKU-${items.length + 1}`,
      name: name || sku,
      spec: (row[headerMap["spec"] ?? 3] || "").trim(),
      pkg: parseInt((row[headerMap["pkg"] ?? 6] || "20").replace(/[^0-9]/g, ""), 10) || 20,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      mrp: parseFloat(row[headerMap["mrp"] ?? 7] || "") || mrp,
      tax_percent: 18,
      category: cat,
      brand: (row[headerMap["brand"] ?? 3] || options.defaultBrand || "ERD").trim(),
    });
  }

  return {
    format: "standard",
    items,
    categories: Array.from(categoriesSet),
  };
}

/**
 * Imports parsed product items into database with full upsert, stock, and reference code generation.
 */
export async function executeProductImport(params: {
  ownerId: number;
  shopId: number;
  items: ParsedProductItem[];
  actorType?: "owner" | "employee";
  actorId?: number;
}): Promise<{
  total: number;
  created: number;
  updated: number;
  categories: number;
  categoryNames: string[];
}> {
  const { ownerId, shopId, items, actorType = "owner", actorId = 1 } = params;

  if (items.length === 0) {
    return { total: 0, created: 0, updated: 0, categories: 0, categoryNames: [] };
  }

  // 1. Ensure default supplier "ERD Technologies" exists
  let supplier = await Supplier.findOne({
    where: { owner_id: ownerId, name: "ERD Technologies" },
  });
  if (!supplier) {
    const supRef = await nextDateReferenceCode({ ownerId, prefix: "SUP" }).catch(() => "SUP-000001");
    supplier = await Supplier.create({
      owner_id: ownerId,
      name: "ERD Technologies",
      phone: "011-45678900",
      email: "sales@erdglobal.com",
      address: "B-21, Sector 65, Noida, UP - 201301",
      gstin: "07AAACE1234F1Z5",
      reference_code: supRef,
      current_balance: 0,
      status: "active",
    });
  }

  // 2. Resolve / Create Categories for owner
  const categoryCache = new Map<string, number>();
  const existingCats = await Category.findAll({ where: { owner_id: ownerId } });
  existingCats.forEach((c) => categoryCache.set(c.name.toUpperCase(), c.id));

  const uniqueCats = Array.from(new Set(items.map((it) => it.category.toUpperCase())));
  for (const catName of uniqueCats) {
    if (!categoryCache.has(catName)) {
      const catCount = (await Category.count({ where: { owner_id: ownerId } })) + 1;
      const refCode = `CAT-${String(catCount).padStart(6, "0")}`;
      const newCat = await Category.create({
        owner_id: ownerId,
        name: catName,
        status: "active",
        reference_code: refCode,
      });
      categoryCache.set(catName, newCat.id);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;

  // 3. Process products in batches
  const existingProducts = await Product.findAll({
    where: { owner_id: ownerId },
  });
  const productBySku = new Map<string, Product>();
  existingProducts.forEach((p) => productBySku.set(p.sku.toUpperCase(), p));

  let currentTotalProducts = existingProducts.length;

  for (const item of items) {
    const skuKey = item.sku.trim().toUpperCase();
    const categoryId = categoryCache.get(item.category.toUpperCase()) || null;
    const stdPkg = item.pkg || 20;

    let product = productBySku.get(skuKey);

    if (product) {
      // Update existing product
      product.name = item.name;
      product.category_id = categoryId;
      product.brand = item.brand || product.brand || "ERD";
      product.description = item.spec || product.description;
      product.purchase_price = item.purchase_price;
      product.selling_price = item.selling_price || product.selling_price;
      product.mrp = item.mrp || product.mrp;
      product.tax_percent = item.tax_percent || 18;
      product.status = "active";
      if (!product.supplier_id) product.supplier_id = supplier.id;
      await product.save();

      updatedCount++;
    } else {
      // Create new product
      currentTotalProducts++;
      const refCode = `PRD-${String(currentTotalProducts).padStart(6, "0")}`;

      product = await Product.create({
        owner_id: ownerId,
        name: item.name,
        sku: item.sku.trim(),
        barcode: item.sku.trim(),
        category_id: categoryId,
        brand: item.brand || "ERD",
        description: item.spec || item.category,
        purchase_price: item.purchase_price,
        selling_price: item.selling_price || item.purchase_price,
        mrp: item.mrp || Math.round(item.purchase_price * 1.5),
        discount: 0,
        tax_percent: item.tax_percent || 18,
        min_stock: 5,
        supplier_id: supplier.id,
        status: "active",
        reference_code: refCode,
      });

      productBySku.set(skuKey, product);
      createdCount++;
    }

    // Ensure ProductStock exists for target shop
    const stock = await ProductStock.findOne({
      where: { owner_id: ownerId, product_id: product.id, shop_id: shopId },
    });

    if (!stock) {
      await ProductStock.create({
        owner_id: ownerId,
        product_id: product.id,
        shop_id: shopId,
        current_stock: stdPkg,
      });

      // Record opening transaction
      const stmRef = await nextDateReferenceCode({ ownerId, prefix: "STM" }).catch(() => `STM-${Date.now()}`);
      await InventoryTransaction.create({
        owner_id: ownerId,
        shop_id: shopId,
        product_id: product.id,
        type: "opening",
        signed_quantity: stdPkg,
        balance_after: stdPkg,
        actor_type: actorType,
        actor_id: actorId,
        notes: `Imported stock from price list (${stdPkg} units)`,
        reference_code: stmRef,
      });
    } else if (stock.current_stock === 0) {
      stock.current_stock = stdPkg;
      await stock.save();
    }
  }

  // Update PRD reference counter
  await sequelize.query(`
    INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
    VALUES (${ownerId}, 'PRD', ${currentTotalProducts}, NOW(), NOW())
    ON CONFLICT (owner_id, scope)
    DO UPDATE SET last_number = ${currentTotalProducts}, updated_at = NOW();
  `).catch(() => {});

  return {
    total: items.length,
    created: createdCount,
    updated: updatedCount,
    categories: uniqueCats.length,
    categoryNames: uniqueCats,
  };
}
