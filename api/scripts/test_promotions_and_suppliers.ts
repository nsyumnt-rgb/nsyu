/**
 * Test Suite: Promotional Announcements, SMS Provider, and Supplier Self-Service Portal
 * Isolated in-memory SQLite, throwaway fixtures, real HTTP API calls.
 * Run via: npm run test:promotions-suppliers
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.NODE_ENV = "test";

import path from "path";
const API = process.argv[2] || path.join(__dirname, "..", "src");
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { sequelize, Owner, Shop, ShopPortalSettings, Supplier, Purchase, PurchaseItem, SupplierLedger, Customer, CustomerAccount, Product } = models;
const jwtUtils = require(`${API}/utils/jwt`);
const bcrypt = require("bcryptjs");

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

  const owner = await Owner.create({
    name: "Test Owner",
    email: "owner@test.local",
    password: "hash",
    is_super_admin: false,
  });

  const shop = await Shop.create({
    owner_id: owner.id,
    name: "Metro Wholesale",
    code: "MWH",
    status: "active",
  });

  const otherOwner = await Owner.create({
    name: "Other Owner",
    email: "other@test.local",
    password: "hash",
    is_super_admin: false,
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}/api`;

  const ownerToken = jwtUtils.signAccessToken({
    ownerId: owner.id,
    isOwner: true,
    shopId: shop.id,
    roleId: null,
  });

  const otherOwnerToken = jwtUtils.signAccessToken({
    ownerId: otherOwner.id,
    isOwner: true,
    shopId: null,
    roleId: null,
  });

  console.log("\n1. Promotional Announcements in Shop Settings");
  // 1. Owner updates shop portal settings with announcement
  const updateRes = await fetch(`${base}/shops/${shop.id}/portal-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      announcement_banner: "📢 Diwali Flash Sale: 10% off on all wholesale orders!",
      announcement_active: true,
      privacy_policy: "We safeguard customer contact details.",
    }),
  });
  const updateJson = await updateRes.json();
  check("owner can save announcement banner", updateRes.status === 200 && updateJson.data.announcement_active === true);
  check("announcement text is stored accurately", updateJson.data.announcement_banner.includes("Diwali Flash Sale"));

  // 2. Customer portal policies endpoint returns the active announcement
  const customer = await Customer.create({
    owner_id: owner.id,
    name: "Rahul Customer",
    phone: "9876543210",
  });
  const account = await CustomerAccount.create({
    customer_id: customer.id,
    shop_id: shop.id,
    owner_id: owner.id,
    phone: "9876543210",
    status: "active",
  });

  const customerToken = jwtUtils.signAccessToken({
    ownerId: owner.id,
    shopId: shop.id,
    customerId: customer.id,
    accountId: account.id,
    isCustomer: true,
  });

  const custPoliciesRes = await fetch(`${base}/customer-portal/shop/policies`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const custPoliciesJson = await custPoliciesRes.json();
  check("customer portal policies API returns active announcement", custPoliciesRes.status === 200 && custPoliciesJson.data.announcement.includes("Diwali Flash Sale"));

  // 3. Deactivating announcement banner hides it from customer
  await fetch(`${base}/shops/${shop.id}/portal-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ announcement_active: false }),
  });
  const hiddenPoliciesRes = await fetch(`${base}/customer-portal/shop/policies`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const hiddenPoliciesJson = await hiddenPoliciesRes.json();
  check("deactivated announcement returns null to customer", hiddenPoliciesJson.data.announcement === null);

  console.log("\n2. Supplier Portal Authentication & Access");
  // 1. Owner creates supplier with portal password
  const supPasswordHash = await bcrypt.hash("SupplierPass123!", 10);
  const supplier = await Supplier.create({
    owner_id: owner.id,
    name: "ABC Electronics Distributors",
    phone: "9876501234",
    email: "sales@abc-electronics.local",
    status: "active",
    opening_balance: 5000,
    current_balance: 5000,
    password_hash: supPasswordHash,
  });

  // 2. Supplier login with wrong password
  const wrongLoginRes = await fetch(`${base}/supplier-portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "9876501234", password: "wrongpassword" }),
  });
  check("supplier login with wrong password returns 401", wrongLoginRes.status === 401);

  // 3. Supplier login with correct password via phone
  const phoneLoginRes = await fetch(`${base}/supplier-portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "9876501234", password: "SupplierPass123!" }),
  });
  const phoneLoginJson = await phoneLoginRes.json();
  check("supplier phone login returns 200", phoneLoginRes.status === 200 && phoneLoginJson.success === true);
  check("supplier token is returned", Boolean(phoneLoginJson.data.accessToken));
  const supplierToken = phoneLoginJson.data.accessToken;

  // 4. Supplier login with email
  const emailLoginRes = await fetch(`${base}/supplier-portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "sales@abc-electronics.local", password: "SupplierPass123!" }),
  });
  check("supplier email login returns 200", emailLoginRes.status === 200);

  console.log("\n3. Supplier Purchase Orders & Ledger");
  // 1. Create a purchase order from Shop to Supplier
  const purchase = await Purchase.create({
    owner_id: owner.id,
    shop_id: shop.id,
    supplier_id: supplier.id,
    purchase_number: "PUR000001",
    purchase_date: new Date(),
    subtotal: 10000,
    tax_amount: 1800,
    total_amount: 11800,
    paid_amount: 5000,
    status: "ordered",
    payment_status: "partial",
    actor_type: "owner",
    actor_id: owner.id,
  });

  const product = await Product.create({
    owner_id: owner.id,
    shop_id: shop.id,
    name: "Power Adapters",
    sku: "PWR-01",
    purchase_price: 200,
    selling_price: 350,
  });

  await PurchaseItem.create({
    purchase_id: purchase.id,
    product_id: product.id,
    product_name: "Power Adapters",
    quantity: 50,
    rate: 200,
    amount: 10000,
  });

  await SupplierLedger.create({
    owner_id: owner.id,
    shop_id: shop.id,
    supplier_id: supplier.id,
    entry_type: "credit",
    amount: 11800,
    running_balance: 16800,
    reference_type: "Purchase",
    reference_id: purchase.id,
    description: "Purchase PUR000001",
    actor_type: "owner",
    actor_id: owner.id,
  });

  // 2. Supplier lists purchases
  const supPurchasesRes = await fetch(`${base}/supplier-portal/purchases`, {
    headers: { Authorization: `Bearer ${supplierToken}` },
  });
  const supPurchasesJson = await supPurchasesRes.json();
  check("supplier can list purchase orders", supPurchasesRes.status === 200 && supPurchasesJson.data.length === 1);
  check("purchase order contains items and shop info", supPurchasesJson.data[0].items.length === 1 && supPurchasesJson.data[0].shop.name === "Metro Wholesale");

  // 3. Supplier views ledger
  const supLedgerRes = await fetch(`${base}/supplier-portal/ledger`, {
    headers: { Authorization: `Bearer ${supplierToken}` },
  });
  const supLedgerJson = await supLedgerRes.json();
  check("supplier can view their ledger statement", supLedgerRes.status === 200 && supLedgerJson.data.entries.length === 1);
  check("ledger shows correct payable balance", supLedgerJson.data.currentBalance === 5000);

  // 4. Supplier token cannot access staff routes
  const staffProbeRes = await fetch(`${base}/customers`, {
    headers: { Authorization: `Bearer ${supplierToken}` },
  });
  check("supplier token rejected on staff endpoints (403)", staffProbeRes.status === 403);

  // 5. Customer token cannot access supplier portal
  const custProbeRes = await fetch(`${base}/supplier-portal/purchases`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  check("customer token rejected on supplier portal (403)", custProbeRes.status === 403);

  console.log("\n4. Supplier Password Change");
  const changePwdRes = await fetch(`${base}/supplier-portal/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ currentPassword: "SupplierPass123!", newPassword: "NewSecureSupplierPass456!" }),
  });
  check("supplier can change their password", changePwdRes.status === 200);

  const newLoginRes = await fetch(`${base}/supplier-portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "9876501234", password: "NewSecureSupplierPass456!" }),
  });
  check("supplier can log in with new password", newLoginRes.status === 200);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  server.close();
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
