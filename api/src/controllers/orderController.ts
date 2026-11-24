import { Request, Response } from "express";
import { onInvoiceCreated, onPaymentReceived, onOrderStatusChanged } from "../utils/messaging/hooks";
import { withBillPayment, CONVERTED_SALE_ATTRS } from "../utils/orderPayment";
import { Op } from "sequelize";
import {
  sequelize,
  Order,
  OrderItem,
  OrderStatusHistory,
  Customer,
  Shop,
  Notification,
  Sale,
  SaleItem,
  CustomerLedger,
  Product,
  ProductStock,
} from "../models";
import { ORDER_STATUSES, OrderStatus } from "../models/Order";
import { PAYMENT_METHODS, PaymentMethod, computeBillPaymentStatus, computeSaleStatus } from "../models/Sale";
import { recordStockMovement } from "../utils/inventory";
import { generateUniqueReceiptCode, recordLedgerEntry } from "../utils/ledger";
import { nextInvoiceNumber } from "../utils/invoice";
import { sendBillEmail, sendPaymentReceiptEmail } from "../utils/mailer";

/**
 * Sales channel of an order, derived from who placed it (persisted as orders.placed_by):
 * customer portal / marketplace orders are "online", staff/counter orders are "offline".
 * Legacy rows without placed_by were created by staff (the column defaults to "staff").
 */
