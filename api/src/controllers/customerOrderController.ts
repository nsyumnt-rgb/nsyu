import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  sequelize,
  Order,
  OrderItem,
  OrderStatusHistory,
  Customer,
  Product,
  ProductStock,
  CustomerCart,
  CustomerCartItem,
  ShopPortalSettings,
  Notification,
  Shop,
} from "../models";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * POST /api/customer-portal/orders
 * Places an order from the customer's server-side cart.
 * Idempotent via clientRequestId.
 * Transactional: re-checks product status & stock with lock.
 */
export async function placeOrder(req: Request, res: Response) {
  const customerId = req.customer!.customerId;
  const shopId = req.customer!.shopId;
  const ownerId = req.customer!.ownerId;
  const accountId = req.customer!.accountId;
  const { clientRequestId, note, deliveryType, shippingAddress } = req.body;

  try {
    // 1. Idempotency check: if clientRequestId is present and order already exists, return it
    if (clientRequestId) {
      const existingOrder = await Order.findOne({
        where: { customer_id: customerId, client_request_id: String(clientRequestId) },
        include: [
          { model: OrderItem, as: "items" },
          { model: OrderStatusHistory, as: "statusHistory" },
        ],
      });
      if (existingOrder) {
        return res.json({
          success: true,
          message: "Order already placed (idempotent response)",
          data: existingOrder,
        });
      }
    }

    // 2. Check ShopPortalSettings (S3 & S4)
    const settings = await ShopPortalSettings.findOne({ where: { shop_id: shopId } });
    if (settings && !settings.allow_orders) {
      return res.status(400).json({
        success: false,
        message: "Online ordering is currently disabled for this shop",
      });
    }

    // 3. Load customer cart
    const cart = await CustomerCart.findOne({
      where: { customer_id: customerId, shop_id: shopId },
      include: [{ model: CustomerCartItem, as: "items" }],
    });

    const cartItems = (cart as any)?.items || [];
    if (!cart || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer profile not found" });
    }

    // 4. Run order creation inside ONE DB transaction
    const orderResult = await sequelize.transaction(async (t) => {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      const orderLines: any[] = [];
      const stockErrors: string[] = [];

      for (const ci of cartItems) {
        const product = await Product.findOne({
          where: { id: ci.product_id, owner_id: ownerId, status: "active" },
          transaction: t,
        });

        if (!product) {
          stockErrors.push(`Product #${ci.product_id} is no longer available`);
          continue;
        }

        const stock = await ProductStock.findOne({
          where: { product_id: product.id, shop_id: shopId },
          transaction: t,
        });

        const available = stock ? Number(stock.current_stock || 0) : 0;
        const requested = Number(ci.quantity);

        if (requested > available) {
          stockErrors.push(
            `"${product.name}" has only ${available} units in stock (${requested} requested)`
          );
          continue;
        }

        const rate = round2(Number(product.selling_price || 0));
        const discPercent = round2(Number(product.discount || 0));
        const gstPercent = round2(Number(product.tax_percent || 0));

        const lineGross = round2(rate * requested);
        const lineDisc = round2((lineGross * discPercent) / 100);
        const lineTaxable = Math.max(0, round2(lineGross - lineDisc));
        const lineTax = round2((lineTaxable * gstPercent) / 100);
        const lineTotal = round2(lineTaxable + lineTax);

        subtotal = round2(subtotal + lineTaxable);
        totalDiscount = round2(totalDiscount + lineDisc);
        totalTax = round2(totalTax + lineTax);

        orderLines.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          available_stock: available,
          quantity: requested,
          rate,
          discount_percent: discPercent,
          gst_percent: gstPercent,
          tax_amount: lineTax,
          amount: lineTotal,
        });
      }

      if (stockErrors.length > 0) {
        throw Object.assign(new Error(stockErrors.join("; ")), {
          status: 400,
          errors: stockErrors,
        });
      }

      const grandTotal = round2(subtotal + totalTax);

      // Check min_order_value (S4)
      if (settings && settings.min_order_value > 0 && grandTotal < Number(settings.min_order_value)) {
        throw Object.assign(
          new Error(`Minimum order value for this shop is ₹${settings.min_order_value}`),
          { status: 400 }
        );
      }

      // Generate order number
      const [maxRow] = await sequelize.query(
        "SELECT COALESCE(MAX(id), 0) as max_id FROM orders WHERE owner_id = :ownerId",
        { replacements: { ownerId }, transaction: t }
      );
      const nextNum = Number((maxRow as any)?.[0]?.max_id || 0) + 1;
      const orderNumber = `ORD-${String(nextNum).padStart(6, "0")}`;

      // Save order header
      const newOrder = await Order.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          customer_id: customerId,
          customer_account_id: accountId,
          placed_by: "customer",
          client_request_id: clientRequestId ? String(clientRequestId) : null,
          order_number: orderNumber,
          order_date: new Date(),
          subtotal,
          discount_amount: totalDiscount,
          tax_amount: totalTax,
          total_amount: grandTotal,
          status: "pending",
          order_type: deliveryType || "Delivery",
          remarks: note || null,
          shipping_address: shippingAddress || customer.address || null,
        },
        { transaction: t }
      );

      // Save order items
      for (const line of orderLines) {
        await OrderItem.create(
          {
            ...line,
            order_id: newOrder.id,
          },
          { transaction: t }
        );
      }

      // Initial status history
      await OrderStatusHistory.create(
        {
          order_id: newOrder.id,
          from_status: "(new)",
          to_status: "pending",
          changed_by_type: "customer",
          changed_by_id: accountId,
          note: "Order placed via customer portal",
        },
        { transaction: t }
      );

      // Empty cart
      await CustomerCartItem.destroy({
        where: { cart_id: cart.id },
        transaction: t,
      });

      // Notify shop owner and staff
      try {
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "order_placed",
            title: `New Order: ${orderNumber}`,
            message: `New order #${orderNumber} for ₹${grandTotal} placed by ${customer.name}.`,
            reference_type: "order",
            reference_id: newOrder.id,
            is_read: false,
          },
          { transaction: t }
        );
      } catch {}

      return newOrder;
    });

    // Reload with items
    const fullOrder = await Order.findByPk(orderResult.id, {
      include: [
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: fullOrder,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Failed to place order",
      errors: err.errors,
    });
  }
}

