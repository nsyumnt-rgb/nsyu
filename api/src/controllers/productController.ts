import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  sequelize,
  Product,
  ProductImage,
  ProductStock,
  ProductLocation,
  Category,
  Subcategory,
  Supplier,
  Shop,
} from "../models";
import { getAllowedFields, stripFields } from "../middleware/permission";
import { publicUrlFor } from "../middleware/upload";
import { recordStockMovement } from "../utils/inventory";
import { logAudit } from "../utils/audit";

/**
 * OWNER-SIDE product create. Product itself is owner-level (see
 * models/Product.ts for why); an optional opening_stock + shop_id
 * can be supplied to seed the first shop's stock immediately via
 * the normal "opening" ledger entry — so a brand-new product still
 * has a clean, auditable stock history from day one instead of a
 * silently-set number.
 */
export async function createProduct(req: Request, res: Response) {
  const {
    name,
    sku,
    barcode,
    category_id,
    subcategory_id,
    brand,
    description,
    purchase_price,
    selling_price,
    mrp,
    discount,
    tax_percent,
    min_stock,
    supplier_id,
    opening_stock, // optional: { shopId, quantity }
  } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ success: false, message: "name and sku are required" });
  }
  if (Number(selling_price) < 0 || Number(purchase_price) < 0 || Number(mrp) < 0) {
    return res.status(400).json({ success: false, message: "Prices cannot be negative" });
  }
  if (discount !== undefined && (discount < 0 || discount > 100)) {
    return res.status(400).json({ success: false, message: "discount must be between 0 and 100" });
  }

  const existingSku = await Product.findOne({ where: { owner_id: req.auth!.ownerId, sku } });
  if (existingSku) {
    return res.status(409).json({ success: false, message: "A product with this SKU already exists" });
  }

  const result = await sequelize.transaction(async (t) => {
    const product = await Product.create(
      {
        owner_id: req.auth!.ownerId,
        name,
        sku,
        barcode,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        brand,
        description,
        purchase_price: purchase_price || 0,
        selling_price: selling_price || 0,
        mrp: mrp || 0,
        discount: discount || 0,
        tax_percent: tax_percent || 0,
        min_stock: min_stock || 0,
        supplier_id: supplier_id || null,
      },
      { transaction: t }
    );

    if (opening_stock?.shopId && Number(opening_stock.quantity) > 0) {
      await recordStockMovement({
        ownerId: req.auth!.ownerId,
        shopId: opening_stock.shopId,
        productId: product.id,
        type: "opening",
        quantity: Number(opening_stock.quantity),
        actorType: req.auth!.isOwner ? "owner" : "employee",
        actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
        notes: "Opening stock on product creation",
        externalTransaction: t,
      });
    }

    return product;
  });

  await logAudit({ req, module: "products", action: "create", entityType: "Product", entityId: result.id });

  return res.status(201).json({ success: true, data: result });
}

export async function updateProduct(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const fields = [
    "name", "barcode", "category_id", "subcategory_id", "brand", "description",
    "purchase_price", "selling_price", "mrp", "discount", "tax_percent", "min_stock",
    "supplier_id", "status",
  ] as const;

  const priceFields = ["purchase_price", "selling_price", "mrp"] as const;
  const oldPrices: Record<string, number> = {};
  const newPrices: Record<string, number> = {};

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if ((priceFields as readonly string[]).includes(f) && Number(req.body[f]) !== Number(product[f])) {
        oldPrices[f] = Number(product[f]);
        newPrices[f] = Number(req.body[f]);
      }
      (product as any)[f] = req.body[f];
    }
  }

  if (Number(product.selling_price) < 0 || Number(product.purchase_price) < 0 || Number(product.mrp) < 0) {
    return res.status(400).json({ success: false, message: "Prices cannot be negative" });
  }

  await product.save();
  await logAudit({ req, module: "products", action: "update", entityType: "Product", entityId: product.id });

  // Separately, an explicit "price_change" audit entry with old/new values whenever
  // purchase_price/selling_price/mrp actually changed — see AUDIT LOG spec requirement.
  if (Object.keys(newPrices).length > 0) {
    await logAudit({
      req,
      module: "products",
      action: "price_change",
      entityType: "Product",
      entityId: product.id,
      oldValue: oldPrices,
      newValue: newPrices,
    });
  }

  return res.json({ success: true, data: product });
}

/** Owner/employee view — full data including price, profit, supplier, stock, location. */
export async function listProductsOwnerView(req: Request, res: Response) {
  const products = await Product.findAll({
    where: { owner_id: req.auth!.ownerId },
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
      { model: Supplier, as: "supplier" },
      { model: ProductImage, as: "images" },
      {
        model: ProductStock,
        as: "stocks",
        where: req.auth!.shopId ? { shop_id: req.auth!.shopId } : undefined,
        required: false,
        include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  const allowedFields = await getAllowedFields(req, ["purchase_price", "profit", "supplier"]);

  const data = products.map((p) => {
    const json = p.toJSON() as any;
    if (allowedFields.profit) {
      json.profit = Number(json.selling_price) - Number(json.purchase_price);
    }
    if (!allowedFields.supplier) delete json.supplier;
    return stripFields(json, { purchase_price: allowedFields.purchase_price, profit: allowedFields.profit });
  });

  return res.json({ success: true, data });
}

export async function getProductOwnerView(req: Request, res: Response) {
  const param = String(req.params.productId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where.id = Number(param);
  } else {
    where.sku = param;
  }

  const product = await Product.findOne({
    where,
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
      { model: Supplier, as: "supplier" },
      { model: ProductImage, as: "images" },
      { model: ProductStock, as: "stocks", include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }] },
    ],
  });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const allowedFields = await getAllowedFields(req, ["purchase_price", "profit", "supplier"]);
  const json = product.toJSON() as any;
  if (allowedFields.profit) json.profit = Number(json.selling_price) - Number(json.purchase_price);
  if (!allowedFields.supplier) delete json.supplier;

  return res.json({ success: true, data: stripFields(json, { purchase_price: allowedFields.purchase_price, profit: allowedFields.profit }) });
}

