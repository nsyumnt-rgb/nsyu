import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop } from "./helpers";
import { Product, ProductStock, AuditLog } from "../src/models";

describe("Product Bulk Import & Preview API", () => {
  it("generates preview with 3-tier matching, duplicate detection, and price change tracking", async () => {
    const { owner, ownerToken, shop } = await setupOwnerWithShop();

    // 1. Pre-seed a product in database for matching test
    await Product.create({
      owner_id: owner.ownerId,
      name: "Existing Bluetooth Earphone",
      sku: "MATCH-SKU-01",
      barcode: "8901234567890",
      brand: "Boat",
      description: "Model BT-100",
      purchase_price: 150,
      selling_price: 220,
      mrp: 300,
      discount: 0,
      tax_percent: 18,
      min_stock: 5,
      status: "active",
      reference_code: "PRD-000001",
    });

    // 2. CSV containing:
    //    - Row 1: Match by SKU with PRICE CHANGE (150 -> 175)
    //    - Row 2: Match by Barcode (new SKU, but matches DB Barcode 8901234567890) -> same product
    //    - Row 3: New Product
    //    - Row 4: Duplicate in file with Row 3 (same SKU NEW-001)
    //    - Row 5: Invalid Row (negative purchase price)
    const testCsv = `Product Name,SKU,Barcode,Category,Brand,Purchase Price,Selling Price
"Existing Bluetooth Earphone",MATCH-SKU-01,,Audio,Boat,175.00,220.00
"Different Name New Code",MATCH-CODE-BAR,8901234567890,Audio,Boat,150.00,220.00
"Brand New Smart Watch",NEW-001,WATCH-BC-1,Wearables,Noise,800.00,1200.00
"Duplicate Smart Watch",NEW-001,WATCH-BC-1,Wearables,Noise,800.00,1200.00
"Invalid Negative Price Item",INV-001,INV-BC-1,General,ERD,-50.00,100.00
`;

    // 3. Call PREVIEW endpoint
    const previewRes = await request(app)
      .post("/api/products/import/preview")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        csvText: testCsv,
        shopId: shop.id,
      });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    const preview = previewRes.body.data;

    expect(preview.summary.total).toBe(5);
    expect(preview.summary.priceChangeCount).toBe(1); // MATCH-SKU-01 (150 -> 175)
    expect(preview.summary.existingCount).toBe(1); // MATCH-CODE-BAR matched via Barcode with same price 150
    expect(preview.summary.newCount).toBe(1); // NEW-001
    expect(preview.summary.duplicateCount).toBe(1); // Row 4 duplicate SKU in file
    expect(preview.summary.invalidCount).toBe(1); // Row 5 negative price

    // Verify row statuses
    const items = preview.items;
    expect(items[0].status).toBe("price_change");
    expect(items[0].oldPurchasePrice).toBe(150);
    expect(items[0].newPurchasePrice).toBe(175);
    expect(items[0].matchTier).toBe("sku");

    expect(items[1].status).toBe("existing");
    expect(items[1].matchTier).toBe("barcode");

    expect(items[2].status).toBe("new");

    expect(items[3].status).toBe("duplicate");
    expect(items[3].isDuplicateInFile).toBe(true);

    expect(items[4].status).toBe("invalid");
    expect(items[4].validationError).toContain("negative");
  });

  it("executes product import safely: preserves inventory, preserves selling price by default, records price change in AuditLog", async () => {
    const { owner, ownerToken, shop } = await setupOwnerWithShop();

    // 1. Seed existing product
    const existing = await Product.create({
      owner_id: owner.ownerId,
      name: "Standard Charger 20W",
      sku: "CH-20W",
      brand: "ERD",
      purchase_price: 100,
      selling_price: 160,
      mrp: 200,
      discount: 0,
      tax_percent: 18,
      min_stock: 5,
      status: "active",
      reference_code: "PRD-000002",
    });

    // Create existing stock for shop
    await ProductStock.create({
      owner_id: owner.ownerId,
      product_id: existing.id,
      shop_id: shop.id,
      current_stock: 45, // Invariant: Must remain 45!
    });

    // 2. Import CSV with price change on existing product and one new product
    const importCsv = `Product Name,SKU,Category,Brand,Purchase Price,Selling Price,Stock
"Standard Charger 20W",CH-20W,CHARGER,ERD,120.00,180.00,999
"Fast Braided Cable",CBL-BRAID,CABLES,ERD,40.00,70.00,500
`;

    const res = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        csvText: importCsv,
        shopId: shop.id,
        updateExisting: true,
        updatePurchasePrice: true,
        updateSellingPrice: false, // Invariant: Selling prices are preserved by default!
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.priceChanges).toBe(1);

    // 3. Verify existing product invariants:
    //    - Purchase price updated to 120
    //    - Selling price PRESERVED at 160 (NOT overwritten by 180!)
    //    - Current stock PRESERVED at 45 (NOT inflated to 999!)
    const updatedExisting = await Product.findByPk(existing.id);
    expect(Number(updatedExisting?.purchase_price)).toBe(120);
    expect(Number(updatedExisting?.selling_price)).toBe(160);

    const stockExisting = await ProductStock.findOne({
      where: { product_id: existing.id, shop_id: shop.id },
    });
    expect(stockExisting?.current_stock).toBe(45);

    // 4. Verify new product invariants:
    //    - Created with purchase price 40 and selling price 70
    //    - Stock initialized to 0 (NOT artificially inflated to 500!)
    const newProduct = await Product.findOne({ where: { sku: "CBL-BRAID" } });
    expect(newProduct).toBeTruthy();
    expect(Number(newProduct?.purchase_price)).toBe(40);
    expect(Number(newProduct?.selling_price)).toBe(70);

    const stockNew = await ProductStock.findOne({
      where: { product_id: newProduct?.id, shop_id: shop.id },
    });
    expect(stockNew).toBeTruthy();
    expect(stockNew?.current_stock).toBe(0); // Invariant: No fake inventory inflation!

    // 5. Verify price change AuditLog entry was written
    const audit = await AuditLog.findOne({
      where: {
        entity_type: "Product",
        entity_id: existing.id,
        action: "price_change",
      },
    });
    expect(audit).toBeTruthy();
    expect(audit?.old_value).toContain("100");
    expect(audit?.new_value).toContain("120");
  });

  it("handles ERD Order Format properly without artificial stock transactions", async () => {
    const { ownerToken, shop } = await setupOwnerWithShop();

    const erdCsv = `ERD ORDER FORMAT MOBILE ACCESSORIES AUGUST-2026,,,,,,,,
S.No.,CODE NO.,PRODUCT DESCRIPTION,Voltage/Amp/Type,STD.PKG.,REQ. QTY.,"PRICE \n(INCL. GST)",TOTAL,
,,TC - MOBILE CHARGER SINGLE USB,,,,,,
1,ERD-TC01,ERD TC-30 USB-A DOCK CHARGER BLK,5V DC - 500mA. (2.5W),20,,67,0,
2,ERD-TC02,ERD TC-201 USB-A DOCK CHARGER BLK 5W,5V DC - 1 Amp. (5W),20,,76,0,
`;

    const res = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        csvText: erdCsv,
        shopId: shop.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.created).toBe(2);

    const p1 = await Product.findOne({ where: { sku: "ERD-TC01" } });
    expect(p1).toBeTruthy();
    expect(Number(p1?.purchase_price)).toBe(67);
    expect(Number(p1?.selling_price)).toBe(77); // 67 + 10 margin for new product

    const p1Stock = await ProductStock.findOne({ where: { product_id: p1?.id, shop_id: shop.id } });
    expect(p1Stock?.current_stock).toBe(0); // Initialized to 0, not fake std.pkg 20!
  });

  it("supports file uploads (.csv and .xlsx) via multipart form data", async () => {
    const { ownerToken, shop } = await setupOwnerWithShop();
    const xlsx = require("xlsx");

    // Generate in-memory Excel workbook (.xlsx)
    const wb = xlsx.utils.book_new();
    const wsData = [
      ["Product Name", "SKU", "Category", "Brand", "Purchase Price", "Selling Price"],
      ["Excel Power Bank 20000mAh", "XL-PB20", "POWER BANK", "ERD", 850, 1100],
      ["Excel USB Cable 3A", "XL-CBL03", "CABLES", "ERD", 45, 75],
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Products");
    const xlsxBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // 1. Test preview with XLSX upload
    const previewRes = await request(app)
      .post("/api/products/import/preview")
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("file", xlsxBuffer, "catalog.xlsx")
      .field("shopId", shop.id);

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    expect(previewRes.body.data.summary.total).toBe(2);
    expect(previewRes.body.data.summary.newCount).toBe(2);

    // 2. Test import execute with XLSX upload
    const importRes = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("file", xlsxBuffer, "catalog.xlsx")
      .field("shopId", shop.id);

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.data.created).toBe(2);

    const importedItem = await Product.findOne({ where: { sku: "XL-PB20" } });
    expect(importedItem).toBeTruthy();
    expect(Number(importedItem?.purchase_price)).toBe(850);
  });
});
