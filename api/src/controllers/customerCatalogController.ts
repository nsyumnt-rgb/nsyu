import { Request, Response } from "express";
import { Op } from "sequelize";
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

    return res.json({
      success: true,
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
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
    const { search, categoryId, page, limit } = req.query;

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
    };

    if (categoryId) {
      where.category_id = Number(categoryId);
    }

    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { sku: { [Op.like]: q } },
        { brand: { [Op.like]: q } },
        { description: { [Op.like]: q } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["name", "ASC"]],
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
      const priceVal = round2(Number(p.selling_price || 0));
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
        sellingPrice: priceVal,
        selling_price: priceVal,
        price: priceVal,
        mrp: mrpVal,
        discountPercent: round2(Number(p.discount || 0)),
        gstPercent: gstVal,
        category: catObj,
        categoryName: catObj?.name || p.brand || "General",
        imageUrl: primaryImg ? primaryImg.url : null,
        images: (p as any).images?.map((img: any) => ({ id: img.id, url: img.url, is_primary: img.is_primary })) || [],
        availability,
        stock: currentStock,
        stockQuantity: currentStock,
        availableStock: currentStock,
        pricing: {
          sellingPrice: priceVal,
          sellingPriceInclTax: priceVal,
          unitPrice: priceVal,
          mrp: mrpVal,
          discountPercent: round2(Number(p.discount || 0)),
          gstPercent: gstVal,
        },
        inventory: {
          availableStock: currentStock,
          inStock: currentStock > 0,
          availability,
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
      where: { id: productId, owner_id: ownerId, status: "active" },
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
    const priceVal = round2(Number(product.selling_price || 0));
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
        brand: product.brand,
        description: product.description,
        spec: product.description,
        sellingPrice: priceVal,
        selling_price: priceVal,
        price: priceVal,
        mrp: mrpVal,
        discountPercent: round2(Number(product.discount || 0)),
        gstPercent: gstVal,
        category: catObj,
        categoryName: catObj?.name || product.brand || "General",
        imageUrl: primaryImg ? primaryImg.url : null,
        images: (product as any).images?.map((img: any) => ({ id: img.id, url: img.url, is_primary: img.is_primary })) || [],
        availability,
        stock: currentStock,
        stockQuantity: currentStock,
        availableStock: currentStock,
        pricing: {
          sellingPrice: priceVal,
          sellingPriceInclTax: priceVal,
          unitPrice: priceVal,
          mrp: mrpVal,
          discountPercent: round2(Number(product.discount || 0)),
          gstPercent: gstVal,
        },
        inventory: {
          availableStock: currentStock,
          inStock: currentStock > 0,
          availability,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load product" });
  }
}