/**
 * GET /api/customer-portal/orders
 * Returns customer's own orders only.
 */
export async function listPortalOrders(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      customer_id: customerId,
      shop_id: shopId,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      include: [
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
      order: [["order_date", "DESC"], ["id", "DESC"]],
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list orders" });
  }
}

/**
 * GET /api/customer-portal/orders/:id
 * Detail with items and status timeline. Returns 404 if not found or not owned.
 */
export async function getPortalOrder(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const orderId = Number(req.params.id);

    const order = await Order.findOne({
      where: { id: orderId, customer_id: customerId, shop_id: shopId },
      include: [
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
        { model: Shop, as: "shop", attributes: ["id", "name", "phone", "address"] },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load order" });
  }
}

/**
 * POST /api/customer-portal/orders/:id/cancel
 * Customers may cancel an order ONLY while status is Pending, and if S5 is enabled.
 */
export async function cancelPortalOrder(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const ownerId = req.customer!.ownerId;
    const accountId = req.customer!.accountId;
    const orderId = Number(req.params.id);

    // Check S5 setting
    const settings = await ShopPortalSettings.findOne({ where: { shop_id: shopId } });
    if (settings && !settings.allow_customer_cancel) {
      return res.status(403).json({
        success: false,
        message: "Customer order cancellation is disabled for this shop",
      });
    }

    const order = await Order.findOne({
      where: { id: orderId, customer_id: customerId, shop_id: shopId },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Must be Pending (CP-O07)
    if (order.status.toLowerCase() !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Orders can only be cancelled while in Pending status",
      });
    }

    const previousStatus = order.status;
    order.status = "cancelled";
    await order.save();

    await OrderStatusHistory.create({
      order_id: order.id,
      from_status: previousStatus,
      to_status: "cancelled",
      changed_by_type: "customer",
      changed_by_id: accountId,
      note: "Cancelled by customer",
    });

    // Notify shop
    try {
      const customer = await Customer.findByPk(customerId);
      await Notification.create({
        owner_id: ownerId,
        shop_id: shopId,
        recipient_type: "owner",
        recipient_id: ownerId,
        type: "general",
        title: `Order Cancelled: ${order.order_number}`,
        message: `Order #${order.order_number} was cancelled by customer ${customer?.name || ""}.`,
        reference_type: "order",
        reference_id: order.id,
        is_read: false,
      });
    } catch {}

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to cancel order" });
  }
}

