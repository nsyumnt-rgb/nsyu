"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.listProductsOwnerView = listProductsOwnerView;
exports.getProductOwnerView = getProductOwnerView;
exports.deleteProduct = deleteProduct;
exports.uploadProductImages = uploadProductImages;
exports.replaceProductImage = replaceProductImage;
exports.deleteProductImage = deleteProductImage;
exports.setProductLocation = setProductLocation;
exports.getProductLocationHistory = getProductLocationHistory;
exports.listProductsCustomerView = listProductsCustomerView;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const models_1 = require("../models");
const permission_1 = require("../middleware/permission");
const upload_1 = require("../middleware/upload");
const inventory_1 = require("../utils/inventory");
const audit_1 = require("../utils/audit");
/**
 * OWNER-SIDE product create. Product itself is owner-level (see
 * models/Product.ts for why); an optional opening_stock + shop_id
 * can be supplied to seed the first shop's stock immediately via
 * the normal "opening" ledger entry — so a brand-new product still
 * has a clean, auditable stock history from day one instead of a
 * silently-set number.
 */
async function createProduct(req, res) {
    const { name, sku, barcode, category_id, subcategory_id, brand, description, purchase_price, selling_price, mrp, discount, tax_percent, min_stock, supplier_id, opening_stock, // optional: { shopId, quantity }
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
    const existingSku = await models_1.Product.findOne({ where: { owner_id: req.auth.ownerId, sku } });
    if (existingSku) {
        return res.status(409).json({ success: false, message: "A product with this SKU already exists" });
    }
    const result = await models_1.sequelize.transaction(async (t) => {
        const product = await models_1.Product.create({
            owner_id: req.auth.ownerId,
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
        }, { transaction: t });
        if (opening_stock?.shopId && Number(opening_stock.quantity) > 0) {
            await (0, inventory_1.recordStockMovement)({
                ownerId: req.auth.ownerId,
                shopId: opening_stock.shopId,
                productId: product.id,
                type: "opening",
                quantity: Number(opening_stock.quantity),
                actorType: req.auth.isOwner ? "owner" : "employee",
                actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
                notes: "Opening stock on product creation",
                externalTransaction: t,
            });
        }
        return product;
    });
    await (0, audit_1.logAudit)({ req, module: "products", action: "create", entityType: "Product", entityId: result.id });
    return res.status(201).json({ success: true, data: result });
}
async function updateProduct(req, res) {
    const productId = Number(req.params.productId);
    const product = await models_1.Product.findOne({ where: { id: productId, owner_id: req.auth.ownerId } });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    const fields = [
        "name", "barcode", "category_id", "subcategory_id", "brand", "description",
        "purchase_price", "selling_price", "mrp", "discount", "tax_percent", "min_stock",
        "supplier_id", "status",
    ];
    const priceFields = ["purchase_price", "selling_price", "mrp"];
    const oldPrices = {};
    const newPrices = {};
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            if (priceFields.includes(f) && Number(req.body[f]) !== Number(product[f])) {
                oldPrices[f] = Number(product[f]);
                newPrices[f] = Number(req.body[f]);
            }
            product[f] = req.body[f];
        }
    }
    if (Number(product.selling_price) < 0 || Number(product.purchase_price) < 0 || Number(product.mrp) < 0) {
        return res.status(400).json({ success: false, message: "Prices cannot be negative" });
    }
    await product.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "update", entityType: "Product", entityId: product.id });
    // Separately, an explicit "price_change" audit entry with old/new values whenever
    // purchase_price/selling_price/mrp actually changed — see AUDIT LOG spec requirement.
    if (Object.keys(newPrices).length > 0) {
        await (0, audit_1.logAudit)({
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
async function listProductsOwnerView(req, res) {
    const products = await models_1.Product.findAll({
        where: { owner_id: req.auth.ownerId },
        include: [
            { model: models_1.Category, as: "category" },
            { model: models_1.Subcategory, as: "subcategory" },
            { model: models_1.Supplier, as: "supplier" },
            { model: models_1.ProductImage, as: "images" },
            {
                model: models_1.ProductStock,
                as: "stocks",
                where: req.auth.shopId ? { shop_id: req.auth.shopId } : undefined,
                required: false,
                include: [{ model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] }],
            },
        ],
        order: [["created_at", "DESC"]],
    });
    const allowedFields = await (0, permission_1.getAllowedFields)(req, ["purchase_price", "profit", "supplier"]);
    const data = products.map((p) => {
        const json = p.toJSON();
        if (allowedFields.profit) {
            json.profit = Number(json.selling_price) - Number(json.purchase_price);
        }
        if (!allowedFields.supplier)
            delete json.supplier;
        return (0, permission_1.stripFields)(json, { purchase_price: allowedFields.purchase_price, profit: allowedFields.profit });
    });
    return res.json({ success: true, data });
}
async function getProductOwnerView(req, res) {
    const param = String(req.params.productId).trim();
    const isNumeric = /^\d+$/.test(param);
    const where = { owner_id: req.auth.ownerId };
    if (isNumeric) {
        where.id = Number(param);
    }
    else {
        where.sku = param;
    }
    const product = await models_1.Product.findOne({
        where,
        include: [
            { model: models_1.Category, as: "category" },
            { model: models_1.Subcategory, as: "subcategory" },
            { model: models_1.Supplier, as: "supplier" },
            { model: models_1.ProductImage, as: "images" },
            { model: models_1.ProductStock, as: "stocks", include: [{ model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] }] },
        ],
    });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    const allowedFields = await (0, permission_1.getAllowedFields)(req, ["purchase_price", "profit", "supplier"]);
    const json = product.toJSON();
    if (allowedFields.profit)
        json.profit = Number(json.selling_price) - Number(json.purchase_price);
    if (!allowedFields.supplier)
        delete json.supplier;
    return res.json({ success: true, data: (0, permission_1.stripFields)(json, { purchase_price: allowedFields.purchase_price, profit: allowedFields.profit }) });
}
async function deleteProduct(req, res) {
    const productId = Number(req.params.productId);
    const product = await models_1.Product.findOne({ where: { id: productId, owner_id: req.auth.ownerId } });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    // Soft delete via status rather than a hard DELETE — preserves
    // inventory ledger / order history integrity that reference this product.
    product.status = "inactive";
    await product.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "deactivate", entityType: "Product", entityId: product.id });
    return res.json({ success: true, message: "Product deactivated" });
}
/* ---------------- Images ---------------- */
async function uploadProductImages(req, res) {
    const productId = Number(req.params.productId);
    const product = await models_1.Product.findOne({ where: { id: productId, owner_id: req.auth.ownerId } });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    const files = req.files || [];
    if (files.length === 0) {
        return res.status(400).json({ success: false, message: "No images uploaded" });
    }
    const existingCount = await models_1.ProductImage.count({ where: { product_id: productId } });
    const created = await Promise.all(files.map((file, idx) => models_1.ProductImage.create({
        product_id: productId,
        url: (0, upload_1.publicUrlFor)(file.filename),
        is_primary: existingCount === 0 && idx === 0,
        sort_order: existingCount + idx,
    })));
    await (0, audit_1.logAudit)({ req, module: "products", action: "upload_images", entityType: "Product", entityId: productId, details: { count: created.length } });
    return res.status(201).json({ success: true, data: created });
}
/** Replace one image (delete old file + insert new) in a single call. */
async function replaceProductImage(req, res) {
    const imageId = Number(req.params.imageId);
    const file = req.file;
    if (!file)
        return res.status(400).json({ success: false, message: "No replacement image uploaded" });
    const image = await models_1.ProductImage.findByPk(imageId, { include: [{ model: models_1.Product, as: "product" }] });
    if (!image || image.product.owner_id !== req.auth.ownerId) {
        return res.status(404).json({ success: false, message: "Image not found" });
    }
    const oldPath = path_1.default.join(__dirname, "..", "..", "uploads", "products", path_1.default.basename(image.url));
    fs_1.default.unlink(oldPath, () => { }); // best-effort cleanup
    image.url = (0, upload_1.publicUrlFor)(file.filename);
    await image.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "replace_image", entityType: "ProductImage", entityId: imageId });
    return res.json({ success: true, data: image });
}
async function deleteProductImage(req, res) {
    const imageId = Number(req.params.imageId);
    const image = await models_1.ProductImage.findByPk(imageId, { include: [{ model: models_1.Product, as: "product" }] });
    if (!image || image.product.owner_id !== req.auth.ownerId) {
        return res.status(404).json({ success: false, message: "Image not found" });
    }
    const filePath = path_1.default.join(__dirname, "..", "..", "uploads", "products", path_1.default.basename(image.url));
    fs_1.default.unlink(filePath, () => { });
    await image.destroy();
    await (0, audit_1.logAudit)({ req, module: "products", action: "delete_image", entityType: "ProductImage", entityId: imageId });
    return res.json({ success: true, message: "Image deleted" });
}
/* ---------------- Location ---------------- */
async function setProductLocation(req, res) {
    const productId = Number(req.params.productId);
    const { shopId, rack, shelf, bin } = req.body;
    if (!shopId)
        return res.status(400).json({ success: false, message: "shopId is required" });
    const product = await models_1.Product.findOne({ where: { id: productId, owner_id: req.auth.ownerId } });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    const location = await models_1.sequelize.transaction(async (t) => {
        await models_1.ProductLocation.update({ is_current: false }, { where: { product_id: productId, shop_id: shopId, is_current: true }, transaction: t });
        return models_1.ProductLocation.create({
            product_id: productId,
            shop_id: shopId,
            rack,
            shelf,
            bin,
            is_current: true,
            set_by_type: req.auth.isOwner ? "owner" : "employee",
            set_by_id: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
        }, { transaction: t });
    });
    await (0, audit_1.logAudit)({ req, module: "products", action: "set_location", entityType: "Product", entityId: productId, details: { shopId, rack, shelf, bin } });
    return res.status(201).json({ success: true, data: location });
}
async function getProductLocationHistory(req, res) {
    const productId = Number(req.params.productId);
    const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
    const product = await models_1.Product.findOne({ where: { id: productId, owner_id: req.auth.ownerId } });
    if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });
    const where = { product_id: productId };
    if (shopId)
        where.shop_id = shopId;
    const history = await models_1.ProductLocation.findAll({
        where,
        include: [{ model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] }],
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
async function listProductsCustomerView(req, res) {
    const shopId = Number(req.params.shopId);
    if (!shopId)
        return res.status(400).json({ success: false, message: "shopId is required" });
    const shop = await models_1.Shop.findOne({ where: { id: shopId, status: "active" } });
    if (!shop)
        return res.status(404).json({ success: false, message: "Shop not found" });
    const products = await models_1.Product.findAll({
        where: { owner_id: shop.owner_id, status: "active" },
        include: [
            { model: models_1.Category, as: "category", attributes: ["id", "name"] },
            { model: models_1.ProductImage, as: "images", attributes: ["id", "url", "is_primary", "sort_order"] },
            { model: models_1.ProductStock, as: "stocks", where: { shop_id: shopId }, required: true, attributes: ["current_stock"] },
        ],
    });
    const data = products.map((p) => {
        const j = p.toJSON();
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
//# sourceMappingURL=productController.js.map