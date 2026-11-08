import request from "supertest";
import app from "../src/app";
import { registerOwner, createAndSwitchShop, uniq } from "./helpers";
import { Product, ProductStock } from "../src/models";

describe("Cart UI/UX Representation & Workflow Verification", () => {
  let ownerToken: string;
  let shop: any;
  let customerToken: string;
  let product1: any;
  let product2: any;
  const seq = uniq("");

  beforeAll(async () => {
    const fixture = await registerOwner("Cart Workflow Owner");
    const shopSetup = await createAndSwitchShop(fixture.accessToken, "Delhi Main Hub");
    shop = shopSetup.shop;
    ownerToken = shopSetup.shopScopedOwnerToken;

    // 1. Create 2 real products in database
    const p1Res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "ERD TC-30 USB-A Fast Charger",
        sku: `ERD-TC30-${seq}`,
        selling_price: 150,
        purchase_price: 90,
        tax_percent: 18,
        min_stock: 5,
      });
    expect(p1Res.status).toBe(201);
    product1 = p1Res.body.data;

    // Add stock for product 1
    await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: product1.id, type: "purchase", quantity: 50, notes: "Initial stock" });

    const p2Res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Braided Type-C Fast Cable 1.5M",
        sku: `CABLE-TYPEC-${seq}`,
        selling_price: 80,
        purchase_price: 40,
        tax_percent: 18,
        min_stock: 5,
      });
    expect(p2Res.status).toBe(201);
    product2 = p2Res.body.data;

    // Add stock for product 2
    await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: product2.id, type: "purchase", quantity: 30, notes: "Initial stock" });

    // 2. Create customer with registered email & mobile
    const custPhone = "9" + Math.floor(100000000 + Math.random() * 900000000).toString();
    const custEmail = `sharmaji_${seq}@example.com`;
    const custRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Sharma Ji Communication",
        phone: custPhone,
        email: custEmail,
        address: "Shop No. 12, Main Market, Jasola, New Delhi - 110025",
      });
    expect(custRes.status).toBe(201);
    const customer = custRes.body.data;

    // Invite customer to portal
    await request(app)
      .post(`/api/customers/${customer.id}/portal/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ shopId: shop.id });

    // Request 4-digit OTP via email
    const otpRes = await request(app)
      .post("/api/customer-portal/auth/request-otp")
      .send({ identifier: custEmail, shopCode: shop.code });
    expect(otpRes.status).toBe(200);
    const otp = otpRes.body.debugOtp;
    expect(otp).toHaveLength(4);

    // Verify OTP to get customer token
    const verifyRes = await request(app)
      .post("/api/customer-portal/auth/verify-otp")
      .send({ identifier: custEmail, shopCode: shop.code, otp });
    expect(verifyRes.status).toBe(200);
    customerToken = verifyRes.body.data.accessToken;
  });

  it("Step 1 & 2: Add Product 1 to cart and verify its representation (Product Name & Icon/Image availability)", async () => {
    const addRes = await request(app)
      .put(`/api/customer-portal/cart/items/${product1.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 2 });

    expect(addRes.status).toBe(200);
    const cart = addRes.body.data;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(product1.id);
    expect(cart.items[0].name).toBe("ERD TC-30 USB-A Fast Charger");
    expect(cart.items[0].quantity).toBe(2);
    // Verified: Name is complete and accurate, image/icon container is supported
    expect(cart.items[0].imageUrl).toBeDefined();
  });

  it("Step 3 & 4: Add multiple different products and verify all appear cleanly", async () => {
    const addRes2 = await request(app)
      .put(`/api/customer-portal/cart/items/${product2.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 5 });

    expect(addRes2.status).toBe(200);
    const cart = addRes2.body.data;
    expect(cart.items).toHaveLength(2);

    const names = cart.items.map((i: any) => i.name);
    expect(names).toContain("ERD TC-30 USB-A Fast Charger");
    expect(names).toContain("Braided Type-C Fast Cable 1.5M");
  });

  it("Step 5: Remove a product and verify immediate UI / cart update", async () => {
    const delRes = await request(app)
      .delete(`/api/customer-portal/cart/items/${product1.id}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(delRes.status).toBe(200);
    const cart = delRes.body.data;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(product2.id);
    expect(cart.items[0].name).toBe("Braided Type-C Fast Cable 1.5M");
  });

  it("Step 6 & 7: Navigate away & return to verify cart consistency & cross-platform synchronization", async () => {
    // Fresh GET call simulating web/mobile opening or returning to Cart
    const getRes = await request(app)
      .get("/api/customer-portal/cart")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(getRes.status).toBe(200);
    const cart = getRes.body.data;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(product2.id);
    expect(cart.items[0].name).toBe("Braided Type-C Fast Cable 1.5M");
    expect(cart.items[0].quantity).toBe(5);
  });
});