export type OrderChannel = "online" | "offline";
export function orderChannel(placedBy?: string | null): OrderChannel {
  return placedBy === "customer" ? "online" : "offline";
}
function withChannel(order: any) {
  const json = typeof order?.toJSON === "function" ? order.toJSON() : order;
  return withBillPayment({ ...json, channel: orderChannel(json?.placed_by) });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildOrderLookupConditions(idOrNumber: string | number, bodyOrderNum?: string | null): any[] {
  const rawId = String(idOrNumber || bodyOrderNum || "").trim();
  const cleanId = rawId.replace(/^[#\s]+/, "").trim();
  const isNumeric = /^\d+$/.test(cleanId);
  const numPart = cleanId.replace(/[^0-9]/g, "");

  const variants = new Set<string>();
  if (rawId) variants.add(rawId);
  if (cleanId) variants.add(cleanId);
  if (cleanId.startsWith("ORD-")) variants.add(cleanId.replace("ORD-", "ORD"));
  if (cleanId.startsWith("ORD")) variants.add(cleanId.replace("ORD", "ORD-"));
  if (numPart) {
    variants.add(`ORD${numPart}`);
    variants.add(`ORD-${numPart}`);
    variants.add(`ORD${numPart.padStart(6, "0")}`);
    variants.add(`ORD-${numPart.padStart(6, "0")}`);
  }
  if (bodyOrderNum) {
    const cleanBody = String(bodyOrderNum).replace(/^[#\s]+/, "").trim();
    variants.add(cleanBody);
    const bodyNum = cleanBody.replace(/[^0-9]/g, "");
    if (bodyNum) {
      variants.add(`ORD${bodyNum}`);
      variants.add(`ORD-${bodyNum}`);
      variants.add(`ORD${bodyNum.padStart(6, "0")}`);
      variants.add(`ORD-${bodyNum.padStart(6, "0")}`);
    }
  }

  const orList: any[] = Array.from(variants).map((v) => ({ order_number: v }));
  if (isNumeric && Number(cleanId) < 1000000000) {
    orList.push({ id: Number(cleanId) });
  }
  return orList;
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "processing", "shipped", "delivered", "cancelled"],
  confirmed: ["pending", "processing", "shipped", "delivered", "completed", "cancelled"],
  processing: ["pending", "confirmed", "shipped", "delivered", "completed", "cancelled"],
  shipped: ["pending", "confirmed", "processing", "delivered", "completed", "cancelled"],
  delivered: ["pending", "confirmed", "processing", "completed", "cancelled"],
  completed: [],
  converted_to_bill: [],
  BILLED: [],
  billed: [],
  cancelled: ["pending", "confirmed"],
};

/**
 * Returns KPI statistics for orders overview matching Image 1
 */
export async function getOrderStats(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId;

  const baseWhere: any = { owner_id: ownerId };
  if (shopId) baseWhere.shop_id = shopId;

  try {
    const [total, pending, processing, delivered, cancelled] = await Promise.all([
      Order.count({ where: baseWhere }),
      Order.count({ where: { ...baseWhere, status: { [Op.iLike]: "pending" } } }),
      Order.count({ where: { ...baseWhere, status: { [Op.iLike]: "processing" } } }),
      Order.count({ where: { ...baseWhere, status: { [Op.iLike]: "delivered" } } }),
      Order.count({ where: { ...baseWhere, status: { [Op.iLike]: "cancelled" } } }),
    ]);

    return res.json({
      success: true,
      data: {
        totalOrders: total || 0,
        pendingOrders: pending || 0,
        processingOrders: processing || 0,
        deliveredOrders: delivered || 0,
        cancelledOrders: cancelled || 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load order stats" });
  }
}

/**
 * 1. Order List – View, search and filter all orders.
 */
export async function getOrders(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { status, paymentStatus, customerId, search, startDate, endDate, channel, shopId: queryShopId, allShops } = req.query;

  let targetShopId: number | undefined = req.auth!.shopId ?? undefined;
  if (req.auth!.isOwner) {
    if (allShops === "true") {
      targetShopId = undefined;
    } else if (queryShopId) {
      targetShopId = Number(queryShopId);
    }
  }

  const where: any = { owner_id: ownerId };
  if (targetShopId) where.shop_id = targetShopId;

  // Scoping for customer portal
  if (req.auth?.isCustomer && req.auth.customerId) {
    where.customer_id = req.auth.customerId;
  } else if (customerId) {
    where.customer_id = customerId;
  }

  if (status && status !== "all") {
    const cleanFilter = String(status).trim().toLowerCase();
    if (cleanFilter === "billed" || cleanFilter === "converted_to_bill") {
      where.status = { [Op.in]: ["BILLED", "billed", "converted_to_bill"] };
    } else {
      where.status = { [Op.iLike]: cleanFilter };
    }
  }

  if (paymentStatus && paymentStatus !== "all") {
    where.payment_status = paymentStatus;
  }

  if (startDate || endDate) {
    where.order_date = {};
    if (startDate) where.order_date[Op.gte] = new Date(String(startDate));
    if (endDate) {
      const end = new Date(String(endDate));
      // A plain date ("2026-11-22") means "through the end of that day".
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) end.setHours(23, 59, 59, 999);
      where.order_date[Op.lte] = end;
    }
  }

  const andConditions: any[] = [];
  if (channel === "online") {
    where.placed_by = "customer";
  } else if (channel === "offline") {
    andConditions.push({ [Op.or]: [{ placed_by: "staff" }, { placed_by: null }] });
  } else if (channel !== undefined && channel !== "all") {
    return res.status(400).json({ success: false, message: "channel must be online, offline or all" });
  }

  const customerWhere: any = {};
  if (search) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { order_number: { [Op.iLike]: q } },
      { remarks: { [Op.iLike]: q } },
      { payment_method: { [Op.iLike]: q } },
      { "$customer.name$": { [Op.iLike]: q } },
      { "$customer.phone$": { [Op.iLike]: q } },
      { "$customer.email$": { [Op.iLike]: q } },
    ];
  }
  if (andConditions.length) where[Op.and] = andConditions;

  try {
    const orders = await Order.findAll({
      where,
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer", where: customerWhere, required: false },
        { model: Shop, as: "shop", attributes: ["id", "name"] },
        { model: Sale, as: "convertedSale", attributes: ["id", "invoice_number", "status", "payment_status", "total_amount", "paid_amount", "due_amount"], required: false },
      ],
      order: [["order_date", "DESC"], ["created_at", "DESC"]],
    });

    return res.json({ success: true, count: orders.length, data: orders.map(withChannel) });
  } catch (err: any) {
    console.error("❌ getOrders failed:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch orders" });
  }
}

/**
 * 4. Order Details – View customer, products, payment and delivery information.
 */
export async function getOrderById(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const orList = buildOrderLookupConditions(id);

  try {
    const order = await Order.findOne({
      where: { owner_id: ownerId, [Op.or]: orList },
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name", "address", "phone", "email", "logo"] },
        // Real status timeline for the order view / tracking screen.
        { model: OrderStatusHistory, as: "statusHistory" },
        { model: Sale, as: "convertedSale", attributes: CONVERTED_SALE_ATTRS, required: false },
      ],
      order: [[{ model: OrderStatusHistory, as: "statusHistory" }, "created_at", "ASC"]],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, data: withChannel(order) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch order" });
  }
}

/**
 * 2. Create New Order & 3. Order Confirmation
 */
export async function createOrder(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId || 1;
  const {
    customerId,
    customer: newCustomerInput,
    items,
    orderDate,
    expectedDeliveryDate,
    orderType = "Walk-in",
    paymentMethod = "Cash",
    paymentStatus = "Paid",
    shippingAddress,
    discountAmount = 0,
    taxPercent,
    remarks,
    orderNumber: customOrderNumber,
    status = "pending",
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "items must be a non-empty array" });
  }

  if (!customerId && !newCustomerInput?.name) {
    return res.status(400).json({ success: false, message: "customerId or customer.name is required" });
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1. Resolve or create customer
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && newCustomerInput?.name) {
        let existingCust = null;
        if (newCustomerInput.phone) {
          existingCust = await Customer.findOne({
            where: { owner_id: ownerId, phone: newCustomerInput.phone },
            transaction: t,
          });
        }
        if (existingCust) {
          resolvedCustomerId = existingCust.id;
        } else {
          const createdCust = await Customer.create(
            {
              owner_id: ownerId,
              name: newCustomerInput.name,
              phone: newCustomerInput.phone ?? null,
              email: newCustomerInput.email ?? null,
              address: newCustomerInput.address ?? null,
            },
            { transaction: t }
          );
          resolvedCustomerId = createdCust.id;
        }
      }

      // 2. Calculate totals and price items (respect shop defaultGstRate, default 0)
      const shopRow = await Shop.findByPk(shopId, { transaction: t });
      const shopDefaultGst = Number((shopRow?.settings as any)?.defaultGstRate ?? 0);

      let subtotal = 0;
      let totalItemDiscount = 0;
      let totalCalculatedTax = 0;
      const preparedItems: any[] = [];

      for (const item of items) {
        const qty = Number(item.quantity || item.qty || 1);
        const rate = Number(item.rate || item.price || 0);
        const disc = Number(item.discountPercent || item.discount || 0);
        const itemGst = item.gstPercent !== undefined
          ? Number(item.gstPercent)
          : (taxPercent !== undefined ? Number(taxPercent) : shopDefaultGst);

        const lineSubtotal = round2(rate * qty);
        const lineDiscAmount = round2((lineSubtotal * disc) / 100);
        const taxable = Math.max(0, round2(lineSubtotal - lineDiscAmount));
        const lineTax = round2((taxable * itemGst) / 100);
        const lineAmount = round2(taxable + lineTax);

        subtotal = round2(subtotal + lineSubtotal);
        totalItemDiscount = round2(totalItemDiscount + lineDiscAmount);
        totalCalculatedTax = round2(totalCalculatedTax + lineTax);

        let resolvedProdId = item.productId || item.product_id || null;
        if (!resolvedProdId && (item.sku || item.code || item.productName || item.desc)) {
          const skuVal = String(item.sku || item.code || "").trim();
          const nameVal = String(item.productName || item.desc || "").trim();
          const orConditions: any[] = [];
          if (skuVal) orConditions.push({ sku: skuVal });
          if (nameVal) orConditions.push({ name: nameVal });
          if (orConditions.length > 0) {
            const foundP = await Product.findOne({
              where: { owner_id: ownerId, [Op.or]: orConditions },
              transaction: t,
            });
            if (foundP) resolvedProdId = foundP.id;
          }
        }

        preparedItems.push({
          product_id: resolvedProdId,
          product_name: item.productName || item.desc || "Item",
          sku: item.sku || item.code || "ITEM",
          available_stock: Number(item.availableStock || item.stock || 25),
          quantity: qty,
          rate,
          discount_percent: disc,
          gst_percent: itemGst,
          tax_amount: lineTax,
          amount: lineAmount,
        });
      }

      const overallDiscount = round2(Number(discountAmount) || 0);
      const totalDiscount = round2(totalItemDiscount + overallDiscount);
      const finalOrderTotal = round2(subtotal - totalDiscount + totalCalculatedTax);

      // 3. Generate Order Number: clean ORD265436 format without hyphen
      let orderNumber = customOrderNumber;
      if (orderNumber) {
        const clean = String(orderNumber).replace(/^[#\s]+/, "").trim();
        const numPart = clean.replace(/[^0-9]/g, "");
        if (numPart) {
          orderNumber = `ORD${numPart}`;
        } else {
          orderNumber = clean.replace(/^ORD-?/, "ORD");
        }
      } else {
        const [counterRow] = await sequelize.query(
          "SELECT COALESCE(MAX(id), 0) as max_id FROM orders WHERE owner_id = :owner_id",
          { replacements: { owner_id: ownerId }, transaction: t }
        );
        const nextNum = Number((counterRow as any)?.[0]?.max_id || 0) + 1;
        orderNumber = `ORD${String(nextNum).padStart(6, "0")}`;
      }

      // 4. Save Order Header
      const order = await Order.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          customer_id: resolvedCustomerId,
          order_number: orderNumber,
          order_date: orderDate ? new Date(orderDate) : new Date(),
          expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          order_type: orderType,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          shipping_address: shippingAddress || newCustomerInput?.address || null,
          subtotal,
          discount_amount: totalDiscount,
          tax_amount: totalCalculatedTax,
          total_amount: finalOrderTotal,
          status: status,
          remarks: remarks || null,
        },
        { transaction: t }
      );

      // 5. Save Order Items
      const createdItems = await Promise.all(
        preparedItems.map((pi) =>
          OrderItem.create(
            {
              ...pi,
              order_id: order.id,
            },
            { transaction: t }
          )
        )
      );

      // 6. Create in-app notification (Step 9: Order Notifications)
      try {
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "general",
            title: `Order Confirmed: ${orderNumber}`,
            message: `Order #${orderNumber} for ₹${finalOrderTotal} created successfully for customer.`,
            reference_type: "order",
            reference_id: order.id,
            is_read: false,
          },
          { transaction: t }
        );
      } catch (notifErr) {
        // Safe fallback
      }

      return { order, items: createdItems };
    });

    const savedOrder = await Order.findByPk(result.order.id, {
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name"] },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: savedOrder,
    });
  } catch (err: any) {
    console.error("❌ createOrder failed:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create order" });
  }
}

