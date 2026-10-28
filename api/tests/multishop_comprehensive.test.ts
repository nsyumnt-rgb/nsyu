import request from "supertest";
import app from "../src/app";
import { registerOwner, createAndSwitchShop, createProduct, createAndLoginEmployee } from "./helpers";

describe("Comprehensive Multiple-Shop Business Logic & Security", () => {
  it("Owner A and Owner B have completely isolated shops and data", async () => {
    const ownerA = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(ownerA.accessToken, "Owner A Electronics");

    const ownerB = await registerOwner();
    const { shop: shopB, shopScopedOwnerToken: tokenB } = await createAndSwitchShop(ownerB.accessToken, "Owner B Mobile");

    // Owner B cannot access Owner A's shop
    const getShopRes = await request(app)
      .get(`/api/shops/${shopA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(getShopRes.status).toBe(404);

    // Owner B cannot switch into Owner A's shop
    const switchRes = await request(app)
      .post("/api/shops/switch")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ shopId: shopA.id });
    expect([403, 404]).toContain(switchRes.status);
  });

  it("Shop A and Shop B have strictly independent inventory", async () => {
    const owner = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(owner.accessToken, "Shop Alpha");
    const { shop: shopB, shopScopedOwnerToken: tokenB } = await createAndSwitchShop(owner.accessToken, "Shop Beta");

    // Create a catalog product (shared master record across owner's shops)
    const product = await createProduct(tokenA);

    // Add 50 units stock to Shop A
    const moveResA = await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ productId: product.id, type: "purchase", quantity: 50 });
    expect(moveResA.status).toBe(201);
    expect(moveResA.body.data.currentStock).toBe(50);

    // Check stock in Shop B: must be 0
    const moveResB = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(moveResB.status).toBe(200);

    const prodInB = moveResB.body.data.find((p: any) => p.id === product.id);
    expect(prodInB).toBeDefined();
    const stockInB = prodInB.stocks?.find((s: any) => s.shop_id === shopB.id)?.current_stock ?? 0;
    expect(stockInB).toBe(0);
  });

  it("A sale in Shop A deducts inventory only in Shop A and attributes ledger to Shop A", async () => {
    const owner = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(owner.accessToken, "Shop Sales A");
    const { shop: shopB, shopScopedOwnerToken: tokenB } = await createAndSwitchShop(owner.accessToken, "Shop Sales B");

    const product = await createProduct(tokenA);

    // Stock in 20 units in Shop A and 10 units in Shop B
    await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ productId: product.id, type: "purchase", quantity: 20 });

    await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ productId: product.id, type: "purchase", quantity: 10 });

    // Create Customer
    const custRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Multi-Shop Customer", phone: "9876500001" });
    const customerId = custRes.body.data.id;

    // Make sale of 5 units in Shop A
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        customerId,
        items: [{ productId: product.id, quantity: 5, unitPrice: 200 }],
        paidAmount: 500,
        paymentMethod: "cash",
      });
    expect(saleRes.status).toBe(201);
    const sale = saleRes.body.data;
    expect(sale.shop_id).toBe(shopA.id);

    // Verify stock in Shop A is now 15
    const prodResA = await request(app).get("/api/products").set("Authorization", `Bearer ${tokenA}`);
    const stockA = prodResA.body.data.find((p: any) => p.id === product.id)?.stocks?.find((s: any) => s.shop_id === shopA.id)?.current_stock;
    expect(stockA).toBe(15);

    // Verify stock in Shop B is still 10 (unaffected!)
    const prodResB = await request(app).get("/api/products").set("Authorization", `Bearer ${tokenB}`);
    const stockB = prodResB.body.data.find((p: any) => p.id === product.id)?.stocks?.find((s: any) => s.shop_id === shopB.id)?.current_stock;
    expect(stockB).toBe(10);

    // Verify Customer Ledger has shop_id attributed to Shop A
    const ledgerRes = await request(app)
      .get(`/api/ledger/customer/${customerId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(ledgerRes.body.data.entries[0].shop_id).toBe(shopA.id);
  });

  it("Blocks shop deletion when historical records or transactions exist", async () => {
    const owner = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(owner.accessToken, "Shop NonDeletable");
    const product = await createProduct(tokenA);

    // Create a transaction in Shop A
    await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ productId: product.id, type: "purchase", quantity: 10 });

    // Attempt to delete Shop A
    const deleteRes = await request(app)
      .delete(`/api/shops/${shopA.id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    // Must be blocked (400 Bad Request) to protect audit and historical records
    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toContain("deactivate");
  });

  it("Deactivating a shop blocks employees from switching into it while preserving history", async () => {
    const owner = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(owner.accessToken, "Shop Active");
    const employee = await createAndLoginEmployee(owner.accessToken, shopA.id, "Manager", "Active Manager");

    // Owner deactivates the shop
    const deactRes = await request(app)
      .patch(`/api/shops/${shopA.id}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "inactive" });
    expect(deactRes.status).toBe(200);

    // Employee switching into deactivated shop must be blocked (403)
    const switchRes = await request(app)
      .post("/api/shops/switch")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ shopId: shopA.id });
    expect(switchRes.status).toBe(403);
  });
});
