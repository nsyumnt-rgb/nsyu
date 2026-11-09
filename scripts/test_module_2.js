const path = require("path");
const request = require(path.join(__dirname, "../api/node_modules/supertest"));

const app = require("../api/dist/app").default;
const { sequelize } = require("../api/dist/models");

async function runTest() {
  console.log("🧪 Starting Module 2 Backend Verification Test...\n");
  try {
    await sequelize.authenticate();
    console.log("✔ Database connection established.");

    // 1. Test Super Admin Login
    console.log("\n1. Testing Super Admin login...");
    const superAdminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "superadmin@nsyu.com", password: "SuperAdmin@123" });

    if (superAdminRes.status !== 200 || !superAdminRes.body.data?.accessToken) {
      throw new Error(`Super Admin login failed: ${superAdminRes.status} ${JSON.stringify(superAdminRes.body)}`);
    }

    const superAdminToken = superAdminRes.body.data.accessToken;
    console.log("✔ Super Admin logged in successfully!");
    console.log("  Account Type:", superAdminRes.body.data.accountType);
    console.log("  isSuperAdmin:", superAdminRes.body.data.isSuperAdmin);

    // 2. Test GET /api/admin/dashboard
    console.log("\n2. Testing GET /api/admin/dashboard...");
    const dashRes = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${superAdminToken}`);

    if (dashRes.status !== 200) {
      throw new Error(`Failed to get admin dashboard: ${dashRes.status} ${JSON.stringify(dashRes.body)}`);
    }
    console.log("✔ Admin Dashboard returned real metrics:");
    console.log("  Total Shops:", dashRes.body.data.total_shops);
    console.log("  Active Shops:", dashRes.body.data.active_shops);
    console.log("  Total Users:", dashRes.body.data.total_users);
    console.log("  Total Sales Amount:", dashRes.body.data.total_sales_amount);
    console.log("  Total Sales Count:", dashRes.body.data.total_sales_count);

    // 3. Test GET /api/admin/shops
    console.log("\n3. Testing GET /api/admin/shops...");
    const shopsRes = await request(app)
      .get("/api/admin/shops")
      .set("Authorization", `Bearer ${superAdminToken}`);

    if (shopsRes.status !== 200) {
      throw new Error(`Failed to get shops: ${shopsRes.status} ${JSON.stringify(shopsRes.body)}`);
    }
    console.log(`✔ Admin Shops listed (${shopsRes.body.data.length} shop(s) found)`);

    // 4. Test GET /api/admin/owners
    console.log("\n4. Testing GET /api/admin/owners...");
    const ownersRes = await request(app)
      .get("/api/admin/owners")
      .set("Authorization", `Bearer ${superAdminToken}`);

    if (ownersRes.status !== 200) {
      throw new Error(`Failed to get owners: ${ownersRes.status} ${JSON.stringify(ownersRes.body)}`);
    }
    console.log(`✔ Admin Owners listed (${ownersRes.body.data.length} owner(s) found)`);

    // 5. Test Regular Owner Security Boundary (Rejection on /api/admin/*)
    console.log("\n5. Testing regular owner login & admin route rejection...");
    const ownerRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "nsyu.mnt@gmail.com", password: "Password@123" });

    if (ownerRes.status !== 200) {
      throw new Error(`Regular owner login failed: ${ownerRes.status} ${JSON.stringify(ownerRes.body)}`);
    }
    const ownerToken = ownerRes.body.data.accessToken;
    console.log("✔ Regular Owner logged in:", ownerRes.body.data.owner.email);

    const forbiddenRes = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${ownerToken}`);

    if (forbiddenRes.status !== 403) {
      throw new Error(`Security violation! Regular owner received status ${forbiddenRes.status} instead of 403`);
    }
    console.log("✔ Regular Owner strictly rejected from /api/admin/dashboard with 403 Forbidden!");

    // 6. Test Platform Audit Log
    console.log("\n6. Testing GET /api/admin/audit-logs...");
    const logsRes = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${superAdminToken}`);

    if (logsRes.status !== 200) {
      throw new Error(`Failed to get audit logs: ${logsRes.status} ${JSON.stringify(logsRes.body)}`);
    }
    console.log(`✔ Audit logs fetched (${logsRes.body.data.total} total log entries recorded)`);

    console.log("\n🎉 ALL MODULE 2 BACKEND CORE & SUPER ADMIN API TESTS PASSED 100%!");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runTest();
