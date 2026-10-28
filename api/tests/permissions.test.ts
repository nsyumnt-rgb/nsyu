import request from "supertest";
import app from "../src/app";
import { registerOwner, createAndSwitchShop, createAndLoginEmployee, createProduct } from "./helpers";

describe("Employee permissions", () => {
  it("Sales Staff cannot access the inventory module", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const res = await request(app).get("/api/inventory/history").set("Authorization", `Bearer ${salesStaff.token}`);
    expect(res.status).toBe(403);
  });

  it("Sales Staff CAN access the sales module", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const res = await request(app).get("/api/sales").set("Authorization", `Bearer ${salesStaff.token}`);
    expect(res.status).toBe(200);
  });

  it("Sales Staff without the purchase_price field permission never sees purchase_price in product responses", async () => {
    const owner = await registerOwner();
    const { shop, shopScopedOwnerToken } = await createAndSwitchShop(owner.accessToken);
    const product = await createProduct(shopScopedOwnerToken, { purchase_price: 77 });
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const res = await request(app).get(`/api/products/${product.id}`).set("Authorization", `Bearer ${salesStaff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.purchase_price).toBeUndefined();
  });

  it("Inventory Staff DOES see purchase_price (has that field permission)", async () => {
    const owner = await registerOwner();
    const { shop, shopScopedOwnerToken } = await createAndSwitchShop(owner.accessToken);
    const product = await createProduct(shopScopedOwnerToken, { purchase_price: 77 });
    const invStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Inventory Staff");

    const res = await request(app).get(`/api/products/${product.id}`).set("Authorization", `Bearer ${invStaff.token}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.data.purchase_price)).toBe(77);
  });

  it("An employee without the payroll module cannot run payroll", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const res = await request(app)
      .post("/api/payroll/run")
      .set("Authorization", `Bearer ${salesStaff.token}`)
      .send({ employeeId: 1, periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(res.status).toBe(403);
  });

  it("An employee always sees their own attendance regardless of role permissions", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const checkin = await request(app).post("/api/attendance/check-in").set("Authorization", `Bearer ${salesStaff.token}`).send({});
    expect(checkin.status).toBe(201);

    const me = await request(app).get("/api/attendance/me").set("Authorization", `Bearer ${salesStaff.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.length).toBeGreaterThan(0);
  });

  it("The owner always has full access regardless of any role", async () => {
    const owner = await registerOwner();
    const { shopScopedOwnerToken } = await createAndSwitchShop(owner.accessToken);

    const res = await request(app).get("/api/reports/sales").set("Authorization", `Bearer ${shopScopedOwnerToken}`);
    expect(res.status).toBe(200);
  });

  it("Requests without a token are rejected", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });
});
