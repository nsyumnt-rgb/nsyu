"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsvLine = parseCsvLine;
exports.normalizeCategoryName = normalizeCategoryName;
exports.calculateSellingPrice = calculateSellingPrice;
exports.normalizeKey = normalizeKey;
exports.buildCompositeKey = buildCompositeKey;
exports.parseSpreadsheetBuffer = parseSpreadsheetBuffer;
exports.parseSpreadsheetRows = parseSpreadsheetRows;
exports.parseProductsCsv = parseProductsCsv;
exports.previewProductImport = previewProductImport;
exports.executeProductImport = executeProductImport;
const xlsx_1 = __importDefault(require("xlsx"));
const database_1 = __importDefault(require("../config/database"));
const models_1 = require("../models");
const referenceCode_1 = require("./referenceCode");
/**
 * Parses a single CSV line respecting double quotes.
 */
function parseCsvLine(text) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQuotes && text[i + 1] === '"') {
                cur += '"';
                i++; // skip escaped quote
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (c === "," && !inQuotes) {
            result.push(cur);
            cur = "";
        }
        else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}
/**
 * Clean and normalize category names
 */
function normalizeCategoryName(raw) {
    const clean = (raw || "")
        .replace(/^TC\s*-\s*/i, "")
        .replace(/^CC\s*-\s*/i, "")
        .replace(/^DC\s*-\s*/i, "")
        .replace(/\(FOR AUTOMOBILE\)/i, "")
        .replace(/\(HIGH STRENGTH\)/i, "")
        .replace(/\(FOR PESTICIDE DISINFECTANT SPRAY MACHINES\)/i, "")
        .replace(/\(HIGH CAPACITY WITH BEST PERFORMANCE\) - REMOVABLE TYPE/i, "")
        .trim();
    if (!clean || clean.length === 0)
        return "GENERAL";
    const upper = clean.toUpperCase();
    if (upper.includes("MOBILE CHARGER"))
        return "CHARGER";
    if (upper.includes("POWER BANK"))
        return "POWER BANK";
    if (upper.includes("EARPHONE") || upper.includes("EARBUDS"))
        return "BLUETOOTH";
    if (upper.includes("CABLE"))
        return "CABLES";
    if (upper.includes("SPEAKER"))
        return "SPEAKER";
    if (upper.includes("BATTERIES") || upper.includes("BATTERY"))
        return "BATTERIES";
    if (upper.includes("EXTENSION") || upper.includes("TORCH"))
        return "EXTENSION & TORCH";
    if (upper.includes("ADAPTOR") || upper.includes("SMPS"))
        return "ADAPTOR";
    if (upper.includes("GIFT"))
        return "GIFT PACKS";
    return clean.toUpperCase();
}
/**
 * Calculates standard retail margin and selling price from wholesale purchase price
 */
function calculateSellingPrice(purchasePrice, explicitSelling) {
    if (explicitSelling && explicitSelling > 0) {
        const mrp = Math.round(explicitSelling * 1.3);
        return { sellingPrice: explicitSelling, mrp };
    }
    let margin = 10;
    if (purchasePrice <= 100) {
        margin = 10;
    }
    else if (purchasePrice <= 200) {
        margin = 15;
    }
    else {
        margin = Math.round(purchasePrice * 0.20);
    }
    const sellingPrice = purchasePrice + margin;
    const mrp = Math.round(sellingPrice * 1.3);
    return { sellingPrice, mrp };
}
/**
 * Normalize string for fuzzy comparison (lowercase, alphanumeric only)
 */
function normalizeKey(text) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
}
/**
 * Builds normalized composite key for Tier 3 matching: Name + Brand + Model/Spec
 */
function buildCompositeKey(name, brand, model) {
    return `${normalizeKey(name)}|${normalizeKey(brand)}|${normalizeKey(model)}`;
}
/**
 * Clean numeric string into a valid number
 */
function parseNumber(val, fallback = 0) {
    if (val === undefined || val === null || val === "")
        return fallback;
    if (typeof val === "number")
        return isNaN(val) ? fallback : val;
    const cleaned = String(val).replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? fallback : num;
}
/**
 * Parse any spreadsheet buffer (.xlsx, .xls, .csv) into structured items with in-file duplicate detection.
 */
