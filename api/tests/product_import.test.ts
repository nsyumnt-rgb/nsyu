import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop } from "./helpers";
import { Product, Category, ProductStock } from "../src/models";

describe("Product Bulk Import API", () => {
  it("imports products using ERD Order Sheet CSV format with categories and calculates margins", async () => {
    const { ownerToken, shop } = await setupOwnerWithShop();

    const erdCsv = `ERD ORDER FORMAT MOBILE ACCESSORIES AUGUST-2026,,,,,,,,
S.No.,CODE NO.,PRODUCT DESCRIPTION,Voltage/Amp/Type,STD.PKG.,REQ. QTY.,"PRICE \n(INCL. GST)",TOTAL,
,,TC - MOBILE CHARGER SINGLE USB,,,,,,
1,TEST-TC01,TEST TC-30 USB-A DOCK CHARGER BLK,5V DC - 500mA. (2.5W),20,,67,0,
2,TEST-TC02,TEST TC-201 USB-A DOCK CHARGER BLK 5W,5V DC - 1 Amp. (5W),20,,76,0,
,,POWER BANK,,,,,,
3,TEST-PB01,TEST PB-10KE POWER BANK 10000MAH,10000 mAh,10,,467,0,
,,,Total,,0,,0,
Terms & Conditions :,,,,,,,,
,1. The Prices are inclusive GST & F.O.R. Destination.,,,,,,,
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
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.created).toBe(3);

    // Verify products in database
    const p1 = await Product.findOne({ where: { sku: "TEST-TC01" } });
    expect(p1).toBeTruthy();
    expect(p1?.name).toBe("TEST TC-30 USB-A DOCK CHARGER BLK");
    expect(Number(p1?.purchase_price)).toBe(67);
    expect(Number(p1?.selling_price)).toBe(77); // 67 + 10 = 77
    expect(p1?.status).toBe("active");

    const p3 = await Product.findOne({ where: { sku: "TEST-PB01" } });
    expect(p3).toBeTruthy();
    expect(Number(p3?.purchase_price)).toBe(467);
    expect(Number(p3?.selling_price)).toBe(467 + Math.round(467 * 0.2)); // 467 + 93 = 560

    // Verify stock created in target shop
    const stock1 = await ProductStock.findOne({ where: { product_id: p1?.id, shop_id: shop.id } });
    expect(stock1).toBeTruthy();
    expect(stock1?.current_stock).toBe(20);

    // Re-import with updated price should update existing products (upsert)
    const updatedCsv = `ERD ORDER FORMAT MOBILE ACCESSORIES AUGUST-2026,,,,,,,,
S.No.,CODE NO.,PRODUCT DESCRIPTION,Voltage/Amp/Type,STD.PKG.,REQ. QTY.,"PRICE \n(INCL. GST)",TOTAL,
,,TC - MOBILE CHARGER SINGLE USB,,,,,,
1,TEST-TC01,TEST TC-30 USB-A DOCK CHARGER BLK V2,5V DC - 500mA. (2.5W),20,,70,0,
`;

    const res2 = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        csvText: updatedCsv,
        shopId: shop.id,
      });

    expect(res2.status).toBe(200);
    expect(res2.body.data.total).toBe(1);
    expect(res2.body.data.updated).toBe(1);
    expect(res2.body.data.created).toBe(0);

    const p1Updated = await Product.findOne({ where: { sku: "TEST-TC01" } });
    expect(p1Updated?.name).toBe("TEST TC-30 USB-A DOCK CHARGER BLK V2");
    expect(Number(p1Updated?.purchase_price)).toBe(70);
    expect(Number(p1Updated?.selling_price)).toBe(80);
  });

  it("imports products using standard CSV format", async () => {
    const { ownerToken, shop } = await setupOwnerWithShop();

    const standardCsv = `Name,SKU,Category,Brand,Purchase Price,Selling Price,Stock
Type-C Fast Cable,STD-C01,Cables,ERD,50,75,40
Wireless Earbuds,STD-EB01,Audio,ERD,400,550,15
`;

    const res = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        csvText: standardCsv,
        shopId: shop.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.created).toBe(2);

    const c1 = await Product.findOne({ where: { sku: "STD-C01" } });
    expect(c1).toBeTruthy();
    expect(Number(c1?.selling_price)).toBe(75);
    expect(Number(c1?.purchase_price)).toBe(50);
  });
});
