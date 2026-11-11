import { Request, Response } from "express";
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
import { recordStockMovement } from "../utils/inventory";
import { recordLedgerEntry } from "../utils/ledger";
import { nextInvoiceNumber } from "../utils/invoice";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "delivered", "completed", "converted_to_bill", "cancelled"],
  processing: ["completed", "converted_to_bill", "delivered", "shipped", "cancelled"],
  shipped: ["delivered", "completed", "cancelled"],
  delivered: ["completed"],
  completed: [],
  converted_to_bill: [],
  cancelled: [],
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
 * 5. Update Order Status – Strictly validated transitions + history + notification.
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { status, remarks, payment_status } = req.body;

  if (!status && !payment_status && !remarks) {
    return res.status(400).json({ success: false, message: "status, payment_status or remarks is required" });
  }

  const idStr = String(id).trim();
  const isNumeric = /^\d+$/.test(idStr);
  const orderWhere: any = { owner_id: ownerId };
  if (isNumeric) {
    orderWhere[Op.or] = [{ id: Number(idStr) }, { order_number: idStr }];
  } else {
    orderWhere.order_number = idStr;
  }

  try {
    const order = await Order.findOne({
      where: orderWhere,
      include: [{ model: Customer, as: "customer" }],
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const currentStatus = String(order.status).toLowerCase().trim();
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
        "converted_to_bill",
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
 * 6. Convert Order to Bill – Atomic transaction: stock deduction, ledger debit, order status.
 * CP-B01, CP-B02, CP-B03.
 */
export async function convertOrderToBill(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { id } = req.params;
  const { saleId, paidAmount = 0, paymentMethod = "cash", notes } = req.body;

  try {
    const order = await Order.findOne({
      where: { id, owner_id: ownerId },
      include: [
        { model: OrderItem, as: "items" },
        { model: Customer, as: "customer" },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // CP-B02: If already converted, return existing bill; create no duplicate
    if (order.status === "converted_to_bill" || order.converted_sale_id) {
      const existingBill = await Sale.findByPk(order.converted_sale_id || 0, {
        include: [{ model: SaleItem, as: "items" }, { model: CustomerLedger, as: "payments", required: false }],
      });
      return res.json({
        success: true,
        message: "Order already converted to bill",
        data: {
          order,
          bill: existingBill,
        },
      });
    }

    // If saleId was provided directly (linked from billing screen)
    if (saleId) {
      const existingSale = await Sale.findOne({ where: { id: saleId, owner_id: ownerId } });
      if (!existingSale) {
        return res.status(404).json({ success: false, message: "Linked sale not found" });
      }
      order.status = "converted_to_bill";
      order.converted_sale_id = existingSale.id;
      await order.save();

      await OrderStatusHistory.create({
        order_id: order.id,
        from_status: order.status,
        to_status: "converted_to_bill",
        changed_by_type: req.auth!.isOwner ? "owner" : "employee",
        changed_by_id: req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || req.auth!.ownerId),
        note: `Linked to bill #${existingSale.invoice_number}`,
      });

      return res.json({
        success: true,
        message: "Order converted to bill",
        data: { order, bill: existingSale },
      });
    }

    // Otherwise, convert order items directly in ONE atomic transaction
    const actorType = req.auth!.isOwner ? "owner" : "employee";
    const actorId = req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || req.auth!.ownerId);
    const shopId = order.shop_id;
    const items = (order as any).items || [];

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot convert an order with no items" });
    }

    const conversionResult = await sequelize.transaction(async (t) => {
      // 1. Generate invoice number
      const invoiceNumber = await nextInvoiceNumber({ ownerId, shopId, transaction: t });

      const advance = Number(order.advance_amount || 0);
      const paid = Math.min(Math.max(Number(paidAmount) || 0, advance), Number(order.total_amount));
      const due = round2(Number(order.total_amount) - paid);

      let saleStatus: Sale["status"] = "unpaid";
      if (paid >= Number(order.total_amount) && Number(order.total_amount) > 0) saleStatus = "paid";
      else if (paid > 0) saleStatus = "partially_paid";

      // 3. Create Sale header
      const sale = await Sale.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          customer_id: order.customer_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date(),
          subtotal: order.subtotal,
          discount_amount: order.discount_amount,
          tax_amount: order.tax_amount,
          total_amount: order.total_amount,
          paid_amount: paid,
          due_amount: due,
          payment_method: paymentMethod as any,
          is_emi: false,
          status: saleStatus,
          notes: notes || `Converted from Order #${order.order_number}`,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      // 4. Create SaleItems and deduct stock via recordStockMovement
      for (const item of items) {
        await SaleItem.create(
          {
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            rate: item.rate,
            discount_percent: item.discount_percent,
            discount_amount: round2((item.rate * item.quantity * item.discount_percent) / 100),
            tax_percent: item.gst_percent || 0,
            tax_amount: item.tax_amount || 0,
            total_amount: item.amount,
          },
          { transaction: t }
        );

        if (item.product_id) {
          await recordStockMovement({
            ownerId,
            shopId,
            productId: item.product_id,
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

      // 5. CustomerLedger debit for full bill amount
      await recordLedgerEntry({
        ownerId,
        shopId,
        customerId: order.customer_id,
        entryType: "debit",
        amount: Number(order.total_amount),
        referenceType: "Sale",
        referenceId: sale.id,
        description: `Sale ${invoiceNumber} (from Order ${order.order_number})`,
        actorType,
        actorId,
        entryDate: sale.invoice_date,
        externalTransaction: t,
      });

      // 6. Single Ledger: credit entry if money received
      if (paid > 0) {
        const receiptCode = `RCP-${Date.now()}`;
        await recordLedgerEntry({
          ownerId,
          shopId,
          customerId: order.customer_id,
          entryType: "credit",
          amount: paid,
          referenceType: "SalePayment",
          referenceId: sale.id,
          referenceCode: receiptCode,
          paymentMethod: paymentMethod || "cash",
          description: `Payment for ${invoiceNumber}`,
          actorType,
          actorId,
          externalTransaction: t,
        });
      }

      // 7. Update order to converted_to_bill
      const prevStatus = order.status;
      order.status = "converted_to_bill";
      order.converted_sale_id = sale.id;
      order.billed_bill_id = sale.id;
      await order.save({ transaction: t });

      // 8. OrderStatusHistory
      await OrderStatusHistory.create(
        {
          order_id: order.id,
          from_status: String(prevStatus),
          to_status: "converted_to_bill",
          changed_by_type: actorType,
          changed_by_id: actorId,
          note: `Converted to Bill #${invoiceNumber}`,
        },
        { transaction: t }
      );

      // 9. Notifications to customer and owner
      try {
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "customer",
            recipient_id: order.customer_id,
            type: "bill_created",
            title: `Bill Generated: ${invoiceNumber}`,
            message: `Your order #${order.order_number} has been billed (Invoice #${invoiceNumber}, Total: ₹${order.total_amount}).`,
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
            message: `Order #${order.order_number} converted to Invoice #${invoiceNumber} (Total: ₹${order.total_amount}).`,
            reference_type: "sale",
            reference_id: sale.id,
            is_read: false,
          },
          { transaction: t }
        );
      } catch {}

      return { order, sale };
    });

    const refreshedOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
    });

    return res.json({
      success: true,
      message: "Order successfully converted to bill",
      data: {
        order: refreshedOrder,
        bill: conversionResult.sale,
      },
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Failed to convert order",
      shortLines: err.shortLines,
    });
  }
}