function parseSpreadsheetBuffer(buffer, options = {}) {
    const wb = xlsx_1.default.read(buffer, { type: "buffer", cellDates: true, raw: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
        return { format: "standard", items: [], categories: [], invalidItems: [] };
    }
    const sheet = wb.Sheets[sheetName];
    const rawRows = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return parseSpreadsheetRows(rawRows, options);
}
/**
 * Parse raw rows from either xlsx or manual csv split.
 */
function parseSpreadsheetRows(rawRows, options = {}) {
    const items = [];
    const invalidItems = [];
    const categoriesSet = new Set();
    // In-file duplicate trackers (normalized SKU, Barcode, Name+Brand)
    const fileSkus = new Map();
    const fileBarcodes = new Map();
    const fileNameBrands = new Map();
    // Check if first 10 rows indicate ERD format
    const isErdFormat = rawRows.slice(0, 10).some((row) => {
        const text = row.map((c) => String(c || "")).join(" ").toUpperCase();
        return (text.includes("ERD ORDER FORMAT") ||
            (text.includes("CODE NO.") && text.includes("PRODUCT DESCRIPTION")) ||
            text.includes("TC - MOBILE CHARGER"));
    });
    if (isErdFormat) {
        let currentCategory = "CHARGER";
        categoriesSet.add(currentCategory);
        for (let r = 0; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0)
                continue;
            const col0 = String(row[0] || "").trim(); // S.No
            const col1 = String(row[1] || "").trim(); // CODE NO.
            const col2 = String(row[2] || "").trim(); // PRODUCT DESCRIPTION
            const col3 = String(row[3] || "").trim(); // Voltage/Amp/Type
            const col4 = String(row[4] || "").trim(); // STD.PKG.
            const col6 = String(row[6] || "").trim(); // PRICE (INCL. GST)
            // Skip header and terms rows
            const rowText = row.map((c) => String(c || "")).join(" ").toUpperCase();
            if (rowText.includes("ERD ORDER FORMAT") ||
                rowText.includes("CODE NO.") ||
                rowText.includes("TERMS & CONDITIONS") ||
                col2.toLowerCase().includes("total")) {
                continue;
            }
            // Category divider row: S.No and CODE are blank, description is present
            if (!col0 && !col1 && col2) {
                currentCategory = normalizeCategoryName(col2);
                categoriesSet.add(currentCategory);
                continue;
            }
            // Product row
            if (col0 && /^\d+$/.test(col0) && (col1 || col2)) {
                const sno = parseInt(col0, 10);
                const sku = col1 || `PRD-${sno}`;
                const name = col2.trim();
                const spec = col3.trim();
                const pkg = parseNumber(col4, 20);
                const purchasePrice = parseNumber(col6, 0);
                const { sellingPrice, mrp } = calculateSellingPrice(purchasePrice);
                // Detect brand
                let brand = options.defaultBrand || "ERD";
                const upper = name.toUpperCase();
                if (upper.includes("BOAT"))
                    brand = "Boat";
                else if (upper.includes("ABREE"))
                    brand = "Abree";
                else if (upper.includes("OUD"))
                    brand = "Oud";
                else if (upper.includes("EDENIC"))
                    brand = "Edenic";
                const item = {
                    rowIndex: r + 1,
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
                    barcode: sku,
                };
                // In-file duplicate check
                const normSku = sku.toUpperCase();
                if (fileSkus.has(normSku)) {
                    invalidItems.push({
                        ...item,
                        status: "duplicate",
                        isDuplicateInFile: true,
                        duplicateOfRow: fileSkus.get(normSku),
                        validationError: `Duplicate SKU '${sku}' in uploaded file (first seen at row ${fileSkus.get(normSku)})`,
                    });
                    continue;
                }
                fileSkus.set(normSku, r + 1);
                items.push(item);
            }
        }
        return {
            format: "erd",
            items,
            categories: Array.from(categoriesSet),
            invalidItems,
        };
    }
    // Standard Format with Flexible Header Mapping
    let headerMap = {};
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r].map((c) => String(c || "").trim().toLowerCase());
        const isHeader = row.some((col) => col === "sku" ||
            col === "product name" ||
            col === "name" ||
            col === "code" ||
            col === "code no." ||
            col === "item name" ||
            col === "item code" ||
            col.includes("purchase price") ||
            col.includes("selling price"));
        if (isHeader) {
            headerRowIndex = r;
            row.forEach((col, idx) => {
                if (!col)
                    return;
                if (col === "name" || col === "product name" || col === "item name" || col === "title" || col === "product") {
                    headerMap["name"] = idx;
                }
                else if (col === "sku" || col === "code" || col === "product code" || col === "item code" || col === "code no." || col === "code no") {
                    headerMap["sku"] = idx;
                }
                else if (col.includes("category") || col === "cat" || col === "group") {
                    headerMap["category"] = idx;
                }
                else if (col.includes("brand") || col === "make" || col === "manufacturer") {
                    headerMap["brand"] = idx;
                }
                else if (col.includes("barcode") || col === "upc" || col === "ean") {
                    headerMap["barcode"] = idx;
                }
                else if (col.includes("purchase") || col.includes("cost") || col.includes("buy")) {
                    headerMap["purchase_price"] = idx;
                }
                else if (col.includes("selling") || col.includes("sale") || col.includes("retail") || col === "price") {
                    headerMap["selling_price"] = idx;
                }
                else if (col.includes("mrp") || col.includes("list price")) {
                    headerMap["mrp"] = idx;
                }
                else if (col.includes("tax") || col.includes("gst")) {
                    headerMap["tax_percent"] = idx;
                }
                else if (col.includes("min stock") || col.includes("min_stock") || col.includes("reorder")) {
                    headerMap["min_stock"] = idx;
                }
                else if (col.includes("stock") || col.includes("qty") || col.includes("pkg")) {
                    headerMap["pkg"] = idx;
                }
                else if (col.includes("spec") || col.includes("desc") || col.includes("model")) {
                    headerMap["spec"] = idx;
                }
                else if (col.includes("status")) {
                    headerMap["status"] = idx;
                }
            });
            break;
        }
    }
    // If no header found, use positional fallback
    if (headerRowIndex === -1) {
        headerRowIndex = 0;
        headerMap = {
            name: 0,
            sku: 1,
            category: 2,
            brand: 3,
            purchase_price: 4,
            selling_price: 5,
            pkg: 6,
            status: 7,
        };
    }
    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0)
            continue;
        // Check if entire row is empty
        const hasAnyContent = row.some((c) => String(c || "").trim().length > 0);
        if (!hasAnyContent)
            continue;
        const rawName = headerMap["name"] !== undefined ? String(row[headerMap["name"]] || "").trim() : "";
        const rawSku = headerMap["sku"] !== undefined ? String(row[headerMap["sku"]] || "").trim() : "";
        const rawCat = headerMap["category"] !== undefined ? String(row[headerMap["category"]] || "").trim() : "";
        const rawBrand = headerMap["brand"] !== undefined ? String(row[headerMap["brand"]] || "").trim() : "";
        const rawBarcode = headerMap["barcode"] !== undefined ? String(row[headerMap["barcode"]] || "").trim() : "";
        const rawSpec = headerMap["spec"] !== undefined ? String(row[headerMap["spec"]] || "").trim() : "";
        const rawStatus = headerMap["status"] !== undefined ? String(row[headerMap["status"]] || "").trim().toLowerCase() : "active";
        const purchasePrice = headerMap["purchase_price"] !== undefined ? parseNumber(row[headerMap["purchase_price"]], 0) : 0;
        const explicitSelling = headerMap["selling_price"] !== undefined ? parseNumber(row[headerMap["selling_price"]], 0) : undefined;
        const rawMrp = headerMap["mrp"] !== undefined ? parseNumber(row[headerMap["mrp"]], 0) : undefined;
        const rawTax = headerMap["tax_percent"] !== undefined ? parseNumber(row[headerMap["tax_percent"]], 18) : 18;
        const rawPkg = headerMap["pkg"] !== undefined ? parseNumber(row[headerMap["pkg"]], 20) : 20;
        const rawMinStock = headerMap["min_stock"] !== undefined ? parseNumber(row[headerMap["min_stock"]], 5) : 5;
        const cat = normalizeCategoryName(rawCat || "General");
        categoriesSet.add(cat);
        const { sellingPrice, mrp } = calculateSellingPrice(purchasePrice, explicitSelling && explicitSelling > 0 ? explicitSelling : undefined);
        const item = {
            rowIndex: r + 1,
            sno: items.length + 1,
            sku: rawSku || (rawName ? `SKU-${items.length + 1}` : ""),
            name: rawName || rawSku,
            category: cat,
            brand: rawBrand || options.defaultBrand || "ERD",
            barcode: rawBarcode || rawSku,
            spec: rawSpec,
            pkg: rawPkg,
            purchase_price: purchasePrice,
            selling_price: explicitSelling && explicitSelling > 0 ? explicitSelling : sellingPrice,
            mrp: rawMrp && rawMrp > 0 ? rawMrp : mrp,
            tax_percent: rawTax,
            min_stock: rawMinStock,
            product_status: rawStatus === "inactive" ? "inactive" : "active",
        };
        // Validation 1: At least Name or SKU required
        if (!item.name && !item.sku) {
            invalidItems.push({
                ...item,
                status: "invalid",
                validationError: `Row ${r + 1}: Missing both Product Name and SKU`,
            });
            continue;
        }
        // Validation 2: Purchase price must not be negative
        if (purchasePrice < 0) {
            invalidItems.push({
                ...item,
                status: "invalid",
                validationError: `Row ${r + 1}: Purchase price cannot be negative (${purchasePrice})`,
            });
            continue;
        }
        // Validation 3: In-file duplicate detection
        const normSku = item.sku.toUpperCase();
        const normBarcode = item.barcode ? item.barcode.toUpperCase() : "";
        const nameBrandKey = `${normalizeKey(item.name)}|${normalizeKey(item.brand)}`;
        if (normSku && fileSkus.has(normSku)) {
            invalidItems.push({
                ...item,
                status: "duplicate",
                isDuplicateInFile: true,
                duplicateOfRow: fileSkus.get(normSku),
                validationError: `Row ${r + 1}: Duplicate SKU '${item.sku}' in uploaded file (first seen at row ${fileSkus.get(normSku)})`,
            });
            continue;
        }
        if (normBarcode && normBarcode !== normSku && fileBarcodes.has(normBarcode)) {
            invalidItems.push({
                ...item,
                status: "duplicate",
                isDuplicateInFile: true,
                duplicateOfRow: fileBarcodes.get(normBarcode),
                validationError: `Row ${r + 1}: Duplicate Barcode '${item.barcode}' in uploaded file (first seen at row ${fileBarcodes.get(normBarcode)})`,
            });
            continue;
        }
        if (normSku)
            fileSkus.set(normSku, r + 1);
        if (normBarcode)
            fileBarcodes.set(normBarcode, r + 1);
        if (nameBrandKey)
            fileNameBrands.set(nameBrandKey, r + 1);
        items.push(item);
    }
    return {
        format: "standard",
        items,
        categories: Array.from(categoriesSet),
        invalidItems,
    };
}
/**
 * Backward-compatible CSV text parser
 */
