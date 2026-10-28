import request from "supertest";
import app from "../src/app";
import { registerOwner, createAndSwitchShop, createAndLoginEmployee } from "./helpers";

describe("Employee attendance", () => {
  it("an employee can check in and check out, and working hours are computed", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const employee = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const checkin = await request(app).post("/api/attendance/check-in").set("Authorization", `Bearer ${employee.token}`).send({});
    expect(checkin.status).toBe(201);
    expect(checkin.body.data.check_in).toBeTruthy();

    const checkout = await request(app).post("/api/attendance/check-out").set("Authorization", `Bearer ${employee.token}`).send({});
    expect(checkout.status).toBe(200);
    expect(checkout.body.data.check_out).toBeTruthy();
    expect(checkout.body.data.working_hours).toBeDefined();
  });

  it("owner/manager can bulk-mark a Holiday for all active employees", async () => {
    const owner = await registerOwner();
    const { shop, shopScopedOwnerToken: ownerToken } = await createAndSwitchShop(owner.accessToken);
    await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff", "Holiday Tester");

    const res = await request(app)
      .post("/api/attendance/bulk")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ date: "2026-01-26", status: "Holiday" });
    expect(res.status).toBe(201);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((r: any) => r.status === "Holiday")).toBe(true);
  });
});

describe("Leave", () => {
  it("an employee requests leave, and the owner can approve it, which stamps attendance as Leave", async () => {
    const owner = await registerOwner();
    const { shop, shopScopedOwnerToken: shopOwnerToken } = await createAndSwitchShop(owner.accessToken);
    const employee = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const leaveRes = await request(app)
      .post("/api/leave")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ leaveType: "Casual", startDate: "2026-02-10", endDate: "2026-02-11", reason: "Personal" });
    expect(leaveRes.status).toBe(201);
    expect(leaveRes.body.data.days).toBe(2);

    const decideRes = await request(app)
      .post(`/api/leave/${leaveRes.body.data.id}/decide`)
      .set("Authorization", `Bearer ${shopOwnerToken}`)
      .send({ decision: "approve", isPaid: true });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.status).toBe("Approved");

    const attendanceRes = await request(app)
      .get("/api/attendance")
      .set("Authorization", `Bearer ${shopOwnerToken}`)
      .query({ employeeId: employee.employeeId, from: "2026-02-10", to: "2026-02-11" });
    expect(attendanceRes.body.data.length).toBe(2);
    expect(attendanceRes.body.data.every((r: any) => r.status === "Leave")).toBe(true);
  });

  it("an employee cannot approve their own leave request (requires elevated permission)", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const employee = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const leaveRes = await request(app)
      .post("/api/leave")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ leaveType: "Casual", startDate: "2026-03-01", endDate: "2026-03-01" });

    const decideRes = await request(app)
      .post(`/api/leave/${leaveRes.body.data.id}/decide`)
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ decision: "approve" });
    expect(decideRes.status).toBe(403);
  });
});

describe("Payroll + Salary Payment", () => {
  async function setupPayrollFixture() {
    const owner = await registerOwner();
    const { shop, shopScopedOwnerToken: ownerToken } = await createAndSwitchShop(owner.accessToken);
    const employee = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff", "Payroll Employee");

    const configRes = await request(app)
      .post("/api/payroll/salary-config")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        employeeId: employee.employeeId,
        salaryType: "monthly",
        basicSalary: 30000,
        allowances: 0,
        salaryCycle: "monthly",
        effectiveDate: "2026-01-01",
      });
    expect(configRes.status).toBe(201);

    for (let day = 1; day <= 31; day++) {
      const date = `2026-01-${String(day).padStart(2, "0")}`;
      const res = await request(app)
        .post("/api/attendance")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ employeeId: employee.employeeId, date, status: "Present" });
      expect(res.status).toBe(201);
    }

    return { owner, shop, ownerToken, employee };
  }

  it("runs payroll from attendance + salary config, producing a net salary and posting the ledger", async () => {
    const { ownerToken, employee } = await setupPayrollFixture();

    const runRes = await request(app)
      .post("/api/payroll/run")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ employeeId: employee.employeeId, periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(runRes.status).toBe(201);
    const payroll = runRes.body.data;
    expect(Number(payroll.present_days)).toBe(31);
    expect(Number(payroll.net_salary)).toBe(30000);
    expect(Number(payroll.due_amount)).toBe(30000);

    const ledgerRes = await request(app).get(`/api/payroll/ledger/${employee.employeeId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.outstanding).toBe(30000);
  });

  it("records a salary payment (Cash/UPI/Bank Transfer/Cheque/Other), reducing due and updating the ledger", async () => {
    const { ownerToken, employee } = await setupPayrollFixture();

    const runRes = await request(app)
      .post("/api/payroll/run")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ employeeId: employee.employeeId, periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const payroll = runRes.body.data;

    const payRes = await request(app)
      .post(`/api/payroll/${payroll.id}/pay`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ amount: 30000, method: "bank_transfer" });
    expect(payRes.status).toBe(201);

    const finalPayroll = await request(app).get(`/api/payroll/${payroll.id}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(Number(finalPayroll.body.data.due_amount)).toBe(0);
    expect(finalPayroll.body.data.status).toBe("paid");

    const ledgerRes = await request(app).get(`/api/payroll/ledger/${employee.employeeId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(ledgerRes.body.data.outstanding).toBe(0);
  });

  it("an advance disbursed to an employee is auto-recovered from their next payroll run", async () => {
    const { ownerToken, employee } = await setupPayrollFixture();

    const advanceRes = await request(app)
      .post("/api/payroll/advances")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ employeeId: employee.employeeId, amount: 5000, method: "cash", date: "2026-01-05" });
    expect(advanceRes.status).toBe(201);

    const runRes = await request(app)
      .post("/api/payroll/run")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ employeeId: employee.employeeId, periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(runRes.status).toBe(201);
    expect(Number(runRes.body.data.advance_deduction)).toBe(5000);
    expect(Number(runRes.body.data.net_salary)).toBe(25000);
  });
});

describe("Reports", () => {
  it("sales report returns a summary structure for the owner", async () => {
    const owner = await registerOwner();
    const { shopScopedOwnerToken: ownerToken } = await createAndSwitchShop(owner.accessToken);

    const res = await request(app).get("/api/reports/sales").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(Array.isArray(res.body.data.sales)).toBe(true);
  });

  it("payroll report is blocked for an employee without salary field access", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const salesStaff = await createAndLoginEmployee(owner.accessToken, shop.id, "Sales Staff");

    const res = await request(app).get("/api/reports/payroll").set("Authorization", `Bearer ${salesStaff.token}`);
    expect(res.status).toBe(403);
  });

  it("payroll report is visible to Accountant (has salary field access)", async () => {
    const owner = await registerOwner();
    const { shop } = await createAndSwitchShop(owner.accessToken);
    const accountant = await createAndLoginEmployee(owner.accessToken, shop.id, "Accountant");

    const res = await request(app).get("/api/reports/payroll").set("Authorization", `Bearer ${accountant.token}`);
    expect(res.status).toBe(200);
  });
});