/**
 * 5. Update Order Status – Strictly validated transitions + history + notification.
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { status, remarks, payment_status } = req.body;

  if (!status && !payment_status && !remarks) {
    return res.status(400).json({ success: false, message: "status, payment_status or remarks is required" });
  }

  const orList = buildOrderLookupConditions(id, req.body?.orderNumber || req.body?.order_number);
  const orderWhere: any = { owner_id: ownerId, [Op.or]: orList };

  try {
    const order = await Order.findOne({
      where: orderWhere,
      include: [{ model: Customer, as: "customer" }],
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const currentStatus = String(order.status).toLowerCase().trim();
    if (
      currentStatus === "billed" ||
      currentStatus === "converted_to_bill" ||
      order.converted_sale_id ||
      order.billed_bill_id
    ) {
      if (status) {
        return res.status(409).json({
          success: false,
          code: "ORDER_ALREADY_BILLED",
          message: "Order has already been converted to a bill and cannot change status",
        });
      }
    }

    let statusChanged = false;
    let targetStatus = currentStatus;

    if (status) {
      targetStatus = String(status).toLowerCase().trim();
      const VALID_STATUSES = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
      ];
      if (!VALID_STATUSES.includes(targetStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid order status. Allowed: ${VALID_STATUSES.join(", ")}`,
        });
      }

      if (currentStatus === targetStatus && !req.body.force) {
        return res.status(400).json({
          success: false,
          message: `Duplicate status transition: order is already in "${order.status}" status`,
        });
      }

      if (!req.body.force) {
        const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus];
        if (allowedTargets && !allowedTargets.includes(targetStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status transition: cannot change status from "${order.status}" to "${status}"`,
          });
        }
      }

      if (currentStatus !== targetStatus) {
        statusChanged = true;
      }
    }

    const previousStatus = order.status;
    if (statusChanged) {
      order.status = targetStatus;
    }
    if (remarks !== undefined) order.remarks = remarks;
    if (payment_status !== undefined) order.payment_status = payment_status;
    await order.save();

    // Record OrderStatusHistory if status actually changed
    if (statusChanged) {
      await OrderStatusHistory.create({
        order_id: order.id,
        from_status: String(previousStatus),
        to_status: targetStatus,
        changed_by_type: req.auth!.isOwner ? "owner" : "employee",
        changed_by_id: req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || req.auth!.ownerId),
        note: remarks || `Status changed to ${targetStatus}`,
      });

      // Notify customer and owner
      try {
        await Notification.create({
          owner_id: ownerId,
          shop_id: order.shop_id,
          recipient_type: "customer",
          recipient_id: order.customer_id,
          type: "order_status_changed",
          title: `Order Status: ${targetStatus}`,
          message: `Your order #${order.order_number} status has been updated to ${targetStatus}.`,
          reference_type: "order",
          reference_id: order.id,
          is_read: false,
        });

        await Notification.create({
          owner_id: ownerId,
          shop_id: order.shop_id,
          recipient_type: "owner",
          recipient_id: ownerId,
          type: "order_status_changed",
          title: `Order ${targetStatus}: ${order.order_number}`,
          message: `Order #${order.order_number} status changed to ${targetStatus}.`,
          reference_type: "order",
          reference_id: order.id,
          is_read: false,
        });
      } catch {}
    }

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name", "address", "phone"] },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
    });

    if (statusChanged) onOrderStatusChanged(updated || order, targetStatus);

    return res.json({
      success: true,
      message: `Order status updated to ${order.status}`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update order status" });
  }
}

/**
 * 6. Convert Order to Bill – Strictly ONE-TIME atomic DB transaction:
 *    row lock -> validate not billed -> create Sale + SaleItems -> deduct stock ->
 *    update single CustomerLedger -> mark order BILLED + billed_at.
 */
