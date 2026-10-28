import request from "supertest";
import app from "../src/app";
import { registerOwner, createAndSwitchShop, createProduct, createAndLoginEmployee } from "./helpers";

describe("Multi-owner isolation", () => {
  it("Owner B cannot see Owner A's products", async () => {
    const ownerA = await registerOwner();
    const { shopScopedOwnerToken: tokenA } = await createAndSwitchShop(ownerA.accessToken);
    const product = await createProduct(tokenA);

    const ownerB = await registerOwner();
    const { shopScopedOwnerToken: tokenB } = await createAndSwitchShop(ownerB.accessToken);

    const res = await request(app).get(`/api/products/${product.id}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("Owner B cannot see Owner A's customers", async () => {
    const ownerA = await registerOwner();
    const { shopScopedOwnerToken: tokenA } = await createAndSwitchShop(ownerA.accessToken);
    const custRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Owner A's Customer" });
    const customerId = custRes.body.data.id;

    const ownerB = await registerOwner();
    const { shopScopedOwnerToken: tokenB } = await createAndSwitchShop(ownerB.accessToken);

    const res = await request(app).get(`/api/customers/${customerId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("Owner B's employee list never contains Owner A's employees", async () => {
    const ownerA = await registerOwner();
    const { shop: shopA } = await createAndSwitchShop(ownerA.accessToken);
    await createAndLoginEmployee(ownerA.accessToken, shopA.id, "Manager", "Alice");

    const ownerB = await registerOwner();
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${ownerB.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.find((e: any) => e.name === "Alice")).toBeUndefined();
  });
});

describe("Multi-shop isolation", () => {
  it("An employee assigned only to Shop A cannot switch into Shop B", async () => {
    const owner = await registerOwner();
    const { shop: shopA } = await createAndSwitchShop(owner.accessToken, "Shop A");
    const { shop: shopB } = await createAndSwitchShop(owner.accessToken, "Shop B");

    const employee = await createAndLoginEmployee(owner.accessToken, shopA.id, "Manager");

    // Reuse the already-issued (Shop A scoped) token rather than logging in again —
    // switching shop only needs a valid access token, not a fresh login.
    const switchRes = await request(app)
      .post("/api/shops/switch")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ shopId: shopB.id });

    expect(switchRes.status).toBe(403);
  });

  it("an employee in Shop B cannot see Shop A's inventory in the inventory report (owner CAN see both, by design)", async () => {
    const owner = await registerOwner();
    const { shop: shopA, shopScopedOwnerToken: tokenA } = await createAndSwitchShop(owner.accessToken, "Shop A");
    const { shop: shopB } = await createAndSwitchShop(owner.accessToken, "Shop B");

    const product = await createProduct(tokenA);
    await request(app).post("/api/inventory/movement").set("Authorization", `Bearer ${tokenA}`).send({ productId: product.id, type: "purchase", quantity: 10 });

    const employeeB = await createAndLoginEmployee(owner.accessToken, shopB.id, "Manager");
    const reportB = await request(app).get("/api/reports/inventory").set("Authorization", `Bearer ${employeeB.token}`);
    expect(reportB.status).toBe(200);
    const line = reportB.body.data.lines.find((l: any) => l.product.id === product.id);
    expect(line).toBeUndefined();

    // The owner, by contrast, can see it either unfiltered (all shops) or by explicitly filtering to Shop A
    const reportOwnerAll = await request(app).get("/api/reports/inventory").set("Authorization", `Bearer ${tokenA}`);
    expect(reportOwnerAll.body.data.lines.find((l: any) => l.product.id === product.id)).toBeTruthy();

    const reportOwnerFilteredToB = await request(app)
      .get("/api/reports/inventory")
      .set("Authorization", `Bearer ${tokenA}`)
      .query({ shopId: shopB.id });
    expect(reportOwnerFilteredToB.body.data.lines.find((l: any) => l.product.id === product.id)).toBeUndefined();
  });

  it("An employee's attendance report only shows staff assigned to their own shop", async () => {
    const owner = await registerOwner();
    const { shop: shopA } = await createAndSwitchShop(owner.accessToken, "Shop A");
    const { shop: shopB } = await createAndSwitchShop(owner.accessToken, "Shop B");

    const managerA = await createAndLoginEmployee(owner.accessToken, shopA.id, "Manager", "Manager A");
    const managerB = await createAndLoginEmployee(owner.accessToken, shopB.id, "Manager", "Manager B");

    // Both punch in so there's real attendance data to potentially leak
    await request(app).post("/api/attendance/check-in").set("Authorization", `Bearer ${managerA.token}`).send({});
    await request(app).post("/api/attendance/check-in").set("Authorization", `Bearer ${managerB.token}`).send({});

    const res = await request(app).get("/api/reports/attendance").set("Authorization", `Bearer ${managerA.token}`);
    expect(res.status).toBe(200);
    const names = res.body.data.employees.map((e: any) => e.name);
    expect(names).toContain("Manager A");
    expect(names).not.toContain("Manager B");
  });
});
