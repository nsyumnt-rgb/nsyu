import { Request, Response } from "express";
import { sequelize, Product, ProductStock, InventoryTransaction, StockTransfer, Shop } from "../models";
import { recordStockMovement } from "../utils/inventory";
import { logAudit } from "../utils/audit";
import { MovementType } from "../models/InventoryTransaction";

/**
 * Generic movement endpoint for purchase / sale / customer_return /
 * damage / adjustment. (opening is only ever created via product
 * creation; transfer_in/out are only ever created via transferStock
 * below, since those always need a paired entry.)
 */
const DIRECT_ENTRY_TYPES: MovementType[] = ["purchase", "sale", "customer_return", "damage", "adjustment"];

export async function recordMovement(req: Request, res: Response) {
  const { productId, type, quantity, notes } = req.body;

  if (!productId || !type || quantity === undefined) {
    return res.status(400).json({ success: false, message: "productId, type and quantity are required" });
  }
  if (!DIRECT_ENTRY_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `type must be one of: ${DIRECT_ENTRY_TYPES.join(", ")}. Use /transfer for transfer_in/transfer_out, product creation for opening stock.`,
    });
  }
  if (type !== "adjustment" && Number(quantity) <= 0) {
    return res.status(400).json({ success: false, message: "quantity must be positive" });
  }

  const product = await Product.findOne({ where: { id: productId, owner_id: req.auth!.ownerId } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  try {
    const stockBefore = await ProductStock.findOne({
      where: { product_id: productId, shop_id: req.auth!.shopId! },
    });
    const balanceBefore = stockBefore?.current_stock ?? 0;

    const result = await recordStockMovement({
      ownerId: req.auth!.ownerId,
      shopId: req.auth!.shopId!,
      productId,
      type,
      quantity: Number(quantity),
      actorType: req.auth!.isOwner ? "owner" : "employee",
      actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
      notes,
    });

    await logAudit({
      req,
      module: "inventory",
      action: type === "adjustment" ? "stock_adjustment" : type,
      entityType: "Product",
      entityId: productId,
      oldValue: type === "adjustment" ? { current_stock: balanceBefore } : undefined,
      newValue: type === "adjustment" ? { current_stock: result.stock.current_stock } : undefined,
      details: { quantity, balanceAfter: result.stock.current_stock },
    });

    return res.status(201).json({ success: true, data: { currentStock: result.stock.current_stock, transaction: result.transaction } });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

import { Op } from "sequelize";

// Cache to prevent duplicate submissions within 2 seconds
const recentSubmissions = new Map<string, number>();

/**
 * List stock transfers with filtering, pagination, KPI summaries, and 12-month trends.
 */
export async function listTransfers(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const { status, shopId, search, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    const where: any = { owner_id: ownerId };

    // Shop scoping: employees can only view transfers involving their assigned shop
    if (!req.auth!.isOwner) {
      const empShopId = req.auth!.shopId;
      where[Op.or] = [{ from_shop_id: empShopId }, { to_shop_id: empShopId }];
    } else if (shopId && shopId !== "All") {
      const sId = Number(shopId);
      where[Op.or] = [{ from_shop_id: sId }, { to_shop_id: sId }];
    }

    // Status filter
    if (status && status !== "All" && status !== "all") {
      const st = String(status).toLowerCase().replace(" ", "_");
      where.status = st;
    }

    // Date range filter
    if (dateFrom && dateTo) {
      where.created_at = {
        [Op.between]: [new Date(String(dateFrom)), new Date(String(dateTo) + " 23:59:59")],
      };
    }

    // Search filter
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { transfer_no: { [Op.iLike]: s } },
            { notes: { [Op.iLike]: s } },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.max(1, Number(limit));
    const offset = (pageNum - 1) * pageSize;

    const { count, rows } = await StockTransfer.findAndCountAll({
      where,
      include: [
        { model: Shop, as: "fromShop", attributes: ["id", "name", "code"] },
        { model: Shop, as: "toShop", attributes: ["id", "name", "code"] },
        { model: Product, as: "product", attributes: ["id", "name", "sku", "category_id"] },
      ],
      order: [["created_at", "DESC"]],
      limit: pageSize,
      offset,
    });

    // KPI Metrics calculation for owner (or scoped employee)
    const baseMetricWhere: any = { owner_id: ownerId };
    if (!req.auth!.isOwner) {
      const empShopId = req.auth!.shopId;
      baseMetricWhere[Op.or] = [{ from_shop_id: empShopId }, { to_shop_id: empShopId }];
    }

    const allTransfers = await StockTransfer.findAll({
      where: baseMetricWhere,
      attributes: ["id", "quantity", "status", "created_at", "items"],
    });

    const totalTransfers = allTransfers.length;
    let totalItemsTransferred = 0;
    let pendingTransfers = 0;
    let completedTransfers = 0;

    // Monthly trends bucket (Jan - Dec)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendBuckets: { [month: string]: { transfers: number; items: number } } = {};
    months.forEach((m) => (trendBuckets[m] = { transfers: 0, items: 0 }));

    const currentYear = new Date().getFullYear();

    allTransfers.forEach((t) => {
      let tQty = t.quantity || 0;
      if (Array.isArray(t.items)) {
        tQty = t.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
      }

      if (t.status === "completed" || t.status === "in_transit") {
        totalItemsTransferred += tQty;
      }
      if (t.status === "pending") pendingTransfers++;
      if (t.status === "completed") completedTransfers++;

      const createdAt = new Date(t.created_at);
      if (createdAt.getFullYear() === currentYear) {
        const mName = months[createdAt.getMonth()];
        if (trendBuckets[mName]) {
          trendBuckets[mName].transfers++;
          trendBuckets[mName].items += tQty;
        }
      }
    });

    const monthlyTrends = months.map((m) => ({
      month: m,
      transfers: trendBuckets[m].transfers,
      items: trendBuckets[m].items,
    }));

    // Recent 5 transfers
    const recentTransfers = rows.slice(0, 5);

    return res.json({
      success: true,
      data: {
        transfers: rows,
        total: count,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(count / pageSize) || 1,
        metrics: {
          totalTransfers,
          totalItemsTransferred,
          pendingTransfers,
          completedTransfers,
        },
        monthlyTrends,
        recentTransfers,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Transfer stock between two shops of the SAME owner.
 * Supports single product or multi-product items list.
 * Validates available stock, prevents duplicate submissions, and atomic DB transaction.
 */
export async function transferStock(req: Request, res: Response) {
  const { productId, fromShopId, toShopId, quantity, notes, items: rawItems, status = "completed" } = req.body;

  if (!fromShopId || !toShopId) {
    return res.status(400).json({ success: false, message: "fromShopId and toShopId are required" });
  }
  if (Number(fromShopId) === Number(toShopId)) {
    return res.status(400).json({ success: false, message: "Source and destination shop must be different" });
  }

  // Parse items
  let parsedItems: { productId: number; quantity: number }[] = [];
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    parsedItems = rawItems.map((it: any) => ({
      productId: Number(it.productId || it.product_id || it.product?.id),
      quantity: Number(it.quantity || it.qty),
    }));
  } else if (productId && quantity) {
    parsedItems = [{ productId: Number(productId), quantity: Number(quantity) }];
  } else {
    return res.status(400).json({ success: false, message: "At least one product item with quantity is required" });
  }

  // Validate quantities
  for (const item of parsedItems) {
    if (!item.productId || item.quantity <= 0 || isNaN(item.quantity)) {
      return res.status(400).json({ success: false, message: "All items must have a valid positive quantity" });
    }
  }

  // Prevent duplicate submissions (within 2 seconds)
  const submissionKey = `${req.auth!.ownerId}-${fromShopId}-${toShopId}-${JSON.stringify(parsedItems)}`;
  const lastSub = recentSubmissions.get(submissionKey);
  const now = Date.now();
  if (lastSub && now - lastSub < 2000) {
    return res.status(429).json({ success: false, message: "Duplicate transfer request detected. Please wait." });
  }
  recentSubmissions.set(submissionKey, now);

  // Authorization: check user access to source shop
  if (!req.auth!.isOwner && req.auth!.shopId !== Number(fromShopId)) {
    return res.status(403).json({ success: false, message: "You can only initiate transfers from your assigned shop" });
  }

  // Verify shops exist and belong to owner
  const [fromShop, toShop] = await Promise.all([
    Shop.findOne({ where: { id: fromShopId, owner_id: req.auth!.ownerId } }),
    Shop.findOne({ where: { id: toShopId, owner_id: req.auth!.ownerId } }),
  ]);
  if (!fromShop || !toShop) {
    return res.status(404).json({ success: false, message: "Source or destination shop not found" });
  }

  // Validate products and check available stock at fromShop
  const enrichedItems: any[] = [];
  let totalTransferQty = 0;

  for (const item of parsedItems) {
    const product = await Product.findOne({ where: { id: item.productId, owner_id: req.auth!.ownerId } });
    if (!product) {
      return res.status(404).json({ success: false, message: `Product with ID ${item.productId} not found` });
    }

    const currentStock = await ProductStock.findOne({
      where: { product_id: item.productId, shop_id: fromShopId },
    });
    const available = currentStock?.current_stock ?? 0;

    // Validate available stock in source shop (unless status is pending)
    if (status !== "pending" && available < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${product.name}" in ${fromShop.name}. Available: ${available}, Requested: ${item.quantity}`,
      });
    }

    totalTransferQty += item.quantity;
    enrichedItems.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
    });
  }

  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  // Generate transfer number: TRF-YYYY-XXXXX
  const year = new Date().getFullYear();
  const countThisYear = await StockTransfer.count({ where: { owner_id: req.auth!.ownerId } });
  const transferNo = `TRF-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

  try {
    const result = await sequelize.transaction(async (t) => {
      const transfer = await StockTransfer.create(
        {
          owner_id: req.auth!.ownerId,
          transfer_no: transferNo,
          product_id: enrichedItems[0]?.productId || null,
          from_shop_id: Number(fromShopId),
          to_shop_id: Number(toShopId),
          quantity: totalTransferQty,
          notes,
          status: status as any,
          items: enrichedItems,
          actor_type: actorType,
          actor_id: actorId,
          received_at: status === "completed" ? new Date() : null,
        },
        { transaction: t }
      );

      // Stock movement logic based on status
      if (status === "completed") {
        // Atomic immediate transfer: both legs execute
        for (const item of enrichedItems) {
          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: Number(fromShopId),
            productId: item.productId,
            type: "transfer_out",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: notes || `Transfer ${transferNo} to ${toShop.name}`,
            externalTransaction: t,
          });

          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: Number(toShopId),
            productId: item.productId,
            type: "transfer_in",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: notes || `Transfer ${transferNo} from ${fromShop.name}`,
            externalTransaction: t,
          });
        }
      } else if (status === "in_transit") {
        // Dispatched: deduct from source shop only
        for (const item of enrichedItems) {
          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: Number(fromShopId),
            productId: item.productId,
            type: "transfer_out",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: notes || `Dispatched transfer ${transferNo} to ${toShop.name}`,
            externalTransaction: t,
          });
        }
      }
      // If status === 'pending': no stock movement until dispatch

      return transfer;
    });

    await logAudit({
      req,
      module: "inventory",
      action: "transfer_create",
      entityType: "StockTransfer",
      entityId: result.id,
      details: {
        transferNo,
        fromShopId,
        toShopId,
        status,
        itemCount: enrichedItems.length,
        totalQuantity: totalTransferQty,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Stock transfer ${transferNo} created successfully`,
      data: result,
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Dispatch a pending transfer: deducts stock from source shop and marks in_transit.
 */
export async function dispatchTransfer(req: Request, res: Response) {
  const transferId = Number(req.params.id);
  const transfer = await StockTransfer.findOne({
    where: { id: transferId, owner_id: req.auth!.ownerId },
    include: [{ model: Shop, as: "toShop" }, { model: Shop, as: "fromShop" }],
  });

  if (!transfer) {
    return res.status(404).json({ success: false, message: "Stock transfer not found" });
  }
  if (transfer.status !== "pending") {
    return res.status(400).json({ success: false, message: `Only pending transfers can be dispatched (current: ${transfer.status})` });
  }

  // Authorization: employee must be assigned to from_shop
  if (!req.auth!.isOwner && req.auth!.shopId !== transfer.from_shop_id) {
    return res.status(403).json({ success: false, message: "Only source shop staff can dispatch this transfer" });
  }

  const items = (transfer.items as any[]) || [
    { productId: transfer.product_id, quantity: transfer.quantity },
  ];

  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  try {
    await sequelize.transaction(async (t) => {
      // Deduct from source shop
      for (const item of items) {
        await recordStockMovement({
          ownerId: req.auth!.ownerId,
          shopId: transfer.from_shop_id,
          productId: item.productId,
          type: "transfer_out",
          quantity: item.quantity,
          actorType,
          actorId,
          referenceType: "StockTransfer",
          referenceId: transfer.id,
          notes: `Dispatched transfer ${transfer.transfer_no}`,
          externalTransaction: t,
        });
      }

      transfer.status = "in_transit";
      await transfer.save({ transaction: t });
    });

    await logAudit({
      req,
      module: "inventory",
      action: "transfer_dispatch",
      entityType: "StockTransfer",
      entityId: transfer.id,
      details: { transferNo: transfer.transfer_no, fromShopId: transfer.from_shop_id },
    });

    return res.json({ success: true, message: `Transfer ${transfer.transfer_no} dispatched (In Transit)`, data: transfer });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Receive an in_transit or pending transfer: credits stock to destination shop and marks completed.
 */
export async function receiveTransfer(req: Request, res: Response) {
  const transferId = Number(req.params.id);
  const transfer = await StockTransfer.findOne({
    where: { id: transferId, owner_id: req.auth!.ownerId },
    include: [{ model: Shop, as: "toShop" }, { model: Shop, as: "fromShop" }],
  });

  if (!transfer) {
    return res.status(404).json({ success: false, message: "Stock transfer not found" });
  }
  if (transfer.status === "completed") {
    return res.status(400).json({ success: false, message: "Transfer is already completed" });
  }
  if (transfer.status === "cancelled") {
    return res.status(400).json({ success: false, message: "Cannot receive a cancelled transfer" });
  }

  // Authorization: employee must be assigned to to_shop
  if (!req.auth!.isOwner && req.auth!.shopId !== transfer.to_shop_id) {
    return res.status(403).json({ success: false, message: "Only destination shop staff can receive this transfer" });
  }

  const items = (transfer.items as any[]) || [
    { productId: transfer.product_id, quantity: transfer.quantity },
  ];

  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  try {
    await sequelize.transaction(async (t) => {
      // If was pending, also execute transfer_out first
      if (transfer.status === "pending") {
        for (const item of items) {
          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: transfer.from_shop_id,
            productId: item.productId,
            type: "transfer_out",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: `Transfer ${transfer.transfer_no} dispatched on receipt`,
            externalTransaction: t,
          });
        }
      }

      // Credit to destination shop
      for (const item of items) {
        await recordStockMovement({
          ownerId: req.auth!.ownerId,
          shopId: transfer.to_shop_id,
          productId: item.productId,
          type: "transfer_in",
          quantity: item.quantity,
          actorType,
          actorId,
          referenceType: "StockTransfer",
          referenceId: transfer.id,
          notes: `Received transfer ${transfer.transfer_no}`,
          externalTransaction: t,
        });
      }

      transfer.status = "completed";
      transfer.received_at = new Date();
      await transfer.save({ transaction: t });
    });

    await logAudit({
      req,
      module: "inventory",
      action: "transfer_receive",
      entityType: "StockTransfer",
      entityId: transfer.id,
      details: { transferNo: transfer.transfer_no, toShopId: transfer.to_shop_id },
    });

    return res.json({ success: true, message: `Transfer ${transfer.transfer_no} successfully received and completed`, data: transfer });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Cancel a transfer safely according to its current status:
 * - If pending: no stock was deducted, simply mark cancelled.
 * - If in_transit: source stock was already deducted! Safe reversal credits transfer_in back to source shop.
 * - If completed: safely reverses both legs (deducts destination, credits source).
 */
export async function cancelTransfer(req: Request, res: Response) {
  const transferId = Number(req.params.id);
  const { reason = "Cancelled by user" } = req.body;

  const transfer = await StockTransfer.findOne({
    where: { id: transferId, owner_id: req.auth!.ownerId },
  });

  if (!transfer) {
    return res.status(404).json({ success: false, message: "Stock transfer not found" });
  }
  if (transfer.status === "cancelled") {
    return res.status(400).json({ success: false, message: "Transfer is already cancelled" });
  }

  const items = (transfer.items as any[]) || [
    { productId: transfer.product_id, quantity: transfer.quantity },
  ];

  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  try {
    await sequelize.transaction(async (t) => {
      if (transfer.status === "in_transit") {
        // Safe reversal: restore deducted stock to source shop
        for (const item of items) {
          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: transfer.from_shop_id,
            productId: item.productId,
            type: "transfer_in",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: `Safe reversal for cancelled transfer ${transfer.transfer_no}: ${reason}`,
            externalTransaction: t,
          });
        }
      } else if (transfer.status === "completed") {
        // Reverse both legs
        for (const item of items) {
          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: transfer.to_shop_id,
            productId: item.productId,
            type: "transfer_out",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: `Reversal outward for cancelled transfer ${transfer.transfer_no}: ${reason}`,
            externalTransaction: t,
          });

          await recordStockMovement({
            ownerId: req.auth!.ownerId,
            shopId: transfer.from_shop_id,
            productId: item.productId,
            type: "transfer_in",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            notes: `Reversal inward for cancelled transfer ${transfer.transfer_no}: ${reason}`,
            externalTransaction: t,
          });
        }
      }

      transfer.status = "cancelled";
      transfer.cancelled_at = new Date();
      transfer.cancellation_reason = reason;
      await transfer.save({ transaction: t });
    });

    await logAudit({
      req,
      module: "inventory",
      action: "transfer_cancel",
      entityType: "StockTransfer",
      entityId: transfer.id,
      details: { transferNo: transfer.transfer_no, previousStatus: transfer.status, reason },
    });

    return res.json({ success: true, message: `Transfer ${transfer.transfer_no} cancelled safely`, data: transfer });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
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
  const param = String(req.params.transferId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where.id = Number(param);
  } else {
    where.transfer_no = param;
  }

  if (!req.auth!.isOwner) {
    where[Op.or] = [{ from_shop_id: req.auth!.shopId }, { to_shop_id: req.auth!.shopId }];
  }

  const transfer = await StockTransfer.findOne({
    where,
    include: [
      { model: Shop, as: "fromShop", attributes: ["id", "name", "code", "phone", "address"] },
      { model: Shop, as: "toShop", attributes: ["id", "name", "code", "phone", "address"] },
      { model: Product, as: "product", attributes: ["id", "name", "sku", "category_id"] },
    ],
  });
  if (!transfer) return res.status(404).json({ success: false, message: "Stock transfer not found" });

  const transactions = await InventoryTransaction.findAll({
    where: {
      owner_id: req.auth!.ownerId,
      reference_type: "StockTransfer",
      reference_id: transfer.id,
    },
    include: [
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: Product, as: "product", attributes: ["id", "name", "sku"] },
    ],
  });

  return res.json({ success: true, data: { ...transfer.toJSON(), transactions } });
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
