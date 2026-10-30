import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize, Order, OrderItem, Customer, Shop, Notification } from "../models";
import { ORDER_STATUSES, OrderStatus } from "../models/Order";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
  const shopId = req.auth!.shopId;
  const { status, paymentStatus, customerId, search, startDate, endDate } = req.query;

  const where: any = { owner_id: ownerId };
  if (shopId) where.shop_id = shopId;

  // Scoping for customer portal
  if (req.auth?.isCustomer && req.auth.customerId) {
    where.customer_id = req.auth.customerId;
  } else if (customerId) {
    where.customer_id = customerId;
  }

  if (status && status !== "all") {
    where.status = status;
  }

  if (paymentStatus && paymentStatus !== "all") {
    where.payment_status = paymentStatus;
  }

  if (startDate || endDate) {
    where.order_date = {};
    if (startDate) where.order_date[Op.gte] = new Date(String(startDate));
    if (endDate) where.order_date[Op.lte] = new Date(String(endDate));
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

  try {
    const orders = await Order.findAll({
      where,
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer", where: customerWhere, required: false },
        { model: Shop, as: "shop", attributes: ["id", "name"] },
      ],
      order: [["order_date", "DESC"], ["created_at", "DESC"]],
    });

    return res.json({ success: true, count: orders.length, data: orders });
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

  try {
    const order = await Order.findOne({
      where: { id, owner_id: ownerId },
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name", "address", "phone", "email", "logo"] },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, data: order });
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
    taxPercent = 18,
    remarks,
    orderNumber: customOrderNumber,
    status = "processing",
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

      // 2. Calculate totals and price items
      let subtotal = 0;
      let totalItemDiscount = 0;
      let totalCalculatedTax = 0;
      const preparedItems: any[] = [];

      for (const item of items) {
        const qty = Number(item.quantity || item.qty || 1);
        const rate = Number(item.rate || item.price || 0);
        const disc = Number(item.discountPercent || item.discount || 0);
        const itemGst = Number(item.gstPercent ?? taxPercent ?? 18);

        const lineSubtotal = round2(rate * qty);
        const lineDiscAmount = round2((lineSubtotal * disc) / 100);
        const taxable = Math.max(0, round2(lineSubtotal - lineDiscAmount));
        const lineTax = round2((taxable * itemGst) / 100);
        const lineAmount = round2(taxable + lineTax);

        subtotal = round2(subtotal + lineSubtotal);
        totalItemDiscount = round2(totalItemDiscount + lineDiscAmount);
        totalCalculatedTax = round2(totalCalculatedTax + lineTax);

        preparedItems.push({
          product_id: item.productId || null,
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

      // 3. Generate Order Number
      let orderNumber = customOrderNumber;
      if (!orderNumber) {
        const [counterRow] = await sequelize.query(
          "SELECT COALESCE(MAX(id), 0) as max_id FROM orders WHERE owner_id = :owner_id",
          { replacements: { owner_id: ownerId }, transaction: t }
        );
        const nextNum = Number((counterRow as any)?.[0]?.max_id || 0) + 1;
        orderNumber = `ORD-${String(nextNum).padStart(6, "0")}`;
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
 * 5. Update Order Status – Pending → Processing → Shipped → Delivered (and Cancelled)
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { status, remarks, payment_status } = req.body;

  const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "confirmed"];
  if (!status || !validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const order = await Order.findOne({
      where: { id, owner_id: ownerId },
      include: [{ model: Customer, as: "customer" }],
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const previousStatus = order.status;
    order.status = status;
    if (remarks) order.remarks = remarks;
    if (payment_status) order.payment_status = payment_status;
    await order.save();

    // Trigger Notification (Step 9)
    try {
      await Notification.create({
        owner_id: ownerId,
        shop_id: order.shop_id,
        recipient_type: "owner",
        recipient_id: ownerId,
        type: "general",
        title: `Order Status Updated: ${order.order_number}`,
        message: `Order #${order.order_number} transitioned from ${previousStatus} to ${status}. ${remarks || ""}`,
        reference_type: "order",
        reference_id: order.id,
        is_read: false,
      });
    } catch {}

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name", "address", "phone"] },
      ],
    });

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update order status" });
  }
}

/**
 * Validates and locks an order for conversion to a bill.
 */
export async function convertOrderToBill(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { saleId } = req.body;

  try {
    const order = await Order.findOne({
      where: { id, owner_id: ownerId },
      include: [{ model: OrderItem, as: "items" }, { model: Customer, as: "customer" }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "converted_to_bill") {
      return res.status(400).json({
        success: false,
        message: "Order already converted to bill! Duplicate bill generation prevented.",
      });
    }

    if (saleId) {
      order.status = "converted_to_bill";
      order.converted_sale_id = saleId;
      await order.save();
    }

    return res.json({
      success: true,
      message: "Order ready for bill conversion",
      data: order,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to convert order" });
  }
}