export async function deleteProduct(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  // Soft delete via status rather than a hard DELETE — preserves
  // inventory ledger / order history integrity that reference this product.
  product.status = "inactive";
  await product.save();

  await logAudit({ req, module: "products", action: "deactivate", entityType: "Product", entityId: product.id });
  return res.json({ success: true, message: "Product deactivated" });
}

/* ---------------- Images ---------------- */

export async function uploadProductImages(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, message: "No images uploaded" });
  }

  const existingCount = await ProductImage.count({ where: { product_id: productId } });

  const created = await Promise.all(
    files.map((file, idx) =>
      ProductImage.create({
        product_id: productId,
        url: publicUrlFor(file.filename),
        is_primary: existingCount === 0 && idx === 0,
        sort_order: existingCount + idx,
      })
    )
  );

  await logAudit({ req, module: "products", action: "upload_images", entityType: "Product", entityId: productId, details: { count: created.length } });

  return res.status(201).json({ success: true, data: created });
}

/** Replace one image (delete old file + insert new) in a single call. */
export async function replaceProductImage(req: Request, res: Response) {
  const imageId = Number(req.params.imageId);
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "No replacement image uploaded" });

  const image = await ProductImage.findByPk(imageId, { include: [{ model: Product, as: "product" }] });
  if (!image || (image as any).product.owner_id !== req.auth!.ownerId) {
    return res.status(404).json({ success: false, message: "Image not found" });
  }

  const oldPath = path.join(__dirname, "..", "..", "uploads", "products", path.basename(image.url));
  fs.unlink(oldPath, () => {}); // best-effort cleanup

  image.url = publicUrlFor(file.filename);
  await image.save();

  await logAudit({ req, module: "products", action: "replace_image", entityType: "ProductImage", entityId: imageId });

  return res.json({ success: true, data: image });
}

export async function deleteProductImage(req: Request, res: Response) {
  const imageId = Number(req.params.imageId);
  const image = await ProductImage.findByPk(imageId, { include: [{ model: Product, as: "product" }] });
  if (!image || (image as any).product.owner_id !== req.auth!.ownerId) {
    return res.status(404).json({ success: false, message: "Image not found" });
  }

  const filePath = path.join(__dirname, "..", "..", "uploads", "products", path.basename(image.url));
  fs.unlink(filePath, () => {});
  await image.destroy();

  await logAudit({ req, module: "products", action: "delete_image", entityType: "ProductImage", entityId: imageId });

  return res.json({ success: true, message: "Image deleted" });
}

/* ---------------- Location ---------------- */

export async function setProductLocation(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const { shopId, rack, shelf, bin } = req.body;
  if (!shopId) return res.status(400).json({ success: false, message: "shopId is required" });

  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const location = await sequelize.transaction(async (t) => {
    await ProductLocation.update(
      { is_current: false },
      { where: { product_id: productId, shop_id: shopId, is_current: true }, transaction: t }
    );

    return ProductLocation.create(
      {
        product_id: productId,
        shop_id: shopId,
        rack,
        shelf,
        bin,
        is_current: true,
        set_by_type: req.auth!.isOwner ? "owner" : "employee",
        set_by_id: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
      },
      { transaction: t }
    );
  });

  await logAudit({ req, module: "products", action: "set_location", entityType: "Product", entityId: productId, details: { shopId, rack, shelf, bin } });

  return res.status(201).json({ success: true, data: location });
}

export async function getProductLocationHistory(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;

  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const where: any = { product_id: productId };
  if (shopId) where.shop_id = shopId;

  const history = await ProductLocation.findAll({
    where,
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
    order: [["created_at", "DESC"]],
  });

  return res.json({ success: true, data: history });
}

/* ---------------- Customer-facing view ---------------- */

/**
 * Public storefront view — NEVER include purchase_price, profit,
 * supplier, internal notes, or stock valuation. `availability` is a
 * boolean derived from stock, not the raw count, so customers can't
 * infer exact inventory levels either.
 */
export async function listProductsCustomerView(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  if (!shopId) return res.status(400).json({ success: false, message: "shopId is required" });

  const shop = await Shop.findOne({ where: { id: shopId, status: "active" } });
  if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

  const products = await Product.findAll({
    where: { owner_id: shop.owner_id, status: "active" },
    include: [
      { model: Category, as: "category", attributes: ["id", "name"] },
      { model: ProductImage, as: "images", attributes: ["id", "url", "is_primary", "sort_order"] },
      { model: ProductStock, as: "stocks", where: { shop_id: shopId }, required: true, attributes: ["current_stock"] },
    ],
  });

  const data = products.map((p) => {
    const j = p.toJSON() as any;
    const stock = j.stocks?.[0]?.current_stock ?? 0;
    return {
      id: j.id,
      name: j.name,
      category: j.category ? { id: j.category.id, name: j.category.name } : null,
      brand: j.brand,
      description: j.description,
      images: j.images,
      selling_price: j.selling_price,
      mrp: j.mrp,
      discount: j.discount,
      availability: stock > 0,
    };
    // Deliberately excluded: purchase_price, profit, supplier, tax_percent,
    // internal notes, min_stock, raw stock count, location.
  });

  return res.json({ success: true, data });
}
