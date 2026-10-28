import { sequelize, Owner, Shop, Product, Customer, Sale, Purchase, EMIPlan, Payroll, Attendance, LeaveRequest, Notification } from "../src/models";
import { seedDemoData } from "../src/seed/seed";
import { resetDemoData } from "../src/seed/reset";
import { DEMO_MARKER_EMAIL } from "../src/seed/seedData";

describe("Demo data seeding", () => {
  it("creates a complete, internally-consistent demo dataset on first run", async () => {
    await seedDemoData();

    const owner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
    expect(owner).toBeTruthy();

    const shops = await Shop.findAll({ where: { owner_id: owner!.id } });
    expect(shops.length).toBe(2);

    const products = await Product.findAll({ where: { owner_id: owner!.id } });
    expect(products.length).toBe(20);

    const customers = await Customer.findAll({ where: { owner_id: owner!.id } });
    expect(customers.length).toBe(10);

    const sales = await Sale.findAll({ where: { owner_id: owner!.id } });
    expect(sales.length).toBeGreaterThanOrEqual(15);

    // Every sale's paid+due must equal its total (financial consistency, not just row counts)
    for (const sale of sales) {
      expect(Number(sale.paid_amount) + Number(sale.due_amount)).toBeCloseTo(Number(sale.total_amount), 2);
    }

    const purchases = await Purchase.findAll({ where: { owner_id: owner!.id } });
    expect(purchases.length).toBeGreaterThanOrEqual(7);
    for (const purchase of purchases) {
      expect(Number(purchase.paid_amount) + Number(purchase.due_amount)).toBeCloseTo(Number(purchase.total_amount), 2);
    }

    const emiPlans = await EMIPlan.findAll({ where: { owner_id: owner!.id } });
    expect(emiPlans.length).toBe(2);

    const payrolls = await Payroll.findAll({ where: { owner_id: owner!.id } });
    expect(payrolls.length).toBe(4);
    for (const p of payrolls) {
      expect(Number(p.paid_amount) + Number(p.due_amount)).toBeCloseTo(Number(p.net_salary), 2);
    }

    const attendance = await Attendance.findAll({ where: { owner_id: owner!.id } });
    expect(attendance.length).toBeGreaterThan(50);

    const leaves = await LeaveRequest.findAll({ where: { owner_id: owner!.id } });
    expect(leaves.length).toBe(4);

    const notifications = await Notification.findAll({ where: { owner_id: owner!.id } });
    expect(notifications.length).toBe(4);
  });

  it("is idempotent — running it again does not duplicate any data", async () => {
    await seedDemoData();
    await seedDemoData();
    await seedDemoData();

    const owners = await Owner.findAll({ where: { email: DEMO_MARKER_EMAIL } });
    expect(owners.length).toBe(1);

    const products = await Product.findAll({ where: { owner_id: owners[0].id } });
    expect(products.length).toBe(20); // still 20, not 40 or 60
  });

  it("reset removes only the demo owner's data, and seeding can run again afterwards", async () => {
    await seedDemoData();
    let owner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
    expect(owner).toBeTruthy();

    await resetDemoData();

    owner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
    expect(owner).toBeNull();

    const products = await Product.findAll();
    expect(products.length).toBe(0);

    // Re-seed after reset should work cleanly
    await seedDemoData();
    owner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
    expect(owner).toBeTruthy();
    const productsAfter = await Product.findAll({ where: { owner_id: owner!.id } });
    expect(productsAfter.length).toBe(20);
  });

  it("reset never touches a real (non-demo) owner's data", async () => {
    await seedDemoData();

    const realOwner = await Owner.create({ name: "Real Shop Owner", email: "real.owner@example.com", password: "hashed" });
    const realShop = await Shop.create({ owner_id: realOwner.id, name: "Real Shop", code: "REAL01" });
    const realProduct = await Product.create({
      owner_id: realOwner.id,
      name: "Real Product",
      sku: "REAL-SKU-1",
      purchase_price: 10,
      selling_price: 20,
      mrp: 25,
    });

    await resetDemoData();

    const stillThereOwner = await Owner.findByPk(realOwner.id);
    const stillThereShop = await Shop.findByPk(realShop.id);
    const stillThereProduct = await Product.findByPk(realProduct.id);
    expect(stillThereOwner).toBeTruthy();
    expect(stillThereShop).toBeTruthy();
    expect(stillThereProduct).toBeTruthy();

    const demoOwner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
    expect(demoOwner).toBeNull();
  });
});
