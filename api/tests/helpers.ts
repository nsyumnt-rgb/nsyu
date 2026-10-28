import request from "supertest";
import app from "../src/app";

let counter = 0;
/** Unique-per-call suffix so parallel test cases never collide on unique email/sku/code constraints. */
export function uniq(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

interface OwnerFixture {
  ownerId: number;
  email: string;
  password: string;
  accessToken: string; // no shop selected yet
}

/** Registers a brand-new Owner account (gets the standard seeded roles automatically). */
export async function registerOwner(name = "Test Owner"): Promise<OwnerFixture> {
  const email = `${uniq("owner")}@example.com`;
  const password = "Password123!";
  const res = await request(app).post("/api/auth/register").send({ name, email, password });
  if (res.status !== 201) throw new Error(`registerOwner failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ownerId: res.body.data.owner.id, email, password, accessToken: res.body.data.accessToken };
}

/** Creates a shop under the given owner token, and returns a NEW access token scoped to that shop. */
export async function createAndSwitchShop(ownerAccessToken: string, name = "Main Shop") {
  const code = uniq("SHOP");
  const createRes = await request(app)
    .post("/api/shops")
    .set("Authorization", `Bearer ${ownerAccessToken}`)
    .send({ name, code });
  if (createRes.status !== 201) throw new Error(`createShop failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  const shop = createRes.body.data;

  const switchRes = await request(app)
    .post("/api/shops/switch")
    .set("Authorization", `Bearer ${ownerAccessToken}`)
    .send({ shopId: shop.id });
  if (switchRes.status !== 200) throw new Error(`switchShop failed: ${switchRes.status} ${JSON.stringify(switchRes.body)}`);

  return { shop, shopScopedOwnerToken: switchRes.body.data.accessToken as string };
}

/** Full setup: a fresh owner with one shop, owner token scoped to it. */
export async function setupOwnerWithShop() {
  const owner = await registerOwner();
  const { shop, shopScopedOwnerToken } = await createAndSwitchShop(owner.accessToken);
  return { owner, shop, ownerToken: shopScopedOwnerToken, ownerGlobalToken: owner.accessToken };
}

/** Lists roles for the owner and returns the one matching `name` (e.g. "Manager", "Sales Staff"). */
export async function getRoleByName(ownerToken: string, name: string) {
  const res = await request(app).get("/api/roles").set("Authorization", `Bearer ${ownerToken}`);
  if (res.status !== 200) throw new Error(`listRoles failed: ${res.status} ${JSON.stringify(res.body)}`);
  const role = res.body.data.find((r: any) => r.name === name);
  if (!role) throw new Error(`Role "${name}" not found among: ${res.body.data.map((r: any) => r.name).join(", ")}`);
  return role;
}

/**
 * Creates an employee, assigns them to `shopId` with the role named
 * `roleName` (default "Manager" — full access), logs them in, and
 * switches them into that shop. Returns a shop-scoped access token.
 */
export async function createAndLoginEmployee(
  ownerToken: string,
  shopId: number,
  roleName = "Manager",
  name = "Test Employee"
) {
  const email = `${uniq("emp")}@example.com`;
  const password = "Password123!";

  const createRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name, email, password });
  if (createRes.status !== 201) throw new Error(`createEmployee failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  const employeeId = createRes.body.data.id;

  const role = await getRoleByName(ownerToken, roleName);

  const assignRes = await request(app)
    .post("/api/employees/assign-shop")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ employeeId, shopId, roleId: role.id });
  if (assignRes.status !== 200 && assignRes.status !== 201) {
    throw new Error(`assignShopRole failed: ${assignRes.status} ${JSON.stringify(assignRes.body)}`);
  }

  const loginRes = await request(app).post("/api/auth/login").send({ email, password });
  if (loginRes.status !== 200) throw new Error(`employee login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);

  const switchRes = await request(app)
    .post("/api/shops/switch")
    .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
    .send({ shopId });
  if (switchRes.status !== 200) throw new Error(`employee switchShop failed: ${switchRes.status} ${JSON.stringify(switchRes.body)}`);

  return { employeeId, email, password, token: switchRes.body.data.accessToken as string };
}

/** Creates a product under the owner's catalog. Returns the created product. */
export async function createProduct(ownerToken: string, overrides: Record<string, any> = {}) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      name: "Test Product",
      sku: uniq("SKU"),
      purchase_price: 100,
      selling_price: 150,
      mrp: 180,
      discount: 0,
      tax_percent: 0,
      min_stock: 5,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createProduct failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Adds opening stock to a product at the given (shop-scoped) token's active shop. */
export async function addStock(shopScopedToken: string, productId: number, quantity: number) {
  const res = await request(app)
    .post("/api/inventory/movement")
    .set("Authorization", `Bearer ${shopScopedToken}`)
    .send({ productId, type: "purchase", quantity });
  if (res.status !== 201) throw new Error(`addStock failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Creates a customer under the owner's account. */
export async function createCustomer(shopScopedToken: string, overrides: Record<string, any> = {}) {
  const res = await request(app)
    .post("/api/customers")
    .set("Authorization", `Bearer ${shopScopedToken}`)
    .send({ name: "Test Customer", phone: "9999999999", ...overrides });
  if (res.status !== 201) throw new Error(`createCustomer failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}
