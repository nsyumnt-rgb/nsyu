import { Request, Response } from "express";
import { marketplaceVisibleWhere } from "../utils/productVisibility";
import { Op, col, fn, literal } from "sequelize";
import { Product, ProductStock, Category, ProductImage, ShopPortalSettings, Shop } from "../models";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/customer-portal/catalog/categories
 * Returns active categories with sellable products.
 */
export async function getPortalCategories(req: Request, res: Response) {
  try {
    const ownerId = req.customer!.ownerId;
    const categories = await Category.findAll({
      where: { owner_id: ownerId },
      order: [["name", "ASC"]],
    });

    // Storefront tile image: the photo of the newest active product in each category that has one.
    // Real catalog data only — categories without any product photo return imageUrl: null.
    const imageByCategory = new Map<number, string | null>();
    await Promise.all(
      categories.map(async (c) => {
        try {
          const p = await Product.findOne({
            where: { owner_id: ownerId, category_id: c.id, status: "active", ...marketplaceVisibleWhere() },
            include: [{ model: ProductImage, as: "images", attributes: ["url", "is_primary"], required: true }],
            order: [["created_at", "DESC"]],
            subQuery: false,
          });
          const imgs: any[] = (p as any)?.images || [];
          imageByCategory.set(c.id, (imgs.find((i) => i.is_primary) || imgs[0])?.url ?? null);
        } catch {
          imageByCategory.set(c.id, null);
        }
      })
    );

    // Active products per category, for "Cables (32)" style tiles. One grouped query.
    const countRows = (await Product.findAll({
      where: { owner_id: ownerId, status: "active", ...marketplaceVisibleWhere() },
      attributes: ["category_id", [fn("COUNT", col("id")), "n"]],
      group: ["category_id"],
      raw: true,
    })) as any[];
    const countByCategory = new Map<number, number>(countRows.map((r) => [Number(r.category_id), Number(r.n) || 0]));

    return res.json({
      success: true,
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: imageByCategory.get(c.id) ?? null,
        productCount: countByCategory.get(c.id) ?? 0,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load categories" });
  }
}

/**
 * GET /api/customer-portal/catalog/products
 * Returns active products for the shop with field allow-list.
 * Excludes purchase_price, profit, and supplier.
 */
export async function getPortalProducts(req: Request, res: Response) {
  try {
    const ownerId = req.customer!.ownerId;
    const shopId = req.customer!.shopId;
    const { search, categoryId, page, limit, sort, minPrice, maxPrice } = req.query;

    const pageNum = page ? Math.max(1, Number(page) || 1) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, Number(limit) || 20)) : 500;
    const offset = page ? (pageNum - 1) * limitNum : 0;

    // Check shop portal settings for stock quantity visibility and shop GST rate
    const [settings, shopRow] = await Promise.all([
      ShopPortalSettings.findOne({ where: { shop_id: shopId } }),
      Shop.findByPk(shopId),
    ]);
    const showExactStock = Boolean(settings?.show_stock_qty);
    const shopDefaultGst = Number((shopRow?.settings as any)?.defaultGstRate ?? 0);

    const where: any = {
      owner_id: ownerId,
      status: "active",
      ...marketplaceVisibleWhere(),
    };

    if (categoryId) {
      where.category_id = Number(categoryId);
    }

    // Optional storefront price range (selling price, inclusive).
    const min = minPrice !== undefined && minPrice !== "" ? Number(minPrice) : NaN;
    const max = maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : NaN;
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      where.selling_price = {};
      if (!Number.isNaN(min)) where.selling_price[Op.gte] = min;
      if (!Number.isNaN(max)) where.selling_price[Op.lte] = max;
    }

    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { sku: { [Op.like]: q } },
        { barcode: { [Op.like]: q } },
        { brand: { [Op.like]: q } },
        { description: { [Op.like]: q } },
      ];
    }

    // Storefront rails: "popular" = units actually sold at this shop (net of returns, cancelled bills
    // excluded); "discount" = biggest saving vs MRP. Both are read-only queries on existing tables.
    const unitsSold = literal(
      `(SELECT COALESCE(SUM(si.quantity - COALESCE(si.returned_quantity, 0)), 0) FROM sale_items si ` +
        `JOIN sales s ON s.id = si.sale_id WHERE si.product_id = "Product"."id" AND s.shop_id = ${Number(shopId)} AND s.status <> 'cancelled')`
    );
    const discountRatio = literal(
      `(CASE WHEN "Product"."mrp" > "Product"."selling_price" AND "Product"."mrp" > 0 ` +
        `THEN ("Product"."mrp" - "Product"."selling_price") * 1.0 / "Product"."mrp" ELSE 0 END)`
    );

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      // Optional ?sort=newest powers the storefront "New Arrivals" rail; default stays alphabetical.
      order:
        sort === "popular"
          ? [[unitsSold, "DESC"], ["id", "DESC"]]
          : sort === "discount"
          ? [[discountRatio, "DESC"], ["id", "DESC"]]
          : sort === "newest"
          ? [["created_at", "DESC"], ["id", "DESC"]]
          : sort === "price_asc"
          ? [["selling_price", "ASC"], ["id", "ASC"]]
          : sort === "price_desc"
          ? [["selling_price", "DESC"], ["id", "DESC"]]
          : [["name", "ASC"]],
      distinct: true, // count products, not product×image join rows
      ...(sort === "popular" ? { attributes: { include: [[unitsSold, "units_sold"]] } } : {}),
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        { model: ProductImage, as: "images", attributes: ["id", "url", "is_primary"] },
        {
          model: ProductStock,
          as: "stocks",
          where: { shop_id: shopId },
          required: false,
          attributes: ["current_stock", "min_stock"],
        },
      ],
    });

    const items = rows.map((p) => {
      const stockRow = (p as any).stocks?.[0];
      const currentStock = stockRow ? Number(stockRow.current_stock || 0) : 0;
      const minStock = stockRow?.min_stock ?? p.min_stock ?? 5;

      let availability: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
      if (currentStock <= 0) {
        availability = "out_of_stock";
      } else if (currentStock <= minStock) {
        availability = "low_stock";
      }

      const primaryImg = (p as any).images?.find((img: any) => img.is_primary) || (p as any).images?.[0];
      const sellingPriceVal = round2(Number(p.selling_price || 0));
      const livePriceVal = (p as any).live_price !== null && (p as any).live_price !== undefined && Number((p as any).live_price) > 0
        ? round2(Number((p as any).live_price))
        : null;
      const priceVal = livePriceVal !== null ? livePriceVal : sellingPriceVal;
      const mrpVal = round2(Number(p.mrp || 0));
      const gstVal = shopDefaultGst > 0 ? round2(Number(p.tax_percent) || shopDefaultGst) : 0;
      const catObj = (p as any).category ? { id: (p as any).category.id, name: (p as any).category.name } : null;

      return {
        id: p.id,
        name: p.name,
        desc: p.name,
        sku: p.sku,
        code: p.sku,
        brand: p.brand,
        description: p.description,
        spec: p.description,
        sellingPrice: sellingPriceVal,
        selling_price: sellingPriceVal,
        livePrice: livePriceVal,
        live_price: livePriceVal,
        isLivePrice: livePriceVal !== null,
        price: priceVal,
        mrp: mrpVal,
        discountPercent: round2(Number(p.discount || 0)),
        gstPercent: gstVal,
        category: catObj,
        categoryName: catObj?.name || p.brand || "General",
        imageUrl: primaryImg ? primaryImg.url : null,
        images: (p as any).images?.map((img: any) => ({ id: img.id, url: img.url, is_primary: img.is_primary })) || [],
        availability,
        ...(sort === "popular" ? { unitsSold: Number((p as any).get("units_sold") || 0) } : {}),
        stock: showExactStock ? currentStock : null,
        stockQuantity: showExactStock ? currentStock : null,
        availableStock: showExactStock ? currentStock : null,
        pricing: {
          sellingPrice: priceVal,
          sellingPriceInclTax: priceVal,
          unitPrice: priceVal,
          mrp: mrpVal,
          discountPercent: round2(Number(p.discount || 0)),
          gstPercent: gstVal,
        },
        inventory: {
          availableStock: showExactStock ? currentStock : null,
          inStock: currentStock > 0,
          isAvailable: currentStock > 0,
          availability,
          // Shop setting "show stock quantity to customers": the storefront shows the
          // number only when this is true, otherwise just in / low / out of stock.
          showStockQty: showExactStock,
        },
      };
    });

    return res.json({
      success: true,
      data: items,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load products" });
  }
}