function parseProductsCsv(csvText, options = {}) {
    const cleanText = (csvText || "").replace(/^\uFEFF/, "").trim();
    const buffer = Buffer.from(cleanText, "utf-8");
    return parseSpreadsheetBuffer(buffer, options);
}
/**
 * Preview and validate items against existing database records using 3-Tier Matching.
 * Priority:
 *   1. SKU
 *   2. Barcode
 *   3. Product Name + Brand + Model
 */
async function previewProductImport(params) {
    const { ownerId, items, invalidItems = [], format = "standard", categories = [] } = params;
    // Fetch all existing products for owner
    const existingProducts = await models_1.Product.findAll({
        where: { owner_id: ownerId },
    });
    // Build 3-tier lookup maps
    const skuMap = new Map();
    const barcodeMap = new Map();
    const nameBrandModelMap = new Map();
    for (const prod of existingProducts) {
        if (prod.sku) {
            skuMap.set(prod.sku.trim().toUpperCase(), prod);
        }
        if (prod.barcode) {
            barcodeMap.set(prod.barcode.trim().toUpperCase(), prod);
        }
        const key = buildCompositeKey(prod.name, prod.brand, prod.description);
        nameBrandModelMap.set(key, prod);
    }
    let newCount = 0;
    let existingCount = 0;
    let priceChangeCount = 0;
    let ambiguousCount = 0;
    let duplicateCount = invalidItems.filter((i) => i.isDuplicateInFile).length;
    let invalidCount = invalidItems.filter((i) => !i.isDuplicateInFile).length;
    const previewItems = [];
    for (const item of items) {
        const normSku = (item.sku || "").trim().toUpperCase();
        const normBarcode = (item.barcode || "").trim().toUpperCase();
        const normKey = buildCompositeKey(item.name, item.brand, item.spec || item.model);
        // Tier 1: SKU match
        const matchBySku = normSku ? skuMap.get(normSku) : undefined;
        // Tier 2: Barcode match
        const matchByBarcode = normBarcode ? barcodeMap.get(normBarcode) : undefined;
        // Tier 3: Name + Brand + Model match
        const matchByNameBrand = nameBrandModelMap.get(normKey);
        // Ambiguity detection: conflicting matches pointing to different existing product records
        const matchedSet = new Set();
        if (matchBySku)
            matchedSet.add(matchBySku);
        if (matchByBarcode)
            matchedSet.add(matchByBarcode);
        if (matchByNameBrand)
            matchedSet.add(matchByNameBrand);
        if (matchedSet.size > 1) {
            // Conflicting matches detected!
            const matchedList = Array.from(matchedSet);
            ambiguousCount++;
            previewItems.push({
                ...item,
                status: "ambiguous",
                matchedProductId: matchedList[0].id,
                matchedProductName: matchedList[0].name,
                matchedSku: matchedList[0].sku,
                ambiguityReason: `Conflicting database matches: SKU matches Product #${matchBySku?.id} ('${matchBySku?.name}'), but Barcode/Name matches Product #${(matchByBarcode || matchByNameBrand)?.id} ('${(matchByBarcode || matchByNameBrand)?.name}')`,
            });
            continue;
        }
        // Resolve matched product
        const matchedProduct = matchBySku || matchByBarcode || matchByNameBrand;
        if (!matchedProduct) {
            // New Product
            newCount++;
            previewItems.push({
                ...item,
                status: "new",
                newPurchasePrice: item.purchase_price,
                newSellingPrice: item.selling_price,
            });
            continue;
        }
        // Existing Product matched
        const matchTier = matchBySku
            ? "sku"
            : matchByBarcode
                ? "barcode"
                : "name_brand_model";
        const oldPurchase = Number(matchedProduct.purchase_price) || 0;
        const newPurchase = Number(item.purchase_price) || 0;
        const oldSelling = Number(matchedProduct.selling_price) || 0;
        const newSelling = item.selling_price !== undefined ? item.selling_price : oldSelling;
        const isPriceChanged = newPurchase > 0 && Math.abs(oldPurchase - newPurchase) > 0.009;
        if (isPriceChanged) {
            priceChangeCount++;
            previewItems.push({
                ...item,
                status: "price_change",
                matchedProductId: matchedProduct.id,
                matchedProductName: matchedProduct.name,
                matchedSku: matchedProduct.sku,
                matchTier,
                oldPurchasePrice: oldPurchase,
                newPurchasePrice: newPurchase,
                oldSellingPrice: oldSelling,
                newSellingPrice: newSelling,
            });
        }
        else {
            existingCount++;
            previewItems.push({
                ...item,
                status: "existing",
                matchedProductId: matchedProduct.id,
                matchedProductName: matchedProduct.name,
                matchedSku: matchedProduct.sku,
                matchTier,
                oldPurchasePrice: oldPurchase,
                newPurchasePrice: newPurchase,
                oldSellingPrice: oldSelling,
                newSellingPrice: newSelling,
            });
        }
    }
    // Combine preview items with pre-identified invalid/duplicate items
    const allItems = [...previewItems, ...invalidItems].sort((a, b) => a.rowIndex - b.rowIndex);
    return {
        format,
        summary: {
            total: allItems.length,
            newCount,
            existingCount,
            priceChangeCount,
            duplicateCount,
            invalidCount,
            ambiguousCount,
        },
        categories,
        items: allItems,
    };
}
/**
 * Execute product import within a PostgreSQL database transaction.
 * Follows core business rules:
 *   - No fake stock / inventory transactions.
 *   - Selling prices are preserved by default unless updateSellingPrice is explicitly true.
 *   - Purchase price changes are logged to AuditLog.
 *   - Categories are dynamically resolved/created with reference codes.
 */
