import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop, createProduct } from "./helpers";

async function createSupplier(token: string, overrides: Record<string, any> = {}) {
  const res = await request(app).post("/api/suppliers").set("Authorization", `Bearer ${token}`).send({ name: "Test Supplier", phone: "9800000000", ...overrides });
  if (res.status !== 201) throw new Error(`createSupplier failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

describe("Purchase module", () => {
  it("creates a fully-paid purchase: increases inventory and updates supplier ledger together", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { purchase_price: 100 });
    const supplier = await createSupplier(ownerToken);

    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 10 }], paymentMethod: "cash", paidAmount: 1000 });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;
    expect(Number(purchase.total_amount)).toBe(1000);
    expect(Number(purchase.due_amount)).toBe(0);
    expect(purchase.status).toBe("paid");

    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(10);

    const ledgerRes = await request(app).get(`/api/supplier-ledger/${supplier.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
  });

  it("supports a partial-payment purchase (credit purchase), then a later payment clearing the due amount", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { purchase_price: 200 });
    const supplier = await createSupplier(ownerToken);

    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 10 }], paymentMethod: "bank_transfer", paidAmount: 500 });
    const purchase = purchaseRes.body.data;
    expect(Number(purchase.due_amount)).toBe(1500);
    expect(purchase.status).toBe("partially_paid");

    let ledgerRes = await request(app).get(`/api/supplier-ledger/${supplier.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(1500);

    const payRes = await request(app)
      .post(`/api/purchases/${purchase.id}/payments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ amount: 1500, method: "upi" });
    expect(payRes.status).toBe(201);

    const finalPurchase = await request(app).get(`/api/purchases/${purchase.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalPurchase.body.data.due_amount)).toBe(0);
    expect(finalPurchase.body.data.status).toBe("paid");

    ledgerRes = await request(app).get(`/api/supplier-ledger/${supplier.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
  });

  it("cancels a purchase: reverses inventory and closes the outstanding supplier ledger credit", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { purchase_price: 50 });
    const supplier = await createSupplier(ownerToken);

    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 20 }], paymentMethod: "cash", paidAmount: 0 });
    const purchase = purchaseRes.body.data;

    const cancelRes = await request(app).post(`/api/purchases/${purchase.id}/cancel`).set("Authorization", `Bearer ${ownerToken}`).send({ reason: "Wrong order" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(0);

    const ledgerRes = await request(app).get(`/api/supplier-ledger/${supplier.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
  });

  it("supports a partial purchase return: decreases inventory and debits the supplier ledger", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { purchase_price: 100 });
    const supplier = await createSupplier(ownerToken);

    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 10 }], paymentMethod: "cash", paidAmount: 1000 });
    const purchase = purchaseRes.body.data;
    const purchaseItemId = purchase.items[0].id;

    const returnRes = await request(app)
      .post(`/api/purchases/${purchase.id}/returns`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ items: [{ purchaseItemId, quantity: 2 }], reason: "Damaged goods" });
    expect(returnRes.status).toBe(201);
    expect(Number(returnRes.body.data.refund_amount)).toBe(200);

    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(8); // 10 received - 2 returned

    const finalPurchase = await request(app).get(`/api/purchases/${purchase.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalPurchase.body.data.total_amount)).toBe(800);
    expect(finalPurchase.body.data.status).toBe("partially_returned");

    const ledgerRes = await request(app).get(`/api/supplier-ledger/${supplier.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(-200); // paid 1000 for goods now worth 800 → supplier owes back 200
  });

  it("Supplier CRUD: create, update, deactivate", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const supplier = await createSupplier(ownerToken, { name: "Original Name" });

    const updateRes = await request(app)
      .put(`/api/suppliers/${supplier.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Name" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Updated Name");

    const statusRes = await request(app)
      .patch(`/api/suppliers/${supplier.id}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "inactive" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("inactive");

    const listRes = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${ownerToken}`);
    expect(listRes.body.data.find((s: any) => s.id === supplier.id)).toBeUndefined(); // default list is active-only
  });
});
