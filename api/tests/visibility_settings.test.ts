import request from "supertest";
import app from "../src/app";
import { setupOwnerWithShop, createAndLoginEmployee } from "./helpers";
import { DEFAULT_VISIBILITY_SETTINGS } from "../src/models";

describe("Visibility Settings API", () => {
  let ownerToken: string;
  let shopId: number;
  let employeeToken: string;

  beforeAll(async () => {
    const fixture = await setupOwnerWithShop();
    ownerToken = fixture.ownerToken;
    shopId = fixture.shop.id;

    const emp = await createAndLoginEmployee(ownerToken, shopId, "Sales Staff");
    employeeToken = emp.token;
  });

  it("GET /api/settings/visibility returns default settings if none created yet", async () => {
    const res = await request(app)
      .get("/api/settings/visibility")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.show_purchase_price).toBe(true);
    expect(res.body.data.settings.show_profit).toBe(false); // Profit hidden by default
    expect(res.body.data.settings.module_emi).toBe(false); // EMI hidden by default
    expect(res.body.data.settings.product_description).toBe(false); // Description hidden by default
    expect(res.body.data.settings.nav_home).toBe(true);
  });

  it("PUT /api/settings/visibility allows owner to update toggles", async () => {
    const updated = {
      ...DEFAULT_VISIBILITY_SETTINGS,
      show_profit: true,
      module_emi: true,
      nav_orders: false,
    };

    const res = await request(app)
      .put("/api/settings/visibility")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ settings: updated });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.show_profit).toBe(true);
    expect(res.body.data.settings.module_emi).toBe(true);
    expect(res.body.data.settings.nav_orders).toBe(false);

    // Verify persisted in DB
    const getRes = await request(app)
      .get("/api/settings/visibility")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.settings.show_profit).toBe(true);
    expect(getRes.body.data.settings.module_emi).toBe(true);
    expect(getRes.body.data.settings.nav_orders).toBe(false);
  });

  it("PUT /api/settings/visibility rejects non-owner employee with 403 Forbidden", async () => {
    const res = await request(app)
      .put("/api/settings/visibility")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ settings: { show_profit: true } });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Only authorized owners");
  });

  it("POST /api/settings/visibility/reset restores defaults", async () => {
    const res = await request(app)
      .post("/api/settings/visibility/reset")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.show_profit).toBe(false);
    expect(res.body.data.settings.module_emi).toBe(false);
    expect(res.body.data.settings.nav_orders).toBe(true);
  });
});
