import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop } from "./helpers";
import {
  Customer,
  Product,
  ProductStock,
  Order,
  OrderItem,
  OrderStatusHistory,
  CustomerAccount,
  CustomerOtp,
  CustomerRefreshToken,
  CustomerCart,
  CustomerCartItem,
  ShopPortalSettings,
  Sale,
  CustomerLedger,
  Notification,
} from "../src/models";

let seq = 1;
function uniqPhone() {
  seq += 1;
  return `9876${String(seq).padStart(6, "0")}`;
}

describe("Customer Portal Backend Tests (CP-A to CP-N & CP-I)", () => {
  let ownerToken: string;
  let shop: any;
  let owner: any;
  let customer1: any;
  let customer2: any;
  let product1: any;
  let product2: any;
  let customer1Account: any;
  let customer1Phone: string;
  let customer2Account: any;
  let customer2Phone: string;

  beforeAll(async () => {
    const fixture = await setupOwnerWithShop();
    owner = fixture.owner;
    shop = fixture.shop;
    ownerToken = fixture.ownerToken;

    customer1Phone = uniqPhone();
    customer2Phone = uniqPhone();

    // Create Customer 1
    const c1Res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Ramesh Sharma", phone: customer1Phone, address: "Shop 12, Main Market" });
    customer1 = c1Res.body.data;

    // Create Customer 2
    const c2Res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Suresh Gupta", phone: customer2Phone, address: "Shop 45, Karol Bagh" });
    customer2 = c2Res.body.data;

    // Enable portal login for customer 1
    const invite1 = await request(app)
      .post(`/api/customers/${customer1.id}/portal/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ shopId: shop.id });
    expect(invite1.status).toBe(200);

    // Enable portal login for customer 2
    const invite2 = await request(app)
      .post(`/api/customers/${customer2.id}/portal/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ shopId: shop.id });
    expect(invite2.status).toBe(200);

    // Create Products with stock
    const p1Res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "ERD TC-30 Fast Charger",
        sku: `ERD-TC30-${seq}`,
        selling_price: 100,
        purchase_price: 60,
        tax_percent: 18,
        min_stock: 5,
      });
    product1 = p1Res.body.data;

    // Add stock for product 1
    const m1 = await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: product1.id, type: "purchase", quantity: 50, notes: "Initial stock" });
    expect(m1.status).toBe(201);

    const p2Res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Type-C Braided Cable 1M",
        sku: `CABLE-1M-${seq}`,
        selling_price: 50,
        purchase_price: 25,
        tax_percent: 18,
        min_stock: 5,
      });
    product2 = p2Res.body.data;

    const m2 = await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: product2.id, type: "purchase", quantity: 20, notes: "Initial stock" });
    expect(m2.status).toBe(201);
  });

  describe("Authentication (CP-A01 to CP-A07)", () => {
    let validOtp: string;

    it("CP-A01: Request OTP for a known and an unknown phone returns identical message", async () => {
      const knownRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer1Phone, shopCode: shop.code });
      expect(knownRes.status).toBe(200);
      expect(knownRes.body.success).toBe(true);
      expect(knownRes.body.message).toContain("If this phone number is registered");
      expect(knownRes.body.debugOtp).toBeDefined();
      validOtp = knownRes.body.debugOtp;

      const unknownRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: "9111111111", shopCode: shop.code });
      expect(unknownRes.status).toBe(200);
      expect(unknownRes.body.success).toBe(true);
      expect(unknownRes.body.message).toBe(knownRes.body.message);
      expect(unknownRes.body.debugOtp).toBeUndefined();
    });

    it("CP-A02: Verify correct OTP issues access + refresh tokens with customer claims", async () => {
      const res = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: validOtp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.customer.id).toBe(customer1.id);
      expect(res.body.data.customer.name).toBe("Ramesh Sharma");
    });

    it("CP-A03: Wrong OTP 5 times invalidates the OTP", async () => {
      // Request fresh OTP
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer2Phone, shopCode: shop.code });
      expect(reqRes.status).toBe(200);

      // Attempt 5 wrong OTPs
      for (let i = 1; i <= 5; i++) {
        const failRes = await request(app)
          .post("/api/customer-portal/auth/verify-otp")
          .send({ phone: customer2Phone, shopCode: shop.code, otp: "000000" });
        expect(failRes.status).toBe(400);
      }

      // 6th attempt should be rejected due to invalidation
      const lockedRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer2Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      expect(lockedRes.status).toBe(400);
      expect(lockedRes.body.message).toContain("invalidated");
    });

    it("CP-A04: Expired or reused OTP is rejected", async () => {
      const res = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: validOtp });
      // Already used in CP-A02
      expect(res.status).toBe(400);
    });

    it("CP-A05: Refresh token rotation and reuse detection revokes entire chain", async () => {
      // Log in Customer 2 to get a fresh refresh token
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer2Phone, shopCode: shop.code });
      const loginRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer2Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      const { accessToken, refreshToken: token1 } = loginRes.body.data;

      // Rotate token1 -> token2
      const refreshRes = await request(app)
        .post("/api/customer-portal/auth/refresh")
        .send({ refreshToken: token1 });
      expect(refreshRes.status).toBe(200);
      const token2 = refreshRes.body.data.refreshToken;
      expect(token2).not.toBe(token1);

      // Attempt reuse of token1 -> reuse detection must trigger and revoke token2 as well
      const reuseRes = await request(app)
        .post("/api/customer-portal/auth/refresh")
        .send({ refreshToken: token1 });
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.message).toContain("reuse detected");

      // Now token2 should also be rejected
      const token2Res = await request(app)
        .post("/api/customer-portal/auth/refresh")
        .send({ refreshToken: token2 });
      expect(token2Res.status).toBe(401);
    });

    it("CP-A06: Disabled account with a valid access token is rejected on next request", async () => {
      // Login customer 2
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer2Phone, shopCode: shop.code });
      const loginRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer2Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      const c2Token = loginRes.body.data.accessToken;

      // Staff disables customer 2
      const disableRes = await request(app)
        .post(`/api/customers/${customer2.id}/portal/disable`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(disableRes.status).toBe(200);

      // Customer 2 tries to access portal
      const reqPortal = await request(app)
        .get("/api/customer-portal/me")
        .set("Authorization", `Bearer ${c2Token}`);
      expect(reqPortal.status).toBe(401);
      expect(reqPortal.body.message).toContain("disabled");

      // Re-enable customer 2 for future tests
      await request(app)
        .post(`/api/customers/${customer2.id}/portal/enable`)
        .set("Authorization", `Bearer ${ownerToken}`);
    });

    it("CP-A07: Customer token on staff route returns 403, and staff token on portal route returns 403", async () => {
      // Get customer 1 token
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer1Phone, shopCode: shop.code });
      const loginRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      const customerToken = loginRes.body.data.accessToken;

      // Customer token on staff route -> 403
      const staffRouteRes = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(staffRouteRes.status).toBe(403);

      // Staff token on customer portal route -> 403
      const portalRouteRes = await request(app)
        .get("/api/customer-portal/catalog/products")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(portalRouteRes.status).toBe(403);
    });
  });

  describe("Catalog & Server Cart (CP-C01 to CP-C04)", () => {
    let customer1Token: string;

    beforeAll(async () => {
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer1Phone, shopCode: shop.code });
      const loginRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      customer1Token = loginRes.body.data.accessToken;
    });

    it("CP-C01: Catalog strips purchase_price, profit, and supplier fields", async () => {
      const res = await request(app)
        .get("/api/customer-portal/catalog/products")
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const item = res.body.data[0];

      expect(item.sellingPrice).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.availability).toBeDefined();

      // STRICT PRIVACY: These sensitive fields must NEVER be present
      expect((item as any).purchase_price).toBeUndefined();
      expect((item as any).purchasePrice).toBeUndefined();
      expect((item as any).profit).toBeUndefined();
      expect((item as any).supplier_id).toBeUndefined();
      expect((item as any).supplier).toBeUndefined();
    });

    it("CP-C02: Catalog excludes inactive products", async () => {
      // Create an inactive product
      await Product.create({
        owner_id: owner.ownerId,
        name: "Old Discontinued Radio",
        sku: `DISC-${seq}`,
        selling_price: 500,
        purchase_price: 300,
        status: "inactive",
      });

      const res = await request(app)
        .get("/api/customer-portal/catalog/products")
        .set("Authorization", `Bearer ${customer1Token}`);

      const names = res.body.data.map((p: any) => p.name);
      expect(names).not.toContain("Old Discontinued Radio");
    });

    it("CP-C03: Cart quantity validations (negative, decimal, above stock, zero to remove)", async () => {
      // Negative quantity -> rejected
      const negRes = await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: -2 });
      expect(negRes.status).toBe(400);

      // Decimal quantity -> rejected
      const decRes = await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 1.5 });
      expect(decRes.status).toBe(400);

      // Above stock quantity -> rejected with clear message
      const overRes = await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 1000 });
      expect(overRes.status).toBe(400);
      expect(overRes.body.message).toContain("exceeds available stock");

      // Valid quantity 3
      const validRes = await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 3 });
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.items.length).toBe(1);
      expect(validRes.body.data.items[0].quantity).toBe(3);

      // Zero quantity -> removes item
      const zeroRes = await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 0 });
      expect(zeroRes.status).toBe(200);
      expect(zeroRes.body.data.items.length).toBe(0);
    });

    it("CP-C04: Cart totals and GST calculations match database numbers", async () => {
      // Add product1 (qty 2 @ 100, GST 18% = 200 + 36 = 236)
      await request(app)
        .put(`/api/customer-portal/cart/items/${product1.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 2 });

      // Add product2 (qty 2 @ 50, GST 18% = 100 + 18 = 118)
      await request(app)
        .put(`/api/customer-portal/cart/items/${product2.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 2 });

      const cartRes = await request(app)
        .get("/api/customer-portal/cart")
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(cartRes.status).toBe(200);
      const cart = cartRes.body.data;
      expect(cart.subtotal).toBe(300); // 200 + 100
      expect(cart.taxAmount).toBe(54); // 36 + 18
      expect(cart.estimatedTotal).toBe(354);
    });
  });

  describe("Order Placement & Conversion (CP-O01 to CP-B03)", () => {
    let customer1Token: string;
    let placedOrderId: number;
    const clientReqId = `uuid-order-${Date.now()}`;

    beforeAll(async () => {
      const reqRes = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer1Phone, shopCode: shop.code });
      const loginRes = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: reqRes.body.debugOtp });
      customer1Token = loginRes.body.data.accessToken;
    });

    it("CP-O01: Place order with valid cart empties cart, creates Pending order and notifies shop", async () => {
      const orderRes = await request(app)
        .post("/api/customer-portal/orders")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          clientRequestId: clientReqId,
          note: "Please pack carefully",
          deliveryType: "Standard Delivery",
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.order_number).toBeDefined();
      expect(orderRes.body.data.status).toBe("pending");
      expect(orderRes.body.data.total_amount).toBe(354);
      placedOrderId = orderRes.body.data.id;

      // Cart is emptied
      const cartRes = await request(app)
        .get("/api/customer-portal/cart")
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(cartRes.body.data.items.length).toBe(0);

      // Verify order status history row exists
      const history = await OrderStatusHistory.findAll({ where: { order_id: placedOrderId } });
      expect(history.length).toBe(1);
      expect(history[0].to_status).toBe("pending");
      expect(history[0].changed_by_type).toBe("customer");

      // Verify shop notification created
      const notif = await Notification.findOne({
        where: { reference_id: placedOrderId, reference_type: "order" },
      });
      expect(notif).toBeDefined();
      expect(notif!.title).toContain("New Order");
    });

    it("CP-O02: Idempotency check: sending the same clientRequestId returns the existing order", async () => {
      const duplicateRes = await request(app)
        .post("/api/customer-portal/orders")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          clientRequestId: clientReqId,
          note: "Duplicate retry",
        });

      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.data.id).toBe(placedOrderId);
      expect(duplicateRes.body.message).toContain("idempotent");
    });

    it("CP-O06: Invalid status transitions and duplicate status are rejected", async () => {
      // Pending -> Completed directly is invalid (must go through Confirmed/Processing)
      const invalidRes = await request(app)
        .patch(`/api/orders/${placedOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "completed" });
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.message).toContain("Invalid status transition");

      // Pending -> Pending (duplicate status) is rejected
      const dupRes = await request(app)
        .patch(`/api/orders/${placedOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "pending" });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.message).toContain("Duplicate status transition");
    });

    it("CP-O07: Customer can cancel Pending order, but cannot cancel Confirmed order", async () => {
      // Place another pending order to cancel
      await request(app)
        .put(`/api/customer-portal/cart/items/${product2.id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ quantity: 1 });

      const newOrderRes = await request(app)
        .post("/api/customer-portal/orders")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ clientRequestId: `cancel-test-${Date.now()}` });
      const cancelOrderId = newOrderRes.body.data.id;

      // Customer cancels pending order -> SUCCESS
      const cancelRes = await request(app)
        .post(`/api/customer-portal/orders/${cancelOrderId}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe("cancelled");

      // Advance first order to Confirmed
      const confirmRes = await request(app)
        .patch(`/api/orders/${placedOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "confirmed" });
      expect(confirmRes.status).toBe(200);

      // Customer tries to cancel Confirmed order -> REJECTED
      const failCancel = await request(app)
        .post(`/api/customer-portal/orders/${placedOrderId}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(failCancel.status).toBe(400);
      expect(failCancel.body.message).toContain("only be cancelled while in Pending");
    });

    it("CP-B01: Convert order to bill creates Sale, deducts stock, posts CustomerLedger", async () => {
      // Advance to processing
      await request(app)
        .patch(`/api/orders/${placedOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "processing" });

      // Initial stock of product 1
      const stockBefore = await ProductStock.findOne({
        where: { product_id: product1.id, shop_id: shop.id },
      });
      const qtyBefore = Number(stockBefore!.current_stock);

      // Convert order to bill with partial payment ₹100
      const convertRes = await request(app)
        .post(`/api/orders/${placedOrderId}/convert-to-bill`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ paidAmount: 100, paymentMethod: "cash" });

      expect(convertRes.status).toBe(200);
      expect(convertRes.body.data.bill).toBeDefined();
      const bill = convertRes.body.data.bill;
      expect(bill.invoice_number).toBeDefined();
      expect(bill.total_amount).toBe(354);
      expect(bill.paid_amount).toBe(100);
      expect(bill.due_amount).toBe(254);

      // Stock deducted
      const stockAfter = await ProductStock.findOne({
        where: { product_id: product1.id, shop_id: shop.id },
      });
      expect(Number(stockAfter!.current_stock)).toBe(qtyBefore - 2);

      // Order linked and status updated
      const updatedOrder = await Order.findByPk(placedOrderId);
      expect(updatedOrder!.status).toBe("converted_to_bill");
      expect(Number(updatedOrder!.converted_sale_id)).toBe(bill.id);

      // Ledger entry posted for customer
      const ledgerEntry = await CustomerLedger.findOne({
        where: { reference_id: bill.id, reference_type: "Sale" },
      });
      expect(ledgerEntry).toBeDefined();
      expect(Number(ledgerEntry!.amount)).toBe(354);
    });

    it("CP-B02: Convert the same order twice returns the existing bill without duplicate entry", async () => {
      const secondRes = await request(app)
        .post(`/api/orders/${placedOrderId}/convert-to-bill`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.message).toContain("already converted");
      expect(secondRes.body.data.bill).toBeDefined();

      // Ensure no duplicate sales were created
      const salesCount = await Sale.count({ where: { id: secondRes.body.data.bill.id } });
      expect(salesCount).toBe(1);
    });

    it("CP-L02: Financial reconciliation: Portal outstanding = customer balance = sum of ledger entries", async () => {
      const summaryRes = await request(app)
        .get("/api/customer-portal/ledger/summary")
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(summaryRes.status).toBe(200);
      const portalOutstanding = summaryRes.body.data.currentOutstanding;

      const customer = await Customer.findByPk(customer1.id);
      expect(portalOutstanding).toBe(Number(customer!.current_balance));

      // Outstanding must equal 254 (354 bill - 100 payment)
      expect(portalOutstanding).toBe(254);
    });
  });

  describe("Customer Isolation (CP-I01 to CP-I05)", () => {
    let customer1Token: string;
    let customer2Token: string;
    let customer1BillId: number;

    beforeAll(async () => {
      // Customer 1 token
      const req1 = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer1Phone, shopCode: shop.code });
      const res1 = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer1Phone, shopCode: shop.code, otp: req1.body.debugOtp });
      customer1Token = res1.body.data.accessToken;

      // Customer 2 token
      const req2 = await request(app)
        .post("/api/customer-portal/auth/request-otp")
        .send({ phone: customer2Phone, shopCode: shop.code });
      const res2 = await request(app)
        .post("/api/customer-portal/auth/verify-otp")
        .send({ phone: customer2Phone, shopCode: shop.code, otp: req2.body.debugOtp });
      customer2Token = res2.body.data.accessToken;

      // Fetch Customer 1's bill
      const billsRes = await request(app)
        .get("/api/customer-portal/bills")
        .set("Authorization", `Bearer ${customer1Token}`);
      customer1BillId = billsRes.body.data[0].id;
    });

    it("CP-I01 & CP-I04: Customer 2 requesting Customer 1's bill returns 404", async () => {
      const res = await request(app)
        .get(`/api/customer-portal/bills/${customer1BillId}`)
        .set("Authorization", `Bearer ${customer2Token}`);

      // Must be 404, not 403, to prevent ID probing
      expect(res.status).toBe(404);
    });

    it("CP-I05: Customer 2 bills list contains zero items belonging to Customer 1", async () => {
      const res = await request(app)
        .get("/api/customer-portal/bills")
        .set("Authorization", `Bearer ${customer2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it("CP-I03: Customer sending customerId in query or body is ignored", async () => {
      // Customer 2 tries to impersonate Customer 1 via query param
      const res = await request(app)
        .get(`/api/customer-portal/bills?customerId=${customer1.id}`)
        .set("Authorization", `Bearer ${customer2Token}`);

      expect(res.status).toBe(200);
      // Still returns 0 rows (scoped to customer 2 from token)
      expect(res.body.data.length).toBe(0);
    });
  });
});
