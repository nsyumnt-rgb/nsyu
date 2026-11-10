import { Request, Response } from "express";
import { sequelize, Product, ProductStock, InventoryTransaction, Shop } from "../models";
import { recordStockMovement } from "../utils/inventory";
import { logAudit } from "../utils/audit";
import { MovementType } from "../models/InventoryTransaction";

const DIRECT_ENTRY_TYPES: MovementType[] = ["purchase", "sale", "customer_return", "damage", "adjustment"];

export async function recordMovement(req: Request, res: Response) {
  const { productId, type, quantity, notes } = req.body;

  if (!productId || !type || quantity === undefined) {
    return res.status(400).json({ success: false, message: "productId, type and quantity are required" });
  }
  if (!DIRECT_ENTRY_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `type must be one of: ${DIRECT_ENTRY_TYPES.join(", ")}. Use product creation for opening stock.`,
    });
  }

  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty <= 0) {
    return res.status(400).json({ success: false, message: "quantity must be a positive number" });
  }

  const shopId = req.body.shopId ? Number(req.body.shopId) : req.auth!.shopId;
  if (!shopId) {
    return res.status(400).json({ success: false, message: "shopId is required" });
  }

  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || 1);

  const movement = await recordStockMovement({
    ownerId: req.auth!.ownerId,
    shopId,
    productId,
    type,
    quantity: numQty,
    notes,
    actorType,
    actorId,
  });

  return res.status(201).json({ success: true, data: movement });
}

export async function listTransfers(req: Request, res: Response) {
  return res.json({
    success: true,
    data: {
      transfers: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      metrics: {
        totalTransfers: 0,
        totalItemsTransferred: 0,
        pendingTransfers: 0,
        completedTransfers: 0,
      },
      monthlyTrends: [],
      recentTransfers: [],
    },
  });
}

export async function transferStock(req: Request, res: Response) {
  return res.status(400).json({ success: false, message: "Stock transfer module has been disabled" });
}

export async function dispatchTransfer(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Stock transfer not found" });
}

export async function receiveTransfer(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Stock transfer not found" });
}

export async function cancelTransfer(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Stock transfer not found" });
}

/** Full movement history for a product, optionally filtered by shop and/or type. */
export async function getInventoryHistory(req: Request, res: Response) {
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  let shopId: number | undefined;

  if (req.auth!.isOwner) {
    if (req.query.allShops === "true") {
      shopId = undefined;
    } else {
      shopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    // Non-owners are strictly limited to their assigned shop
    shopId = req.auth!.shopId || undefined;
  }
  const type = req.query.type as MovementType | undefined;

  const where: any = { owner_id: req.auth!.ownerId };
  if (productId) where.product_id = productId;
  if (shopId) where.shop_id = shopId;
  if (type) where.type = type;

  const history = await InventoryTransaction.findAll({
    where,
    include: [
      { model: Product, as: "product", attributes: ["id", "name", "sku"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
    ],
    order: [["created_at", "DESC"]],
    limit: Number(req.query.limit) || 100,
  });

  return res.json({ success: true, data: history });
}

/** Current stock across all shops for one product — owner overview. */
export async function getProductStockOverview(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const stockWhere: any = { product_id: productId };
  if (!req.auth!.isOwner) {
    stockWhere.shop_id = req.auth!.shopId;
  }

  const stocks = await ProductStock.findAll({
    where: stockWhere,
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
  });

  return res.json({ success: true, data: stocks });
}

/** Get a single stock transfer by numeric ID or TRF-.. reference */
export async function getTransfer(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Stock transfer not found" });
}

/** Get a single inventory movement by numeric ID */
export async function getMovement(req: Request, res: Response) {
  const movementId = Number(req.params.movementId);
  const where: any = { id: movementId, owner_id: req.auth!.ownerId };
  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const movement = await InventoryTransaction.findOne({
    where,
    include: [
      { model: Product, as: "product" },
      { model: Shop, as: "shop" },
    ],
  });
  if (!movement) return res.status(404).json({ success: false, message: "Inventory movement not found" });
  return res.json({ success: true, data: movement });
}
