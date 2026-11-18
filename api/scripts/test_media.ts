/**
 * Product photos + shop banner uploads over the real HTTP API (isolated in-memory SQLite).
 * Supabase Storage is replaced by a local fake server that records every request,
 * so we check exactly what would be sent to Supabase without touching a real project.
 *                                                     npm run test:media
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
import http from "http";
import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Op } = require("sequelize");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operatorsMixin = require("sequelize/lib/dialects/abstract/query-generator/operators");
operatorsMixin.OperatorMap[Op.iLike] = "LIKE";
operatorsMixin.OperatorMap[Op.notILike] = "NOT LIKE";
process.on("unhandledRejection", (e: any) => console.warn("  (handler error)", e?.message || e));

const API = process.argv[2] || path.join(__dirname, "..", "src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require(`${API}/models`);
const app = require(`${API}/app`).default;
const { signAccessToken } = require(`${API}/utils/jwt`);
const { sequelize, Owner, Shop, Product, ProductImage, ShopPortalSettings } = m;

let pass = 0;
const failures: string[] = [];
const ok = (cond: any, label: string, detail?: any) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    failures.push(label + (detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 240)}` : ""));
    console.log("  ✗ " + label);
  }
};

// Minimal real image headers (content after the magic bytes doesn't matter for the API).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(100, 3)]);
const FAKE = Buffer.from("<?php echo 'not an image'; ?>");

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer };

async function main() {
  // ── fake Supabase Storage ────────────────────────────────────────────
  const seen: Seen[] = [];
  let failNext = false;
  const fake = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({ method: req.method || "", url: req.url || "", headers: req.headers, body: Buffer.concat(chunks) });
      if (failNext) {
        failNext = false;
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "boom" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ Key: "ok" }));
    });
  });
  await new Promise<void>((r) => fake.listen(0, r));
  const fakeUrl = `http://127.0.0.1:${(fake.address() as any).port}`;
  const useSupabase = () => {
    process.env.SUPABASE_URL = fakeUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.SUPABASE_STORAGE_BUCKET = "nsyu-media";
  };
  const noSupabase = () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  };
  const publicPrefix = `${fakeUrl}/storage/v1/object/public/nsyu-media/`;

  // ── data ─────────────────────────────────────────────────────────────
  await sequelize.sync({ force: true });
  const ownerA = await Owner.create({ name: "Media A", email: "media-a@test.local", password: "x" });
  const ownerB = await Owner.create({ name: "Media B", email: "media-b@test.local", password: "x" });
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Media Shop A", code: "MDA", status: "active", settings: { defaultGstRate: 18 } });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Media Shop B", code: "MDB", status: "active" });
  for (const s of [shopA, shopB]) await ShopPortalSettings.create({ shop_id: s.id, allow_orders: true });
  const prod = await Product.create({ owner_id: ownerA.id, name: "Cable", sku: "MD-1", selling_price: 100, purchase_price: 50, status: "active" });

  const tokA = signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id });
  const tokB = signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id });
  const tokStaff = signAccessToken({ ownerId: ownerA.id, isOwner: false, employeeId: 999999, shopId: shopA.id, roleId: null });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const json = async (method: string, p: string, tok?: string, body?: any) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* */ }
    return { status: r.status, json: j, text };
  };
  const upload = async (p: string, tok: string, field: string, files: { buf: Buffer; name: string; type: string }[], method = "POST") => {
    const fd = new FormData();
    for (const f of files) fd.append(field, new Blob([new Uint8Array(f.buf)], { type: f.type }), f.name);
    const r = await fetch(base + p, { method, headers: { Authorization: `Bearer ${tok}` }, body: fd });
    const text = await r.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* */ }
    return { status: r.status, json: j, text };
  };

  try {
    // ── A: product photos → Supabase ─────────────────────────────────────
    console.log("\nProduct photos (Supabase Storage)");
    useSupabase();
    seen.length = 0;
    const up = await upload(`/products/${prod.id}/images`, tokA, "images", [
      { buf: PNG, name: "front.png", type: "image/png" },
      { buf: JPG, name: "back.jpg", type: "image/jpeg" },
    ]);
    ok(up.status === 201 && up.json?.data?.length === 2, "owner uploads 2 photos", up.text);
    const rows = await ProductImage.findAll({ where: { product_id: prod.id }, order: [["sort_order", "ASC"]] });
    ok(rows.length === 2 && rows.every((r: any) => r.url.startsWith(`${publicPrefix}owners/${ownerA.id}/products/${prod.id}/`)), "URLs are public Supabase URLs under owners/<owner>/products/<product>/", rows.map((r: any) => r.url));
    ok(rows[0].url.endsWith(".png") && rows[1].url.endsWith(".jpg"), "file extension comes from the real image bytes");
    ok(rows[0].is_primary === true && rows[1].is_primary === false, "first photo becomes the cover photo");
    const posts = seen.filter((s) => s.method === "POST");
    ok(posts.length === 2, "two objects sent to storage", posts.length);
    ok(posts.every((s) => s.headers.authorization === "Bearer test-service-key" && s.headers.apikey === "test-service-key"), "storage requests carry the service key (server-side only)");
    ok(posts[0].headers["content-type"] === "image/png" && posts[0].body.equals(PNG), "exact image bytes and content type are uploaded");
    ok(posts.every((s) => s.url.startsWith(`/storage/v1/object/nsyu-media/owners/${ownerA.id}/products/${prod.id}/`)), "objects go to the configured bucket and owner folder", posts.map((s) => s.url));

    const listed = await json("GET", `/products/${prod.id}`, tokA);
    ok(JSON.stringify(listed.json).includes(rows[0].url), "product API returns the photo URLs");

    const prim = await json("PUT", `/products/images/${rows[1].id}/primary`, tokA);
    await rows[0].reload();
    await rows[1].reload();
    ok(prim.status === 200 && rows[1].is_primary && !rows[0].is_primary, "owner can change the cover photo");

    seen.length = 0;
    const del = await json("DELETE", `/products/images/${rows[1].id}`, tokA);
    await rows[0].reload();
    ok(del.status === 200 && (await ProductImage.count({ where: { product_id: prod.id } })) === 1, "deleting a photo removes its row");
    ok(rows[0].is_primary === true, "next photo is promoted to cover when the cover is deleted");
    const delReq = seen.find((s) => s.method === "DELETE");
    ok(delReq && JSON.parse(delReq.body.toString()).prefixes?.[0] === rows[1].url.slice(publicPrefix.length), "the stored object is deleted from storage", delReq?.body.toString());

    seen.length = 0;
    const rep = await upload(`/products/images/${rows[0].id}`, tokA, "image", [{ buf: WEBP, name: "new.webp", type: "image/webp" }], "PUT");
    const oldUrl = rows[0].url;
    await rows[0].reload();
    ok(rep.status === 200 && rows[0].url.endsWith(".webp") && rows[0].url !== oldUrl, "replace stores the new photo (WEBP)");
    ok(seen.some((s) => s.method === "DELETE" && s.body.toString().includes(oldUrl.slice(publicPrefix.length))), "replace deletes the old object afterwards");

    // ── B: bad input & isolation ─────────────────────────────────────────
    console.log("\nRejections and isolation");
    seen.length = 0;
    const fakeImg = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: FAKE, name: "evil.png", type: "image/png" }]);
    ok(fakeImg.status === 400 && seen.length === 0, "a non-image disguised as .png is rejected and nothing is stored", fakeImg.text);
    const badExt = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: PNG, name: "x.svg", type: "image/svg+xml" }]);
    ok(badExt.status === 400, "SVG / unsupported types are rejected with 400", badExt.status);
    const big = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), name: "big.png", type: "image/png" }]);
    ok(big.status === 400 && /too large/i.test(big.json?.message || ""), "files over 5 MB get a clear 400", big.text);

    const before = await ProductImage.count();
    const bUp = await upload(`/products/${prod.id}/images`, tokB, "images", [{ buf: PNG, name: "a.png", type: "image/png" }]);
    ok(bUp.status === 404 && (await ProductImage.count()) === before, "another owner can't add photos to this product");
    ok((await json("PUT", `/products/images/${rows[0].id}/primary`, tokB)).status === 404, "another owner can't change the cover photo");
    ok((await json("DELETE", `/products/images/${rows[0].id}`, tokB)).status === 404, "another owner can't delete the photo");
    ok((await upload(`/products/${prod.id}/images`, "", "images", [{ buf: PNG, name: "a.png", type: "image/png" }])).status === 401, "anonymous upload is refused");

    failNext = true;
    const failed = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: PNG, name: "a.png", type: "image/png" }]);
    ok(failed.status === 500 && (await ProductImage.count()) === before, "if storage fails, no broken photo row is saved", failed.text);

    // ── C: shop banner ───────────────────────────────────────────────────
    console.log("\nShop banner");
    seen.length = 0;
    const b1 = await upload(`/shops/${shopA.id}/banner`, tokA, "banner", [{ buf: JPG, name: "banner.jpg", type: "image/jpeg" }]);
    await shopA.reload();
    const banner1 = shopA.settings?.bannerUrl;
    ok(b1.status === 200 && typeof banner1 === "string" && banner1.startsWith(`${publicPrefix}owners/${ownerA.id}/shops/${shopA.id}/`), "owner uploads a banner to Supabase", b1.text);
    ok(shopA.settings?.defaultGstRate === 18, "uploading a banner keeps the other shop settings");

    const market = await json("GET", `/marketplace/shops/MDA`);
    ok(market.status === 200 && market.json?.data?.banner === banner1, "public storefront returns the banner", market.json?.data?.banner);

    seen.length = 0;
    const b2 = await upload(`/shops/${shopA.id}/banner`, tokA, "banner", [{ buf: PNG, name: "banner2.png", type: "image/png" }]);
    await shopA.reload();
    ok(b2.status === 200 && shopA.settings?.bannerUrl !== banner1, "replacing the banner stores a new image");
    ok(seen.some((s) => s.method === "DELETE" && s.body.toString().includes(banner1.slice(publicPrefix.length))), "the old banner object is deleted");

    const sneaky = await json("PUT", `/shops/${shopA.id}`, tokA, { settings: { bannerUrl: "https://evil.example/x.png" } });
    await shopA.reload();
    ok(sneaky.status === 200 && shopA.settings?.bannerUrl?.startsWith(publicPrefix), "banner URL can't be set to an arbitrary link through shop settings");

    ok((await upload(`/shops/${shopA.id}/banner`, tokB, "banner", [{ buf: PNG, name: "b.png", type: "image/png" }])).status === 404, "another owner can't set this shop's banner");
    const staffTry = await upload(`/shops/${shopA.id}/banner`, tokStaff, "banner", [{ buf: PNG, name: "b.png", type: "image/png" }]);
    ok([401, 403].includes(staffTry.status), "staff (non-owner) can't change the banner", staffTry.status);
    ok((await upload(`/shops/${shopA.id}/banner`, tokA, "banner", [{ buf: FAKE, name: "b.jpg", type: "image/jpeg" }])).status === 400, "a fake banner image is rejected");

    seen.length = 0;
    const bd = await json("DELETE", `/shops/${shopA.id}/banner`, tokA);
    await shopA.reload();
    ok(bd.status === 200 && !shopA.settings?.bannerUrl && shopA.settings?.defaultGstRate === 18, "owner removes the banner (other settings kept)");
    ok(seen.some((s) => s.method === "DELETE"), "removing the banner deletes the stored object");
    ok((await json("GET", `/marketplace/shops/MDA`)).json?.data?.banner === null, "storefront shows no banner after removal");

    // ── C2: new-format secret key (sb_secret_…) ──────────────────────────
    console.log("\nNew Supabase secret key format");
    useSupabase();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_TESTONLY_not_a_real_key";
    seen.length = 0;
    const nk = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: PNG, name: "nk.png", type: "image/png" }]);
    const nkPost = seen.find((s) => s.method === "POST");
    ok(nk.status === 201 && nkPost?.headers.apikey === "sb_secret_TESTONLY_not_a_real_key", "sb_secret key is sent as the apikey header", nk.text);
    ok(nkPost && nkPost.headers.authorization === undefined, "sb_secret key is NOT sent as a Bearer token (Supabase rejects non-JWT bearer keys)", nkPost?.headers.authorization);
    seen.length = 0;
    await json("DELETE", `/products/images/${nk.json?.data?.[0]?.id}`, tokA);
    const nkDel = seen.find((s) => s.method === "DELETE");
    ok(nkDel && nkDel.headers.apikey === "sb_secret_TESTONLY_not_a_real_key" && nkDel.headers.authorization === undefined, "deletes use the same apikey-only auth");

    // ── D: storage modes ─────────────────────────────────────────────────
    console.log("\nStorage modes");
    noSupabase();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const cnt = await ProductImage.count();
    const prodNoCfg = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: PNG, name: "a.png", type: "image/png" }]);
    ok(prodNoCfg.status === 503 && /not configured/i.test(prodNoCfg.json?.message || "") && (await ProductImage.count()) === cnt, "production without Supabase config refuses uploads (no files lost on Render's wiped disk)", prodNoCfg.text);
    process.env.NODE_ENV = "test";
    const local = await upload(`/products/${prod.id}/images`, tokA, "images", [{ buf: PNG, name: "a.png", type: "image/png" }]);
    const localUrl: string = local.json?.data?.[0]?.url || "";
    const localFile = path.join(__dirname, "..", localUrl.replace(/^\//, ""));
    ok(local.status === 201 && localUrl.startsWith(`/uploads/owners/${ownerA.id}/products/${prod.id}/`) && fs.existsSync(localFile), "dev/test without config stores files locally", localUrl);
    const localServed = await fetch(base.replace(/\/api$/, "") + localUrl);
    ok(localServed.status === 200, "locally stored photo is served at its URL");
    const localId = local.json?.data?.[0]?.id;
    await json("DELETE", `/products/images/${localId}`, tokA);
    await new Promise((r) => setTimeout(r, 100));
    ok(!fs.existsSync(localFile), "deleting removes the local file");
    process.env.NODE_ENV = prevEnv;
  } finally {
    server.close();
    fake.close();
    fs.rmSync(path.join(__dirname, "..", "uploads", "owners", String(ownerA.id)), { recursive: true, force: true });
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
