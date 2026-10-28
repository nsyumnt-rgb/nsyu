"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = getOrders;
exports.getOrderById = getOrderById;
exports.createOrder = createOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.convertOrderToBill = convertOrderToBill;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const Order_1 = require("../models/Order");
function round2(n) {
    return Math.round(n * 100) / 100;
}
async function getOrders(req, res) {
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { status, customerId, search } = req.query;
    const where = { owner_id: ownerId };
    if (shopId)
        where.shop_id = shopId;
    if (status && Order_1.ORDER_STATUSES.includes(status)) {
        where.status = status;
    }
    if (customerId) {
        where.customer_id = customerId;
    }
    if (search) {
        const q = `%${String(search).trim()}%`;
        where[sequelize_1.Op.or] = [
            { order_number: { [sequelize_1.Op.iLike]: q } },
            { remarks: { [sequelize_1.Op.iLike]: q } },
        ];
    }
    try {
        const orders = await models_1.Order.findAll({
            where,
            include: [
                { model: models_1.OrderItem, as: "items" },
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Shop, as: "shop", attributes: ["id", "name"] },
            ],
            order: [["order_date", "DESC"], ["created_at", "DESC"]],
        });
        return res.json({ success: true, count: orders.length, data: orders });
    }
    catch (err) {
        console.error("❌ getOrders failed:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to fetch orders" });
    }
}
async function getOrderById(req, res) {
    const ownerId = req.auth.ownerId;
    const { id } = req.params;
    try {
        const order = await models_1.Order.findOne({
            where: { id, owner_id: ownerId },
            include: [
                { model: models_1.OrderItem, as: "items" },
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Shop, as: "shop", attributes: ["id", "name"] },
            ],
        });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        return res.json({ success: true, data: order });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to fetch order" });
    }
}
/**
 * Creates a persistent Order.
 * CRITICAL BUSINESS LOGIC:
 * - Persists order header and items.
 * - DOES NOT deduct inventory stock (order is not yet a fulfilled/delivered sale).
 * - DOES NOT post debit to customer ledger (order is not yet billed).
 * - Strictly prevents duplicate sales, duplicate stock deductions, and duplicate ledger entries.
 */
async function createOrder(req, res) {
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId || 1;
    const { customerId, customer: newCustomerInput, items, orderDate, expectedDeliveryDate, discountAmount = 0, taxPercent = 18, remarks, orderNumber: customOrderNumber, status = "pending", } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "items must be a non-empty array" });
    }
    if (!customerId && !newCustomerInput?.name) {
        return res.status(400).json({ success: false, message: "customerId or customer.name is required" });
    }
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            // 1. Resolve or create customer
            let resolvedCustomerId = customerId;
            if (!resolvedCustomerId && newCustomerInput?.name) {
                let existingCust = null;
                if (newCustomerInput.phone) {
                    existingCust = await models_1.Customer.findOne({
                        where: { owner_id: ownerId, phone: newCustomerInput.phone },
                        transaction: t,
                    });
                }
                if (existingCust) {
                    resolvedCustomerId = existingCust.id;
                }
                else {
                    const createdCust = await models_1.Customer.create({
                        owner_id: ownerId,
                        name: newCustomerInput.name,
                        phone: newCustomerInput.phone ?? null,
                        address: newCustomerInput.address ?? null,
                    }, { transaction: t });
                    resolvedCustomerId = createdCust.id;
                }
            }
            // 2. Calculate totals and price items
            let subtotal = 0;
            let totalItemDiscount = 0;
            const preparedItems = [];
            for (const item of items) {
                const qty = Number(item.quantity || item.qty || 1);
                const rate = Number(item.rate || item.price || 0);
                const disc = Number(item.discountPercent || item.discount || 0);
                const lineSubtotal = round2(rate * qty);
                const lineDiscAmount = round2((lineSubtotal * disc) / 100);
                const lineAmount = round2(lineSubtotal - lineDiscAmount);
                subtotal = round2(subtotal + lineSubtotal);
                totalItemDiscount = round2(totalItemDiscount + lineDiscAmount);
                preparedItems.push({
                    product_id: item.productId || null,
                    product_name: item.productName || item.desc || "Item",
                    sku: item.sku || item.code || "ITEM",
                    available_stock: Number(item.availableStock || item.stock || 0),
                    quantity: qty,
                    rate,
                    discount_percent: disc,
                    amount: lineAmount,
                });
            }
            const overallDiscount = round2(Number(discountAmount) || 0);
            const totalDiscount = round2(totalItemDiscount + overallDiscount);
            const taxableAmount = Math.max(0, round2(subtotal - totalDiscount));
            const calculatedTax = round2((taxableAmount * Number(taxPercent)) / 100);
            const finalOrderTotal = round2(taxableAmount + calculatedTax);
            // 3. Generate Order Number if not provided
            let orderNumber = customOrderNumber;
            if (!orderNumber) {
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
                const rand = Math.floor(1000 + Math.random() * 9000);
                orderNumber = `ORD-${dateStr}-${rand}`;
            }
            // 4. Save Order Header
            const order = await models_1.Order.create({
                owner_id: ownerId,
                shop_id: shopId,
                customer_id: resolvedCustomerId,
                order_number: orderNumber,
                order_date: orderDate ? new Date(orderDate) : new Date(),
                expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                subtotal,
                discount_amount: totalDiscount,
                tax_amount: calculatedTax,
                total_amount: finalOrderTotal,
                status: status,
                remarks: remarks || null,
            }, { transaction: t });
            // 5. Save Order Items
            const createdItems = await Promise.all(preparedItems.map((pi) => models_1.OrderItem.create({
                ...pi,
                order_id: order.id,
            }, { transaction: t })));
            return { order, items: createdItems };
        });
        // Fetch complete saved order with associations
        const savedOrder = await models_1.Order.findByPk(result.order.id, {
            include: [
                { model: models_1.OrderItem, as: "items" },
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Shop, as: "shop", attributes: ["id", "name"] },
            ],
        });
        return res.status(201).json({
            success: true,
            message: "Order persisted successfully without duplicate stock/ledger impact",
            data: savedOrder,
        });
    }
    catch (err) {
        console.error("❌ createOrder failed:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create order" });
    }
}
async function updateOrderStatus(req, res) {
    const ownerId = req.auth.ownerId;
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !Order_1.ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `status must be one of: ${Order_1.ORDER_STATUSES.join(", ")}`,
        });
    }
    try {
        const order = await models_1.Order.findOne({ where: { id, owner_id: ownerId } });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (order.status === "converted_to_bill" && status !== "converted_to_bill") {
            return res.status(400).json({
                success: false,
                message: "Order has already been converted to a bill and cannot be reopened to prevent duplicate billing",
            });
        }
        order.status = status;
        await order.save();
        return res.json({ success: true, message: `Order status updated to ${status}`, data: order });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to update order status" });
    }
}
/**
 * Validates and locks an order for conversion to a bill.
 * Prevents double conversion.
 */
async function convertOrderToBill(req, res) {
    const ownerId = req.auth.ownerId;
    const { id } = req.params;
    const { saleId } = req.body;
    try {
        const order = await models_1.Order.findOne({
            where: { id, owner_id: ownerId },
            include: [{ model: models_1.OrderItem, as: "items" }, { model: models_1.Customer, as: "customer" }],
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
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to convert order" });
    }
}
//# sourceMappingURL=orderController.js.map