/**
 * GET /api/customer-portal/catalog/products/:id
 */
export async function getPortalProduct(req: Request, res: Response) {
  try {
    const ownerId = req.customer!.ownerId;
    const shopId = req.customer!.shopId;
    const productId = Number(req.params.id);

    const [settings, shopRow] = await Promise.all([
      ShopPortalSettings.findOne({ where: { shop_id: shopId } }),
      Shop.findByPk(shopId),
    ]);
    const showExactStock = Boolean(settings?.show_stock_qty);
    const shopDefaultGst = Number((shopRow?.settings as any)?.defaultGstRate ?? 0);

    const product = await Product.findOne({
      where: { id: productId, owner_id: ownerId, status: "active", ...marketplaceVisibleWhere() },
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        { model: ProductImage, as: "images", attributes: ["id", "url", "is_primary"] },
        {
          model: ProductStock,
          as: "stocks",
          where: { shop_id: shopId },
          required: false,
          attributes: ["current_stock", "min_stock"],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const stockRow = (product as any).stocks?.[0];
    const currentStock = stockRow ? Number(stockRow.current_stock || 0) : 0;
    const minStock = stockRow?.min_stock ?? product.min_stock ?? 5;

    let availability: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
    if (currentStock <= 0) {
      availability = "out_of_stock";
    } else if (currentStock <= minStock) {
      availability = "low_stock";
    }

    const primaryImg = (product as any).images?.find((img: any) => img.is_primary) || (product as any).images?.[0];
    const sellingPriceVal = round2(Number(product.selling_price || 0));
    const livePriceVal = (product as any).live_price !== null && (product as any).live_price !== undefined && Number((product as any).live_price) > 0
      ? round2(Number((product as any).live_price))
      : null;
    const priceVal = livePriceVal !== null ? livePriceVal : sellingPriceVal;
    const mrpVal = round2(Number(product.mrp || 0));
    const gstVal = shopDefaultGst > 0 ? round2(Number(product.tax_percent) || shopDefaultGst) : 0;
    const catObj = (product as any).category ? { id: (product as any).category.id, name: (product as any).category.name } : null;

    return res.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        desc: product.name,
        sku: product.sku,
        code: product.sku,
        barcode: (product as any).barcode || null,
        brand: product.brand,
        description: product.description,
        spec: product.description,
        sellingPrice: sellingPriceVal,
        selling_price: sellingPriceVal,
        livePrice: livePriceVal,
        live_price: livePriceVal,
        isLivePrice: livePriceVal !== null,
        price: priceVal,
        mrp: mrpVal,
        discountPercent: round2(Number(product.discount || 0)),
        gstPercent: gstVal,
        category: catObj,
        categoryName: catObj?.name || product.brand || "General",
        imageUrl: primaryImg ? primaryImg.url : null,
        images: (product as any).images?.map((img: any) => ({ id: img.id, url: img.url, is_primary: img.is_primary })) || [],
        availability,
        stock: showExactStock ? currentStock : null,
        stockQuantity: showExactStock ? currentStock : null,
        availableStock: showExactStock ? currentStock : null,
        pricing: {
          sellingPrice: priceVal,
          sellingPriceInclTax: priceVal,
          unitPrice: priceVal,
          mrp: mrpVal,
          discountPercent: round2(Number(product.discount || 0)),
          gstPercent: gstVal,
        },
        inventory: {
          availableStock: showExactStock ? currentStock : null,
          inStock: currentStock > 0,
          isAvailable: currentStock > 0,
          availability,
          // Shop setting "show stock quantity to customers": the storefront shows the
          // number only when this is true, otherwise just in / low / out of stock.
          showStockQty: showExactStock,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load product" });
  }
}

/**
 * GET /api/customer-portal/shop/policies
 * Returns the shop's configured policies (Privacy Policy, Terms, Return Policy).
 */
export async function getPortalShopPolicies(req: Request, res: Response) {
  try {
    const shopId = req.customer!.shopId;
    const settings = await ShopPortalSettings.findOne({ where: { shop_id: shopId } });
    return res.json({
      success: true,
      data: {
        privacyPolicy: settings?.privacy_policy || null,
        termsConditions: settings?.terms_conditions || null,
        returnPolicy: settings?.return_policy || null,
        announcement: settings?.announcement_active ? settings.announcement_banner || null : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load shop policies" });
  }
}
