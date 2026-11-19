import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize, Shop, ShopPortalSettings, ProductImage } from "../models";

/**
 * PUBLIC MARKETPLACE (MultiShop Phase 1) — read-only, no login.
 *
 * A "listing" is one product sold by one shop: products belong to an owner,
 * stock is held per shop, so every active shop of the owner lists the
 * owner's active products with that shop's own stock.
 *
 * Never exposes purchase_price, profit, supplier or any customer data.
 * Only shops with status "active" are visible.
 */

const MAX_LIMIT = 48;

function pageParams(req: Request, def = 24) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || def));
  const page = Math.max(1, Number(req.query.page) || 1);
  return { limit, page, offset: (page - 1) * limit };
}

/** Lower-cased, whitespace-collapsed key used to match "the same product" across shops. */
export function productMatchKey(name: string, brand?: string | null) {
  const norm = (v?: string | null) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${norm(brand)}|${norm(name)}`;
}

const LISTING_SELECT = `
  p.id AS product_id, p.name, p.brand, p.barcode, p.sku, p.description,
  p.selling_price AS price, p.mrp, p.tax_percent, p.created_at,
  c.name AS category_name,
  s.id AS shop_id, s.name AS shop_name, s.code AS shop_code, s.address AS shop_address,
  COALESCE(ps.current_stock, 0) AS stock,
  (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.id ASC LIMIT 1) AS image_url
`;
const LISTING_FROM = `
  FROM products p
  JOIN shops s ON s.owner_id = p.owner_id AND s.status = 'active'
  LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.shop_id = s.id
  LEFT JOIN categories c ON c.id = p.category_id
`;

function toListing(r: any) {
  const price = Number(r.price) || 0;
  const mrp = Number(r.mrp) || 0;
  return {
    productId: Number(r.product_id),
    name: r.name,
    brand: r.brand || null,
    sku: r.sku,
    category: r.category_name || null,
    price,
    mrp,
    discountPercent: mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0,
    gstPercent: Number(r.tax_percent) || 0,
    stock: Math.max(0, Number(r.stock) || 0),
    inStock: Number(r.stock) > 0,
    imageUrl: r.image_url || null,
    shop: { id: Number(r.shop_id), name: r.shop_name, code: r.shop_code, address: r.shop_address || null },
  };
}

/**
 * GET /api/marketplace/products
 *   ?q= &category= (name) &shopId= &minPrice= &maxPrice= &inStock=true
 *   &sort=relevance|newest|price_asc|price_desc &page= &limit=
 */
export async function searchListings(req: Request, res: Response) {
  try {
    const { limit, page, offset } = pageParams(req);
    const where: string[] = ["p.status = 'active'"];
    const rep: Record<string, any> = { limit, offset };

    const q = String(req.query.q || "").trim().toLowerCase();
    if (q) {
      where.push("(LOWER(p.name) LIKE :q OR LOWER(COALESCE(p.brand, '')) LIKE :q OR LOWER(p.sku) LIKE :q OR LOWER(COALESCE(c.name, '')) LIKE :q)");
      rep.q = `%${q}%`;
    }
    const category = String(req.query.category || "").trim().toLowerCase();
    if (category) {
      where.push("LOWER(c.name) = :category");
      rep.category = category;
    }
    if (req.query.shopId) {
      where.push("s.id = :shopId");
      rep.shopId = Number(req.query.shopId);
    }
    const min = Number(req.query.minPrice);
    if (req.query.minPrice !== undefined && req.query.minPrice !== "" && Number.isFinite(min)) {
      where.push("p.selling_price >= :minPrice");
      rep.minPrice = min;
    }
    const max = Number(req.query.maxPrice);
    if (req.query.maxPrice !== undefined && req.query.maxPrice !== "" && Number.isFinite(max)) {
      where.push("p.selling_price <= :maxPrice");
      rep.maxPrice = max;
    }
    if (String(req.query.inStock) === "true") where.push("COALESCE(ps.current_stock, 0) > 0");

    const sort = String(req.query.sort || "relevance");
    const order =
      sort === "price_asc"
        ? "p.selling_price ASC, p.id ASC"
        : sort === "price_desc"
        ? "p.selling_price DESC, p.id DESC"
        : sort === "newest"
        ? "p.created_at DESC, p.id DESC"
        : // relevance: name matches first, then in-stock, then name
          (q ? "CASE WHEN LOWER(p.name) LIKE :qStart THEN 0 ELSE 1 END, " : "") + "CASE WHEN COALESCE(ps.current_stock, 0) > 0 THEN 0 ELSE 1 END, p.name ASC";
    if (q && sort === "relevance") rep.qStart = `${q}%`;

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const [rows, countRows] = await Promise.all([
      sequelize.query(`SELECT ${LISTING_SELECT} ${LISTING_FROM} ${whereSql} ORDER BY ${order} LIMIT :limit OFFSET :offset`, {
        replacements: rep,
        type: QueryTypes.SELECT,
      }),
      sequelize.query(`SELECT COUNT(*) AS total ${LISTING_FROM} ${whereSql}`, { replacements: rep, type: QueryTypes.SELECT }),
    ]);
    const total = Number((countRows[0] as any)?.total || 0);

    return res.json({
      success: true,
      data: (rows as any[]).map(toListing),
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Search failed" });
  }
}

/** GET /api/marketplace/categories — category names merged across shops, with product counts. */
export async function listMarketCategories(_req: Request, res: Response) {
  try {
    const rows = await sequelize.query(
      `SELECT c.name AS name, COUNT(*) AS count,
              MIN((SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.id ASC LIMIT 1)) AS image_url
       ${LISTING_FROM}
       WHERE p.status = 'active' AND c.name IS NOT NULL
       GROUP BY c.name
       ORDER BY COUNT(*) DESC, c.name ASC`,
      { type: QueryTypes.SELECT }
    );
    return res.json({
      success: true,
      data: (rows as any[]).map((r) => ({ name: r.name, count: Number(r.count), imageUrl: r.image_url || null })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Could not load categories" });
  }
}

/** GET /api/marketplace/shops?q=&page=&limit= — active shops with their public profile. */
export async function listMarketShops(req: Request, res: Response) {
  try {
    const { limit, page, offset } = pageParams(req, 12);
    const q = String(req.query.q || "").trim().toLowerCase();
    const rep: Record<string, any> = { limit, offset };
    let where = "WHERE s.status = 'active'";
    if (q) {
      where += " AND (LOWER(s.name) LIKE :q OR LOWER(COALESCE(s.address, '')) LIKE :q)";
      rep.q = `%${q}%`;
    }
    const rows = await sequelize.query(
      `SELECT s.id, s.name, s.code, s.address, s.phone, s.logo,
              (SELECT COUNT(*) FROM products p WHERE p.owner_id = s.owner_id AND p.status = 'active') AS product_count,
              (SELECT COUNT(*) FROM products p JOIN product_stocks ps ON ps.product_id = p.id AND ps.shop_id = s.id
                 WHERE p.owner_id = s.owner_id AND p.status = 'active' AND ps.current_stock > 0) AS in_stock_count
       FROM shops s ${where}
       ORDER BY in_stock_count DESC, s.name ASC
       LIMIT :limit OFFSET :offset`,
      { replacements: rep, type: QueryTypes.SELECT }
    );
    const countRows = await sequelize.query(`SELECT COUNT(*) AS total FROM shops s ${where}`, { replacements: rep, type: QueryTypes.SELECT });
    const total = Number((countRows[0] as any)?.total || 0);
    return res.json({
      success: true,
      data: (rows as any[]).map((r) => ({
        id: Number(r.id),
        name: r.name,
        code: r.code,
        address: r.address || null,
        phone: r.phone || null,
        logo: r.logo || null,
        productCount: Number(r.product_count) || 0,
        inStockCount: Number(r.in_stock_count) || 0,
      })),
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Could not load shops" });
  }
}

/** GET /api/marketplace/shops/:code — one shop's public storefront header. */
export async function getMarketShop(req: Request, res: Response) {
  try {
    const code = String(req.params.code || "").trim();
    const shop = await Shop.findOne({ where: { code, status: "active" } });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });
    const settings = await ShopPortalSettings.findOne({ where: { shop_id: shop.id } });
    const cats = await sequelize.query(
      `SELECT c.name AS name, COUNT(*) AS count ${LISTING_FROM}
       WHERE p.status = 'active' AND s.id = :shopId AND c.name IS NOT NULL
       GROUP BY c.name ORDER BY c.name ASC`,
      { replacements: { shopId: shop.id }, type: QueryTypes.SELECT }
    );
    return res.json({
      success: true,
      data: {
        id: shop.id,
        name: shop.name,
        code: shop.code,
        address: shop.address || null,
        phone: shop.phone || null,
        email: shop.email || null,
        logo: shop.logo || null,
        banner: (shop.settings as any)?.bannerUrl || null,
        acceptsOrders: settings ? Boolean(settings.allow_orders) : true,
        minOrderValue: Number(settings?.min_order_value || 0),
        policies: {
          privacyPolicy: settings?.privacy_policy || null,
          termsConditions: settings?.terms_conditions || null,
          returnPolicy: settings?.return_policy || null,
          announcement: settings?.announcement_active ? settings.announcement_banner || null : null,
        },
        categories: (cats as any[]).map((c) => ({ name: c.name, count: Number(c.count) })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Could not load shop" });
  }
}

/**
 * GET /api/marketplace/shops/:shopId/products/:productId
 * Product detail for one shop + the same product in other shops (price comparison).
 * "Same product" = equal barcode, otherwise equal brand + name (case/space-insensitive).
 */
export async function getListing(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId);
    const productId = Number(req.params.productId);
    const rows = (await sequelize.query(`SELECT ${LISTING_SELECT} ${LISTING_FROM} WHERE p.status = 'active' AND s.id = :shopId AND p.id = :productId`, {
      replacements: { shopId, productId },
      type: QueryTypes.SELECT,
    })) as any[];
    if (!rows.length) return res.status(404).json({ success: false, message: "Product not found" });
    const base = rows[0];

    const images = await ProductImage.findAll({
      where: { product_id: productId },
      attributes: ["id", "url", "is_primary"],
      order: [["is_primary", "DESC"], ["id", "ASC"]],
    });

    // Candidates are narrowed in SQL (barcode, or same brand + same first word); the exact
    // "same product" test runs below with whitespace-insensitive keys, which SQL can't do portably.
    const barcode = String(base.barcode || "").trim();
    const key = productMatchKey(base.name, base.brand);
    const firstWord = String(base.name || "").toLowerCase().trim().split(/\s+/)[0] || "";
    const candidates = (await sequelize.query(
      `SELECT ${LISTING_SELECT} ${LISTING_FROM}
       WHERE p.status = 'active' AND NOT (s.id = :shopId AND p.id = :productId)
         AND (
           (:barcode <> '' AND p.barcode = :barcode)
           OR (LOWER(TRIM(COALESCE(p.brand, ''))) = :brand AND LOWER(TRIM(p.name)) LIKE :firstWord)
         )
       ORDER BY p.selling_price ASC
       LIMIT 200`,
      {
        replacements: { shopId, productId, barcode, brand: String(base.brand || "").toLowerCase().trim(), firstWord: `${firstWord}%` },
        type: QueryTypes.SELECT,
      }
    )) as any[];
    const others = candidates
      .filter((r) => (barcode && String(r.barcode || "").trim() === barcode) || productMatchKey(r.name, r.brand) === key)
      .slice(0, 20);

    return res.json({
      success: true,
      data: {
        ...toListing(base),
        description: base.description || null,
        images: images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.is_primary })),
        otherOffers: others.map(toListing),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Could not load product" });
  }
}
