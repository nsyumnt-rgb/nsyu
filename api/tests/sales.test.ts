import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop, createProduct, addStock, createCustomer } from "./helpers";

describe("Product + Inventory", () => {
  it("creates a product and records purchase stock", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken);
    const stock = await addStock(ownerToken, product.id, 20);
    expect(stock.currentStock).toBe(20);
  });

  it("rejects a stock movement that would take stock negative", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken);
    await addStock(ownerToken, product.id, 5);

    const res = await request(app)
      .post("/api/inventory/movement")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: product.id, type: "damage", quantity: 100 });
    expect(res.status).toBe(400);
  });
});

describe("Sale / Billing", () => {
  it("creates a fully-paid cash sale: updates inventory, bill, payment, and customer ledger together", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { selling_price: 100, tax_percent: 0, discount: 0 });
    await addStock(ownerToken, product.id, 10);
    const customer = await createCustomer(ownerToken);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: "cash",
        paidAmount: 200,
      });

    expect(saleRes.status).toBe(201);
    const sale = saleRes.body.data;
    expect(Number(sale.total_amount)).toBe(200);
    expect(Number(sale.paid_amount)).toBe(200);
    expect(Number(sale.due_amount)).toBe(0);
    expect(sale.status).toBe("paid");

    // Inventory decremented
    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(8);

    // Customer ledger shows a debit then a credit netting to 0
    const ledgerRes = await request(app).get(`/api/ledger/${customer.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
    expect(ledgerRes.body.data.entries.length).toBe(2);
  });

  it("supports partial payment and a later payment that reduces the due amount", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { selling_price: 25000, tax_percent: 0, discount: 0 });
    await addStock(ownerToken, product.id, 5);
    const customer = await createCustomer(ownerToken);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 2 }], // 50,000
        paymentMethod: "cash",
        paidAmount: 20000,
      });

    expect(saleRes.status).toBe(201);
    const sale = saleRes.body.data;
    expect(Number(sale.total_amount)).toBe(50000);
    expect(Number(sale.paid_amount)).toBe(20000);
    expect(Number(sale.due_amount)).toBe(30000);
    expect(sale.status).toBe("partially_paid");

    const payRes = await request(app)
      .post(`/api/sales/${sale.id}/payments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ amount: 30000, method: "upi" });
    expect(payRes.status).toBe(201);

    const finalSale = await request(app).get(`/api/sales/${sale.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalSale.body.data.due_amount)).toBe(0);
    expect(finalSale.body.data.status).toBe("paid");

    const ledgerRes = await request(app).get(`/api/ledger/${customer.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
  });

  it("cancels a sale: reverses inventory and clears the outstanding ledger debit, never deletes the record", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { selling_price: 100, tax_percent: 0, discount: 0 });
    await addStock(ownerToken, product.id, 10);
    const customer = await createCustomer(ownerToken);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 3 }], paymentMethod: "cash", paidAmount: 0 });
    const sale = saleRes.body.data;

    const cancelRes = await request(app)
      .post(`/api/sales/${sale.id}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reason: "Customer changed their mind" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    // Sale row still exists (never deleted)
    const getRes = await request(app).get(`/api/sales/${sale.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe("cancelled");

    // Stock restored
    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(10);

    // Ledger cleared
    const ledgerRes = await request(app).get(`/api/ledger/${customer.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(0);
  });

  it("supports a partial return: restocks inventory and credits the customer ledger", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { selling_price: 100, tax_percent: 0, discount: 0 });
    await addStock(ownerToken, product.id, 10);
    const customer = await createCustomer(ownerToken);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 4 }], paymentMethod: "cash", paidAmount: 400 });
    const sale = saleRes.body.data;
    const saleItemId = sale.items[0].id;

    const returnRes = await request(app)
      .post(`/api/sales/${sale.id}/returns`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ items: [{ saleItemId, quantity: 1 }], reason: "Defective" });
    expect(returnRes.status).toBe(201);
    expect(Number(returnRes.body.data.refund_amount)).toBe(100);

    const stockRes = await request(app).get(`/api/inventory/stock/${product.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(stockRes.body.data[0].current_stock).toBe(7); // 10 - 4 sold + 1 returned

    const finalSale = await request(app).get(`/api/sales/${sale.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalSale.body.data.total_amount)).toBe(300);
    expect(finalSale.body.data.status).toBe("partially_returned");
  });
});

describe("EMI", () => {
  it("creates an EMI sale, generates installments, and applying a payment updates payment + installment + ledger + outstanding together", async () => {
    const { ownerToken } = await setupOwnerWithShop();
    const product = await createProduct(ownerToken, { selling_price: 12000, tax_percent: 0, discount: 0 });
    await addStock(ownerToken, product.id, 5);
    const customer = await createCustomer(ownerToken);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: "cash",
        isEmi: true,
        emi: { downPayment: 2000, numberOfInstallments: 5, interestPercent: 0 },
      });

    expect(saleRes.status).toBe(201);
    const sale = saleRes.body.data;
    expect(sale.emiPlan).toBeTruthy();
    expect(sale.emiPlan.installments.length).toBe(5);
    expect(Number(sale.emiPlan.financed_amount)).toBe(10000);

    const installment = sale.emiPlan.installments[0];
    const payRes = await request(app)
      .post(`/api/emi/installments/${installment.id}/pay`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ amount: 2000, method: "cash" });
    expect(payRes.status).toBe(201);

    const planRes = await request(app).get(`/api/emi/${sale.emiPlan.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(planRes.body.data.outstanding_amount)).toBe(8000);
    const paidInstallment = planRes.body.data.installments.find((i: any) => i.id === installment.id);
    expect(paidInstallment.status).toBe("Paid");

    const finalSale = await request(app).get(`/api/sales/${sale.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalSale.body.data.due_amount)).toBe(8000);

    const ledgerRes = await request(app).get(`/api/ledger/${customer.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.currentBalance).toBe(8000);
  });
});