async function executeProductImport(params) {
    const { ownerId, shopId, items, actorType = "owner", actorId = 1, updateExisting = true, updatePurchasePrice = true, updateSellingPrice = false, } = params;
    if (items.length === 0) {
        return { total: 0, created: 0, updated: 0, priceChanges: 0, categories: 0, categoryNames: [] };
    }
    return await database_1.default.transaction(async (t) => {
        // 1. Ensure default supplier exists
        let supplier = await models_1.Supplier.findOne({
            where: { owner_id: ownerId, name: "ERD Technologies" },
            transaction: t,
        });
        if (!supplier) {
            const supRef = await (0, referenceCode_1.nextDateReferenceCode)({ ownerId, prefix: "SUP" }).catch(() => "SUP-000001");
            supplier = await models_1.Supplier.create({
                owner_id: ownerId,
                name: "ERD Technologies",
                phone: "011-45678900",
                email: "sales@erdglobal.com",
                address: "B-21, Sector 65, Noida, UP - 201301",
                gstin: "07AAACE1234F1Z5",
                reference_code: supRef,
                current_balance: 0,
                status: "active",
            }, { transaction: t });
        }
        // 2. Resolve / Create Categories for owner
        const categoryCache = new Map();
        const existingCats = await models_1.Category.findAll({ where: { owner_id: ownerId }, transaction: t });
        existingCats.forEach((c) => categoryCache.set(c.name.toUpperCase(), c.id));
        const uniqueCats = Array.from(new Set(items.map((it) => (it.category || "GENERAL").toUpperCase())));
        for (const catName of uniqueCats) {
            if (!categoryCache.has(catName)) {
                const catCount = (await models_1.Category.count({ where: { owner_id: ownerId }, transaction: t })) + 1;
                const refCode = `CAT-${String(catCount).padStart(6, "0")}`;
                const newCat = await models_1.Category.create({
                    owner_id: ownerId,
                    name: catName,
                    status: "active",
                    reference_code: refCode,
                }, { transaction: t });
                categoryCache.set(catName, newCat.id);
            }
        }
        // 3. Load existing products for 3-tier lookup within transaction
        const existingProducts = await models_1.Product.findAll({
            where: { owner_id: ownerId },
            transaction: t,
        });
        const skuMap = new Map();
        const barcodeMap = new Map();
        const nameBrandModelMap = new Map();
        existingProducts.forEach((p) => {
            if (p.sku)
                skuMap.set(p.sku.trim().toUpperCase(), p);
            if (p.barcode)
                barcodeMap.set(p.barcode.trim().toUpperCase(), p);
            nameBrandModelMap.set(buildCompositeKey(p.name, p.brand, p.description), p);
        });
        let currentTotalProducts = existingProducts.length;
        let createdCount = 0;
        let updatedCount = 0;
        let priceChangesCount = 0;
        for (const item of items) {
            // Skip invalid or duplicate rows
            const validationItem = item;
            if (validationItem.status === "invalid" || validationItem.isDuplicateInFile) {
                continue;
            }
            const skuKey = (item.sku || "").trim().toUpperCase();
            const barcodeKey = (item.barcode || "").trim().toUpperCase();
            const compositeKey = buildCompositeKey(item.name, item.brand, item.spec || item.raw?.model);
            const categoryId = categoryCache.get((item.category || "GENERAL").toUpperCase()) || null;
            // 3-Tier Match: 1. SKU -> 2. Barcode -> 3. Name+Brand+Model
            let product = validationItem.matchedProductId
                ? existingProducts.find((p) => p.id === validationItem.matchedProductId)
                : (skuKey ? skuMap.get(skuKey) : undefined) ||
                    (barcodeKey ? barcodeMap.get(barcodeKey) : undefined) ||
                    nameBrandModelMap.get(compositeKey);
            if (product) {
                // Matched existing product
                if (!updateExisting)
                    continue;
                const oldPurchase = Number(product.purchase_price) || 0;
                const newPurchase = Number(item.purchase_price) || 0;
                const priceChanged = newPurchase > 0 && Math.abs(oldPurchase - newPurchase) > 0.009;
                if (priceChanged && updatePurchasePrice) {
                    // Log price change in AuditLog
                    await models_1.AuditLog.create({
                        owner_id: ownerId,
                        shop_id: shopId,
                        actor_type: actorType,
                        actor_id: actorId,
                        module: "products",
                        action: "price_change",
                        entity_type: "Product",
                        entity_id: product.id,
                        old_value: JSON.stringify({ purchase_price: oldPurchase }),
                        new_value: JSON.stringify({ purchase_price: newPurchase }),
                        details: JSON.stringify({
                            reason: "Product import purchase price update",
                            sku: product.sku,
                            name: product.name,
                        }),
                    }, { transaction: t });
                    product.purchase_price = newPurchase;
                    priceChangesCount++;
                }
                // Only update selling price if explicitly enabled by user
                if (updateSellingPrice && item.selling_price && item.selling_price > 0) {
                    product.selling_price = item.selling_price;
                    product.mrp = item.mrp || product.mrp;
                }
                // Keep metadata updated
                if (item.name && item.name !== product.name)
                    product.name = item.name;
                if (categoryId && !product.category_id)
                    product.category_id = categoryId;
                if (item.brand && !product.brand)
                    product.brand = item.brand;
                if (item.spec && !product.description)
                    product.description = item.spec;
                if (!product.supplier_id)
                    product.supplier_id = supplier.id;
                await product.save({ transaction: t });
                updatedCount++;
            }
            else {
                // Create new product
                currentTotalProducts++;
                const refCode = `PRD-${String(currentTotalProducts).padStart(6, "0")}`;
                product = await models_1.Product.create({
                    owner_id: ownerId,
                    name: item.name,
                    sku: item.sku ? item.sku.trim() : refCode,
                    barcode: item.barcode ? item.barcode.trim() : item.sku ? item.sku.trim() : refCode,
                    category_id: categoryId,
                    brand: item.brand || "ERD",
                    description: item.spec || item.category,
                    purchase_price: item.purchase_price || 0,
                    selling_price: item.selling_price || calculateSellingPrice(item.purchase_price || 0).sellingPrice,
                    mrp: item.mrp || calculateSellingPrice(item.purchase_price || 0).mrp,
                    discount: 0,
                    tax_percent: item.tax_percent !== undefined ? item.tax_percent : 18,
                    min_stock: item.min_stock || 5,
                    supplier_id: supplier.id,
                    status: item.product_status || "active",
                    reference_code: refCode,
                }, { transaction: t });
                if (product.sku)
                    skuMap.set(product.sku.toUpperCase(), product);
                if (product.barcode)
                    barcodeMap.set(product.barcode.toUpperCase(), product);
                nameBrandModelMap.set(buildCompositeKey(product.name, product.brand, product.description), product);
                createdCount++;
            }
            // Ensure ProductStock record exists for target shop, initialized to 0 stock
            // Invariant: Do not artificially inflate inventory on product import
            const stock = await models_1.ProductStock.findOne({
                where: { owner_id: ownerId, product_id: product.id, shop_id: shopId },
                transaction: t,
            });
            if (!stock) {
                await models_1.ProductStock.create({
                    owner_id: ownerId,
                    product_id: product.id,
                    shop_id: shopId,
                    current_stock: 0,
                }, { transaction: t });
            }
        }
        // Update PRD reference counter if new products were created
        if (createdCount > 0 && database_1.default.getDialect() === "postgres") {
            try {
                await database_1.default.query(`
          INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
          VALUES (${ownerId}, 'PRD', ${currentTotalProducts}, NOW(), NOW())
          ON CONFLICT (owner_id, scope)
          DO UPDATE SET last_number = ${currentTotalProducts}, updated_at = NOW();
        `, { transaction: t });
            }
            catch {
                // Table or constraint not available, safe to ignore
            }
        }
        // Overall Audit Log
        await models_1.AuditLog.create({
            owner_id: ownerId,
            shop_id: shopId,
            actor_type: actorType,
            actor_id: actorId,
            module: "products",
            action: "import",
            entity_type: "Product",
            entity_id: 0,
            details: JSON.stringify({
                notes: `Imported ${items.length} rows (${createdCount} created, ${updatedCount} updated, ${priceChangesCount} price changes) across ${uniqueCats.length} categories`,
            }),
        }, { transaction: t });
        return {
            total: items.length,
            created: createdCount,
            updated: updatedCount,
            priceChanges: priceChangesCount,
            categories: uniqueCats.length,
            categoryNames: uniqueCats,
        };
    });
}
//# sourceMappingURL=productImporter.js.map