/**
 * MultiShop Phase 1 — public marketplace API test.
 * Isolated: in-memory SQLite, throwaway fixtures, real HTTP. Never touches the configured DB.
 *   npm run test:marketplace
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import path from "path";

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const models = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { sequelize, Owner, Shop, Product, ProductStock, Category, ProductImage } = models;

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
  const A = await Owner.create({ name: "Owner A", email: "ma@test.local", password: "x" });
  const B = await Owner.create({ name: "Owner B", email: "mb@test.local", password: "x" });
  const shopA = await Shop.create({ owner_id: A.id, name: "Alpha Mobiles", code: "ALPHA", status: "active", address: "MG Road" });
  const shopB = await Shop.create({ owner_id: B.id, name: "Beta Electronics", code: "BETA", status: "active" });
  const shopX = await Shop.create({ owner_id: B.id, name: "Suspended Store", code: "SUSP", status: "suspended" });

  const catA = await Category.create({ owner_id: A.id, name: "Chargers" });
  const catB = await Category.create({ owner_id: B.id, name: "Chargers" });
  const catB2 = await Category.create({ owner_id: B.id, name: "Cables" });

  const mk = (owner: any, name: string, extra: any) =>
    Product.create({ owner_id: owner.id, name, sku: `${name.slice(0, 6)}-${Math.random().toString(36).slice(2, 6)}`, purchase_price: 11, ...extra });
  const a1 = await mk(A, "Turbo Charger 65W", { brand: "ERD", barcode: "8900001", selling_price: 1200, mrp: 1500, category_id: catA.id });
  const a2 = await mk(A, "Old Cable", { selling_price: 99, category_id: catA.id, status: "inactive" });
  const b1 = await mk(B, "turbo  charger 65w", { brand: "erd", selling_price: 1100, mrp: 1500, category_id: catB.id }); // same by name+brand
  const b2 = await mk(B, "Different Name", { brand: "X", barcode: "8900001", selling_price: 1300, category_id: catB.id }); // same by barcode
  const b3 = await mk(B, "USB-C Cable", { brand: "ERD", selling_price: 250, category_id: catB2.id });

  await ProductStock.bulkCreate([
    { owner_id: A.id, shop_id: shopA.id, product_id: a1.id, current_stock: 5 },
    { owner_id: B.id, shop_id: shopB.id, product_id: b1.id, current_stock: 0 },
    { owner_id: B.id, shop_id: shopB.id, product_id: b2.id, current_stock: 3 },
    { owner_id: B.id, shop_id: shopB.id, product_id: b3.id, current_stock: 9 },
    { owner_id: B.id, shop_id: shopX.id, product_id: b3.id, current_stock: 50 },
  ]);
  await ProductImage.create({ product_id: a1.id, url: "/uploads/products/a1.jpg", is_primary: true });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/marketplace`;
  const get = async (p: string) => {
    const r = await fetch(base + p);
    return { status: r.status, json: await r.json() };
  };

  try {
    console.log("Search");
    let r = await get("/products");
    const names = r.json.data.map((x: any) => `${x.shop.code}:${x.name}`);
    check("public, no login → 200", r.status === 200, r.json);
    check("inactive products hidden", !names.some((n: string) => n.includes("Old Cable")), names);
    check("suspended shop hidden", !names.some((n: string) => n.startsWith("SUSP:")), names);
    check("4 listings across 2 shops", r.json.pagination.total === 4, r.json.pagination);
    check("no cost/purchase price leaked", !JSON.stringify(r.json).includes("purchase_price") && !JSON.stringify(r.json).includes('"11'), r.json.data[0]);

    r = await get("/products?q=turbo");
    check("text search", r.json.data.length === 2, r.json.data.map((x: any) => x.name));
    r = await get("/products?category=chargers");
    check("category filter is merged by name across shops", r.json.data.length === 3, r.json.data.map((x: any) => x.name));
    r = await get(`/products?shopId=${shopB.id}`);
    check("shop filter", r.json.data.every((x: any) => x.shop.id === shopB.id) && r.json.data.length === 3);
    r = await get("/products?minPrice=1000&maxPrice=1250");
    check("price range", r.json.data.length === 2 && r.json.data.every((x: any) => x.price >= 1000 && x.price <= 1250), r.json.data.map((x: any) => x.price));
    r = await get("/products?inStock=true");
    check("in-stock only", r.json.data.length === 3 && r.json.data.every((x: any) => x.inStock));
    r = await get("/products?sort=price_asc");
    const prices = r.json.data.map((x: any) => x.price);
    check("sort price ascending", prices.join() === [...prices].sort((a: number, b: number) => a - b).join(), prices);
    r = await get("/products?limit=2&page=2");
    check("pagination", r.json.data.length === 2 && r.json.pagination.pages === 2, r.json.pagination);
    r = await get("/products?q=charger");
    const a1row = r.json.data.find((x: any) => x.productId === a1.id);
    check("discount from real MRP (20%)", a1row?.discountPercent === 20, a1row);
    check("image url returned", a1row?.imageUrl === "/uploads/products/a1.jpg", a1row);

    console.log("Product + price comparison");
    r = await get(`/shops/${shopA.id}/products/${a1.id}`);
    const offers = r.json.data.otherOffers.map((x: any) => x.productId).sort();
    check("detail 200", r.status === 200);
    check("comparison finds same product by name+brand and by barcode", offers.join() === [b1.id, b2.id].sort().join(), offers);
    check("comparison sorted by price", r.json.data.otherOffers[0].price <= r.json.data.otherOffers[1].price);
    r = await get(`/shops/${shopB.id}/products/${a1.id}`);
    check("product not sold by that shop → 404", r.status === 404);
    r = await get(`/shops/${shopX.id}/products/${b3.id}`);
    check("product in suspended shop → 404", r.status === 404);

    console.log("Shops & categories");
    r = await get("/shops");
    check("shops list excludes suspended", r.json.data.length === 2 && !r.json.data.some((s: any) => s.code === "SUSP"), r.json.data);
    r = await get("/shops/ALPHA");
    check("storefront header + categories", r.status === 200 && r.json.data.categories[0]?.name === "Chargers", r.json);
    r = await get("/shops/SUSP");
    check("suspended storefront → 404", r.status === 404);
    r = await get("/categories");
    const chargers = r.json.data.find((c: any) => c.name === "Chargers");
    check("categories merged with counts", chargers?.count === 3, r.json.data);
  } finally {
    server.close();
    await sequelize.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