export async function convertOrderToBill(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { saleId, paidAmount = 0, paymentMethod = "cash", notes } = req.body;

  const orList = buildOrderLookupConditions(id, req.body?.orderNumber || req.body?.order_number);
  const orderWhere: any = { owner_id: ownerId, [Op.or]: orList };

  const actorType = (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || req.auth!.ownerId);
  const rawMethod = String(paymentMethod || "cash").trim().toLowerCase();
  const normalizedMethod: PaymentMethod = (
    PAYMENT_METHODS.includes(rawMethod as PaymentMethod)
      ? rawMethod
      : rawMethod.includes("upi")
      ? "upi"
      : rawMethod.includes("card")
      ? "card"
      : rawMethod.includes("bank")
      ? "bank_transfer"
      : rawMethod.includes("cheque")
      ? "cheque"
      : "cash"
  ) as PaymentMethod;

  try {
    const conversionResult = await sequelize.transaction(async (t) => {
      // Lock the Order row first without outer-join includes (PostgreSQL FOR UPDATE safe)
      const order = await Order.findOne({
        where: orderWhere,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!order) {
        throw Object.assign(new Error("Order not found"), { status: 404 });
      }

      const normStatus = String(order.status || "").trim().toUpperCase();
      if (
        normStatus === "BILLED" ||
        normStatus === "CONVERTED_TO_BILL" ||
        order.converted_sale_id ||
        order.billed_bill_id
      ) {
        throw Object.assign(new Error("Order has already been converted to a bill"), {
          status: 409,
          code: "ORDER_ALREADY_BILLED",
          billedBillId: order.billed_bill_id || order.converted_sale_id,
        });
      }

      if (normStatus === "CANCELLED") {
        throw Object.assign(new Error("Cannot convert a cancelled order into a bill"), { status: 400 });
      }

      const currentStatusLower = String(order.status || "").trim().toLowerCase();
      if (currentStatusLower !== "delivered") {
        throw Object.assign(
          new Error(
            `Order #${order.order_number} must be in "Delivered" status to convert to a bill (current status is "${order.status}"). Please update the order status to Delivered first.`
          ),
          { status: 400, code: "ORDER_NOT_DELIVERED" }
        );
      }

      const existingLinkedSale = await Sale.findOne({
        where: { order_id: order.id },
        transaction: t,
      });
      if (existingLinkedSale) {
        throw Object.assign(new Error("Order has already been converted to a bill"), {
          status: 409,
          code: "ORDER_ALREADY_BILLED",
          billedBillId: existingLinkedSale.id,
        });
      }

      const now = new Date();
      const prevStatus = String(order.status);

      // Legacy path: linking an already-created Sale inside same atomic transaction
      if (saleId) {
        const existingSale = await Sale.findOne({
          where: { id: Number(saleId), owner_id: ownerId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!existingSale) {
          throw Object.assign(new Error("Linked sale not found"), { status: 404 });
        }
        if (existingSale.order_id && existingSale.order_id !== order.id) {
          throw Object.assign(new Error("This bill is already linked to another order"), { status: 409 });
        }
        existingSale.order_id = order.id;
        await existingSale.save({ transaction: t });

        order.status = "BILLED";
        order.converted_sale_id = existingSale.id;
        order.billed_bill_id = existingSale.id;
        order.billed_at = now;
        await order.save({ transaction: t });

        await OrderStatusHistory.create(
          {
            order_id: order.id,
            from_status: prevStatus,
            to_status: "BILLED",
            changed_by_type: actorType,
            changed_by_id: actorId,
            note: `Linked to bill #${existingSale.invoice_number}`,
          },
          { transaction: t }
        );

        return { order, sale: existingSale };
      }

      const items = await OrderItem.findAll({
        where: { order_id: order.id },
        order: [["id", "ASC"]],
        transaction: t,
      });
      if (items.length === 0) {
        throw Object.assign(new Error("Cannot convert an order with no items"), { status: 400 });
      }

      const shopId = order.shop_id;
      const invoiceNumber = await nextInvoiceNumber({ ownerId, shopId, transaction: t });

      const orderTotal = round2(Number(order.total_amount || 0));
      const advance = round2(Number(order.advance_amount || 0));
      let requestedPaid = round2(Number(paidAmount || 0));
      if ((req.body.paymentStatus === "PAID" || req.body.payment_status === "PAID") && requestedPaid === 0) {
        requestedPaid = orderTotal;
      }
      if (requestedPaid > orderTotal + 0.01) {
        throw Object.assign(
          new Error(`Paid amount (₹${requestedPaid}) cannot exceed order total (₹${orderTotal})`),
          { status: 400 }
        );
      }

      const paid = Math.min(Math.max(requestedPaid, advance), orderTotal);
      const due = Math.max(0, round2(orderTotal - paid));
      const finalDue = due <= 0.01 ? 0 : due;
      const saleStatus = computeSaleStatus(orderTotal, paid);
      const salePaymentStatus = computeBillPaymentStatus(orderTotal, paid, saleStatus);

      // Create Sale header linked to Order via order_id FK
      const sale = await Sale.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          customer_id: order.customer_id,
          order_id: order.id,
          invoice_number: invoiceNumber,
          invoice_date: now,
          subtotal: order.subtotal,
          discount_amount: order.discount_amount,
          tax_amount: order.tax_amount,
          total_amount: orderTotal,
          paid_amount: paid,
          due_amount: finalDue,
          payment_method: normalizedMethod,
          is_emi: false,
          status: saleStatus,
          payment_status: salePaymentStatus,
          notes: notes || `Converted from Order #${order.order_number}`,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      // Create SaleItems + deduct stock
      for (const item of items) {
        let resolvedProductId = item.product_id;
        if (!resolvedProductId) {
          const skuVal = String(item.sku || "").trim();
          const nameVal = String(item.product_name || "").trim();
          const orConditions: any[] = [];
          if (skuVal) orConditions.push({ sku: skuVal });
          if (nameVal) orConditions.push({ name: nameVal });
          if (orConditions.length > 0) {
            const foundP = await Product.findOne({
              where: { owner_id: ownerId, [Op.or]: orConditions },
              transaction: t,
            });
            if (foundP) {
              resolvedProductId = foundP.id;
              item.product_id = foundP.id;
              await item.save({ transaction: t });
            }
          }
        }

        // If still no product_id found, create/find a product so SaleItem NOT NULL constraint is satisfied
        if (!resolvedProductId) {
          let fallbackProduct = await Product.findOne({
            where: { owner_id: ownerId, name: item.product_name || "Custom Item" },
            transaction: t,
          });
          if (!fallbackProduct) {
            fallbackProduct = await Product.create(
              {
                owner_id: ownerId,
                name: item.product_name || "Custom Item",
                sku: item.sku || `SKU-${Date.now()}`,
                selling_price: Number(item.rate || 0),
                purchase_price: Number(item.rate || 0),
                mrp: Number(item.rate || 0),
                status: "active",
              },
              { transaction: t }
            );
          }
          resolvedProductId = fallbackProduct.id;
          item.product_id = fallbackProduct.id;
          await item.save({ transaction: t });
        }

        await SaleItem.create(
          {
            sale_id: sale.id,
            product_id: resolvedProductId,
            product_name: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            rate: item.rate,
            discount_percent: item.discount_percent,
            discount_amount: round2((Number(item.rate) * Number(item.quantity) * Number(item.discount_percent || 0)) / 100),
            tax_percent: item.gst_percent || 0,
            tax_amount: item.tax_amount || 0,
            total_amount: item.amount,
          },
          { transaction: t }
        );

        if (resolvedProductId) {
          await recordStockMovement({
            ownerId,
            shopId,
            productId: resolvedProductId,
            type: "sale",
            quantity: item.quantity,
            actorType,
            actorId,
            referenceType: "Sale",
            referenceId: sale.id,
            notes: `Converted from Order ${order.order_number}`,
            allowNegative: true,
            externalTransaction: t,
          });
        }
      }

      // Ledger debit for full bill amount
      if (orderTotal > 0) {
        await recordLedgerEntry({
          ownerId,
          shopId,
          customerId: order.customer_id,
          saleId: sale.id,
          entryType: "debit",
          amount: orderTotal,
          referenceType: "Sale",
          referenceId: sale.id,
          description: `Sale ${invoiceNumber} (from Order ${order.order_number})`,
          actorType,
          actorId,
          entryDate: sale.invoice_date,
          externalTransaction: t,
        });
      }

      // Single Ledger credit if paid > 0 (net impact = 0 when paid === orderTotal)
      if (paid > 0) {
        const receiptCode = generateUniqueReceiptCode();
        await recordLedgerEntry({
          ownerId,
          shopId,
          customerId: order.customer_id,
          saleId: sale.id,
          entryType: "credit",
          amount: paid,
          referenceType: "SalePayment",
          referenceId: sale.id,
          referenceCode: receiptCode,
          paymentMethod: normalizedMethod,
          description: `Payment for ${invoiceNumber}`,
          actorType,
          actorId,
          entryDate: now,
          externalTransaction: t,
        });
      }

      // Update order status strictly to BILLED with conversion timestamp
      order.status = "BILLED";
      order.payment_status = finalDue <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";
      order.converted_sale_id = sale.id;
      order.billed_bill_id = sale.id;
      order.billed_at = now;
      await order.save({ transaction: t });

      await OrderStatusHistory.create(
        {
          order_id: order.id,
          from_status: prevStatus,
          to_status: "BILLED",
          changed_by_type: actorType,
          changed_by_id: actorId,
          note: `Converted to Bill #${invoiceNumber}`,
        },
        { transaction: t }
      );

      try {
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "customer",
            recipient_id: order.customer_id,
            type: "bill_created",
            title: `Bill Generated: ${invoiceNumber}`,
            message: `Your order #${order.order_number} has been billed (Invoice #${invoiceNumber}, Total: ₹${orderTotal}).`,
            reference_type: "sale",
            reference_id: sale.id,
            is_read: false,
          },
          { transaction: t }
        );

        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "bill_created",
            title: `Order Converted: ${invoiceNumber}`,
            message: `Order #${order.order_number} converted to Invoice #${invoiceNumber} (Total: ₹${orderTotal}).`,
            reference_type: "sale",
            reference_id: sale.id,
            is_read: false,
          },
          { transaction: t }
        );
      } catch {}

      return { order, sale };
    });

    const [refreshedOrder, refreshedBill] = await Promise.all([
      Order.findByPk(conversionResult.order.id, {
        include: [
          { model: OrderItem, as: "items" },
          { model: Customer, as: "customer" },
          { model: Shop, as: "shop", attributes: ["id", "name", "address", "phone"] },
          { model: OrderStatusHistory, as: "statusHistory" },
        ],
      }),
      Sale.findByPk(conversionResult.sale.id, {
        include: [
          { model: SaleItem, as: "items" },
          { model: Customer, as: "customer" },
          { model: Shop, as: "shop" },
          { model: CustomerLedger, as: "payments", required: false },
        ],
      }),
    ]);

    // Asynchronously dispatch bill email & receipt confirmation after DB commit
    const targetBill = refreshedBill || conversionResult.sale;
    if (targetBill && targetBill.customer_id) {
      onInvoiceCreated(targetBill);
      if (Number(targetBill.paid_amount) > 0) {
        onPaymentReceived({
          ownerId,
          shopId: targetBill.shop_id,
          customerId: targetBill.customer_id,
          amount: Number(targetBill.paid_amount),
          saleId: targetBill.id,
          invoiceNumber: targetBill.invoice_number,
          balance: Number((targetBill as any).customer?.current_balance ?? targetBill.due_amount),
        });
      }
    }
    if (targetBill && targetBill.customer_id) {
      setImmediate(async () => {
        try {
          const tbAny = targetBill as any;
          const itemSummaries = (tbAny.items || []).map((it: any) => ({
            productName: it.product_name,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            totalAmount: Number(it.total_amount),
          }));

          await sendBillEmail({
            ownerId,
            shopId: targetBill.shop_id || 1,
            customerId: targetBill.customer_id,
            customerEmail: tbAny.customer?.email,
            customerName: tbAny.customer?.name,
            invoiceNumber: targetBill.invoice_number,
            totalAmount: Number(targetBill.total_amount),
            paidAmount: Number(targetBill.paid_amount),
            dueAmount: Number(targetBill.due_amount),
            paymentStatus: targetBill.payment_status || targetBill.status,
            invoiceDate: targetBill.invoice_date,
            items: itemSummaries,
          });

          if (Number(targetBill.paid_amount) > 0) {
            await sendPaymentReceiptEmail({
              ownerId,
              shopId: targetBill.shop_id || 1,
              customerId: targetBill.customer_id,
              customerEmail: tbAny.customer?.email,
              customerName: tbAny.customer?.name,
              receiptCode: undefined,
              amount: Number(targetBill.paid_amount),
              paymentMethod: targetBill.payment_method,
              paymentDate: targetBill.invoice_date,
              invoiceNumber: targetBill.invoice_number,
              currentBalance: Number(tbAny.customer?.current_balance ?? targetBill.due_amount),
            });
          }
        } catch (mailErr: any) {
          console.warn("[MAIL TRIGGER WARN] Failed to dispatch order-to-bill email triggers:", mailErr.message);
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order successfully converted to bill",
      data: {
        order: refreshedOrder || conversionResult.order,
        bill: refreshedBill || conversionResult.sale,
      },
    });
  } catch (err: any) {
    const pgCode = err?.original?.code || err?.parent?.code || err?.code;
    if (pgCode === "23505" || err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        code: "ORDER_ALREADY_BILLED",
        message: "Order has already been converted to a bill",
      });
    }
    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      success: false,
      code: err.code,
      message: err.message || "Failed to convert order",
      data: err.billedBillId ? { billedBillId: err.billedBillId } : undefined,
      shortLines: err.shortLines,
    });
  }
}
