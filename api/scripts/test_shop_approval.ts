/**
 * MultiShop Phase 1 Step 5 — Admin Shop Approval Test.
 * Isolated: in-memory SQLite, throwaway fixtures, real HTTP. Never touches the configured DB.
 *   npm run test:shop-approval
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { sequelize, Owner, Shop, Notification, PlatformAuditLog, StatusHistory } = models;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwtUtils = require(`${API}/utils/jwt`);

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra?: any) => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : "");
  }
};

async function main() {
  await sequelize.sync({ force: true });

  const superAdmin = await Owner.create({
    name: "Super Admin",
    email: "superadmin@test.local",
    password: "hash",
    is_super_admin: true,
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}/api`;

  const superToken = jwtUtils.signAccessToken({
    ownerId: superAdmin.id,
    isOwner: true,
    isSuperAdmin: true,
    shopId: null,
    roleId: null,
  });

  console.log("1. Shop Registration and Status");
  // 1. Owner registers a new business account
  const regRes = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ramesh Sharma",
      email: "ramesh@test.local",
      password: "Password123!",
      shopName: "Sharma Superstore",
    }),
  });
  const regJson = await regRes.json();
  check("new owner registration returns 201", regRes.status === 201, regJson);
  check("registration mentions pending admin approval", regJson.message?.includes("approval"), regJson);

  const newShop = await Shop.findOne({ where: { owner_id: regJson.data?.owner?.id } });
  check("new shop has status 'pending_approval'", newShop?.status === "pending_approval", newShop?.status);

  // 2. Pending shop hidden from public marketplace
  const marketShopsRes = await fetch(`${base}/marketplace/shops`);
  const marketShopsJson = await marketShopsRes.json();
  const foundInMarket = (marketShopsJson.data || []).some((s: any) => s.id === newShop?.id);
  check("pending shop is hidden from public marketplace", !foundInMarket);

  console.log("2. Super Admin Dashboard Metrics");
  // 3. Super admin dashboard reports pending shop
  const dashRes = await fetch(`${base}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${superToken}` },
  });
  const dashJson = await dashRes.json();
  check("admin dashboard includes pending_shops count", dashJson.data?.pending_shops >= 1, dashJson.data);

  console.log("3. Super Admin Approval Flow");
  // 4. Super admin approves the shop
  const approveRes = await fetch(`${base}/admin/shops/${newShop?.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${superToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Documents verified" }),
  });
  const approveJson = await approveRes.json();
  check("approve endpoint returns 200", approveRes.status === 200, approveJson);
  check("approved shop status is now 'active'", approveJson.data?.status === "active", approveJson.data);

  // 5. Check owner received notification
  const notif = await Notification.findOne({
    where: { owner_id: newShop?.owner_id, reference_type: "shop" },
  });
  check("owner received approval notification", notif !== null && notif.title?.includes("Approved"));

  // 6. Approved shop now visible in marketplace
  const marketShopsAfter = await fetch(`${base}/marketplace/shops`);
  const marketShopsAfterJson = await marketShopsAfter.json();
  const foundAfterApprove = (marketShopsAfterJson.data || []).some((s: any) => s.id === newShop?.id);
  check("approved shop now appears on public marketplace", foundAfterApprove);

  console.log("4. Super Admin Status Toggling");
  // 7. Super admin can suspend shop
  const suspendRes = await fetch(`${base}/admin/shops/${newShop?.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${superToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "suspended", reason: "Policy violation" }),
  });
  const suspendJson = await suspendRes.json();
  check("suspend endpoint returns 200", suspendRes.status === 200);
  check("shop status changed to suspended", suspendJson.data?.status === "suspended");

  // 8. Suspended shop hidden from marketplace again
  const marketAfterSuspend = await fetch(`${base}/marketplace/shops`);
  const marketAfterSuspendJson = await marketAfterSuspend.json();
  const foundAfterSuspend = (marketAfterSuspendJson.data || []).some((s: any) => s.id === newShop?.id);
  check("suspended shop is hidden from marketplace", !foundAfterSuspend);

  server.close();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
