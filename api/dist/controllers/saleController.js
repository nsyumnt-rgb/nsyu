"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
exports.listSales = listSales;
exports.getSale = getSale;
exports.recordSalePayment = recordSalePayment;
exports.cancelSale = cancelSale;
exports.returnSale = returnSale;
exports.downloadBillPdf = downloadBillPdf;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const Sale_1 = require("../models/Sale");
const inventory_1 = require("../utils/inventory");
const ledger_1 = require("../utils/ledger");
const invoice_1 = require("../utils/invoice");
const emi_1 = require("../utils/emi");
const audit_1 = require("../utils/audit");
const pdf_1 = require("../utils/pdf");
function round2(n) {
    return Math.round(n * 100) / 100;
}
function actorFromReq(req) {
    return {
        actorType: (req.auth.isOwner ? "owner" : "employee"),
        actorId: req.auth.isOwner ? req.auth.ownerId : req.auth.employeeId,
    };
}
const saleIncludes = [
    { model: models_1.SaleItem, as: "items" },
    { model: models_1.Customer, as: "customer" },
    { model: models_1.Shop, as: "shop" },
    { model: models_1.Payment, as: "payments" },
    { model: models_1.EMIPlan, as: "emiPlan", include: [{ model: models_1.EMIInstallment, as: "installments" }] },
    { model: models_1.SaleReturn, as: "returns", include: [{ model: models_1.SaleReturnItem, as: "items" }] },
];
/**
 * SALES FLOW: Customer -> Shop -> Product -> Cart -> Discount -> Tax
 * -> Payment -> Bill -> Inventory Update -> Ledger Update.
 *
 * Body:
 * {
 *   customerId?: number,                 // existing customer
 *   customer?: { name, phone?, email?, address? },  // OR create inline
 *   items: [{ productId, quantity, rate?, discountPercent?, taxPercent? }],
 *   billDiscount?: number,               // additional flat discount applied on top of line discounts
 *   paymentMethod: "cash"|"upi"|"bank_transfer"|"card"|"cheque"|"other",
 *   paidAmount?: number,                 // amount received now (0 = fully on credit, unless isEmi)
 *   transactionId?: string,
 *   notes?: string,
 *   isEmi?: boolean,
 *   emi?: { downPayment, numberOfInstallments, interestPercent?, lateFeePercent?, startDate? }
 * }
 *
 * Everything below runs inside ONE DB transaction: if inventory is
 * insufficient for any line, or anything else fails, nothing is
 * written — bill, stock, and ledger can never end up out of sync.
 */
async function createSale(req, res) {
    const { customerId, customer: newCustomerInput, items, billDiscount, paymentMethod, paidAmount, transactionId, notes, isEmi, emi, } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "items must be a non-empty array" });
    }
    // Normalize payment method to supported backend enum
    const rawMethod = String(paymentMethod || "cash").trim().toLowerCase();
    const normalizedPaymentMethod = (Sale_1.PAYMENT_METHODS.includes(rawMethod)
        ? rawMethod
        : rawMethod.includes("upi") || rawMethod.includes("gpay") || rawMethod.includes("phonepe") || rawMethod.includes("paytm")
            ? "upi"
            : rawMethod.includes("card")
                ? "card"
                : rawMethod.includes("bank") || rawMethod.includes("transfer") || rawMethod.includes("neft") || rawMethod.includes("rtgs")
                    ? "bank_transfer"
                    : rawMethod.includes("cheque")
                        ? "cheque"
                        : "cash");
    if (!customerId && !newCustomerInput?.name) {
        return res.status(400).json({ success: false, message: "customerId or customer.name is required" });
    }
    if (isEmi && (!emi || !emi.numberOfInstallments || Number(emi.numberOfInstallments) < 1)) {
        return res.status(400).json({ success: false, message: "emi.numberOfInstallments is required when isEmi is true" });
    }
    const ownerId = req.auth.ownerId;
    let shopId = req.auth.shopId;
    if (!shopId && req.body.shopId) {
        shopId = Number(req.body.shopId);
    }
    if (!shopId) {
        const firstShop = await models_1.Shop.findOne({ where: { owner_id: ownerId, status: "active" }, order: [["id", "ASC"]] });
        shopId = firstShop ? firstShop.id : 1;
    }
    const { actorType, actorId } = actorFromReq(req);
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            // 1. Customer
            let customer;
            if (customerId) {
                const found = await models_1.Customer.findOne({ where: { id: customerId, owner_id: ownerId }, transaction: t });
                if (!found)
                    throw Object.assign(new Error("Customer not found"), { status: 404 });
                customer = found;
            }
            else {
                customer = await models_1.Customer.create({
                    owner_id: ownerId,
                    name: newCustomerInput.name,
                    phone: newCustomerInput.phone ?? null,
                    email: newCustomerInput.email ?? null,
                    address: newCustomerInput.address ?? null,
                }, { transaction: t });
            }
            // 2. Price the cart (Product -> Cart -> Discount -> Tax)
            let subtotal = 0;
            let totalDiscount = 0;
            let totalTax = 0;
            let grandTotal = 0;
            const pricedItems = [];
            for (const raw of items) {
                const rawProductId = raw.productId ?? raw.product_id;
                const rawQuantity = raw.quantity ?? raw.qty;
                if (!rawProductId || !rawQuantity || Number(rawQuantity) <= 0) {
                    throw Object.assign(new Error("Each item needs a valid productId and positive quantity"), { status: 400 });
                }
                let product = await models_1.Product.findOne({ where: { id: rawProductId, owner_id: ownerId }, transaction: t });
                if (!product && raw.sku) {
                    product = await models_1.Product.findOne({ where: { sku: String(raw.sku).trim(), owner_id: ownerId }, transaction: t });
                }
                if (!product && (raw.name || raw.desc || raw.product_name)) {
                    const searchName = String(raw.name || raw.desc || raw.product_name).trim();
                    product = await models_1.Product.findOne({ where: { name: searchName, owner_id: ownerId }, transaction: t });
                }
                if (!product)
                    throw Object.assign(new Error(`Product "${rawProductId}" not found`), { status: 404 });
                const qty = Number(rawQuantity);
                const rate = raw.rate !== undefined ? Number(raw.rate) : (raw.unitPrice !== undefined ? Number(raw.unitPrice) : Number(product.selling_price));
                const discountPercent = raw.discountPercent !== undefined ? Number(raw.discountPercent) : (raw.discount_percent !== undefined ? Number(raw.discount_percent) : Number(product.discount));
                const taxPercent = raw.taxPercent !== undefined ? Number(raw.taxPercent) : (raw.tax_percent !== undefined ? Number(raw.tax_percent) : Number(product.tax_percent));
                const lineSubtotal = round2(rate * qty);
                const lineDiscountAmount = round2((lineSubtotal * discountPercent) / 100);
                const afterDiscount = round2(lineSubtotal - lineDiscountAmount);
                const lineTaxAmount = round2((afterDiscount * taxPercent) / 100);
                const lineTotal = round2(afterDiscount + lineTaxAmount);
                subtotal = round2(subtotal + lineSubtotal);
                totalDiscount = round2(totalDiscount + lineDiscountAmount);
                totalTax = round2(totalTax + lineTaxAmount);
                grandTotal = round2(grandTotal + lineTotal);
                pricedItems.push({
                    product,
                    quantity: qty,
                    rate,
                    discountPercent,
                    discountAmount: lineDiscountAmount,
                    taxPercent,
                    taxAmount: lineTaxAmount,
                    totalAmount: lineTotal,
                });
            }
            const rawDiscount = billDiscount !== undefined ? billDiscount : (req.body.overallDiscount ?? 0);
            const extraDiscount = round2(Number(rawDiscount) || 0);
            totalDiscount = round2(totalDiscount + extraDiscount);
            const totalAmount = Math.max(0, round2(grandTotal - extraDiscount));
            // 3. EMI split (down payment now, rest financed) vs regular partial payment
            let downPayment = 0;
            if (isEmi) {
                downPayment = round2(Number(emi.downPayment) || 0);
                if (downPayment < 0 || downPayment > totalAmount) {
                    throw Object.assign(new Error("emi.downPayment must be between 0 and the total amount"), { status: 400 });
                }
            }
            const initialPaid = isEmi ? downPayment : round2(Math.min(Number(paidAmount) || 0, totalAmount));
            const dueAmount = round2(totalAmount - initialPaid);
            let status = "unpaid";
            if (initialPaid >= totalAmount && totalAmount > 0)
                status = "paid";
            else if (initialPaid > 0)
                status = "partially_paid";
            // 4. Invoice number + Sale header
            const invoiceNumber = await (0, invoice_1.nextInvoiceNumber)({ ownerId, shopId, transaction: t });
            const sale = await models_1.Sale.create({
                owner_id: ownerId,
                shop_id: shopId,
                customer_id: customer.id,
                invoice_number: invoiceNumber,
                invoice_date: new Date(),
                subtotal,
                discount_amount: totalDiscount,
                tax_amount: totalTax,
                total_amount: totalAmount,
                paid_amount: initialPaid,
                due_amount: dueAmount,
                payment_method: normalizedPaymentMethod,
                is_emi: Boolean(isEmi),
                status,
                notes: notes ?? null,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            // 5. Sale items + Inventory Update (one stock movement per line)
            for (const pi of pricedItems) {
                await models_1.SaleItem.create({
                    sale_id: sale.id,
                    product_id: pi.product.id,
                    product_name: pi.product.name,
                    sku: pi.product.sku,
                    quantity: pi.quantity,
                    rate: pi.rate,
                    discount_percent: pi.discountPercent,
                    discount_amount: pi.discountAmount,
                    tax_percent: pi.taxPercent,
                    tax_amount: pi.taxAmount,
                    total_amount: pi.totalAmount,
                }, { transaction: t });
                await (0, inventory_1.recordStockMovement)({
                    ownerId,
                    shopId,
                    productId: pi.product.id,
                    type: "sale",
                    quantity: pi.quantity,
                    actorType,
                    actorId,
                    referenceType: "Sale",
                    referenceId: sale.id,
                    notes: `Sale ${invoiceNumber}`,
                    externalTransaction: t,
                });
            }
            // 6. Ledger Update — the sale always posts a debit for the full amount
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId,
                customerId: customer.id,
                entryType: "debit",
                amount: totalAmount,
                referenceType: "Sale",
                referenceId: sale.id,
                description: `Sale ${invoiceNumber}`,
                actorType,
                actorId,
                entryDate: sale.invoice_date,
                externalTransaction: t,
            });
            // 7. Payment received now (cash sale amount, or EMI down payment)
            let initialPayment = null;
            if (initialPaid > 0) {
                initialPayment = await models_1.Payment.create({
                    owner_id: ownerId,
                    shop_id: shopId,
                    customer_id: customer.id,
                    sale_id: sale.id,
                    type: isEmi ? "down_payment" : "sale_payment",
                    amount: initialPaid,
                    method: normalizedPaymentMethod,
                    transaction_id: transactionId ?? null,
                    payment_date: new Date(),
                    actor_type: actorType,
                    actor_id: actorId,
                }, { transaction: t });
                await (0, ledger_1.recordLedgerEntry)({
                    ownerId,
                    shopId,
                    customerId: customer.id,
                    entryType: "credit",
                    amount: initialPaid,
                    referenceType: "Payment",
                    referenceId: initialPayment.id,
                    description: isEmi ? `Down payment for ${invoiceNumber}` : `Payment for ${invoiceNumber}`,
                    actorType,
                    actorId,
                    externalTransaction: t,
                });
            }
            // 7b. Excess payment applied towards previous outstanding balance
            const excessPaid = !isEmi && Number(paidAmount) > totalAmount ? round2(Number(paidAmount) - totalAmount) : 0;
            if (excessPaid > 0) {
                const excessPayment = await models_1.Payment.create({
                    owner_id: ownerId,
                    shop_id: shopId,
                    customer_id: customer.id,
                    sale_id: sale.id,
                    type: "sale_payment",
                    amount: excessPaid,
                    method: normalizedPaymentMethod,
                    transaction_id: transactionId ?? null,
                    payment_date: new Date(),
                    actor_type: actorType,
                    actor_id: actorId,
                    notes: `Payment towards previous balance with ${invoiceNumber}`,
                }, { transaction: t });
                await (0, ledger_1.recordLedgerEntry)({
                    ownerId,
                    shopId,
                    customerId: customer.id,
                    entryType: "credit",
                    amount: excessPaid,
                    referenceType: "Payment",
                    referenceId: excessPayment.id,
                    description: `Payment towards previous balance with ${invoiceNumber}`,
                    actorType,
                    actorId,
                    externalTransaction: t,
                });
            }
            // 8. EMI plan + installment schedule
            let emiPlan = null;
            if (isEmi) {
                const financedAmount = round2(totalAmount - downPayment);
                const interestPercent = Number(emi.interestPercent) || 0;
                const lateFeePercent = Number(emi.lateFeePercent) || 0;
                const startDate = emi.startDate ? new Date(emi.startDate) : new Date();
                const numberOfInstallments = Number(emi.numberOfInstallments);
                const schedule = (0, emi_1.buildEmiSchedule)({
                    financedAmount,
                    interestPercent,
                    numberOfInstallments,
                    startDate,
                });
                emiPlan = await models_1.EMIPlan.create({
                    owner_id: ownerId,
                    shop_id: shopId,
                    sale_id: sale.id,
                    customer_id: customer.id,
                    total_amount: totalAmount,
                    down_payment: downPayment,
                    financed_amount: financedAmount,
                    interest_percent: interestPercent,
                    interest_amount: schedule.interestAmount,
                    payable_amount: schedule.payableAmount,
                    number_of_installments: numberOfInstallments,
                    emi_amount: schedule.emiAmount,
                    start_date: startDate,
                    late_fee_percent: lateFeePercent,
                    outstanding_amount: schedule.payableAmount,
                    actor_type: actorType,
                    actor_id: actorId,
                }, { transaction: t });
                for (const inst of schedule.installments) {
                    await models_1.EMIInstallment.create({
                        emi_plan_id: emiPlan.id,
                        installment_number: inst.installmentNumber,
                        due_date: inst.dueDate,
                        expected_amount: inst.expectedAmount,
                        remaining_amount: inst.expectedAmount,
                    }, { transaction: t });
                }
                // Sale's outstanding due mirrors the EMI plan's outstanding (financed) amount
                sale.due_amount = schedule.payableAmount;
                sale.status = "partially_paid";
                await sale.save({ transaction: t });
            }
            await (0, audit_1.logAudit)({
                req,
                module: "sales",
                action: "create",
                entityType: "Sale",
                entityId: sale.id,
                details: { invoiceNumber, totalAmount, paidAmount: initialPaid, isEmi: Boolean(isEmi) },
            });
            return sale.id;
        });
        const sale = await models_1.Sale.findByPk(result, { include: saleIncludes });
        return res.status(201).json({ success: true, data: sale });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
async function listSales(req, res) {
    const { customerId, status, from, to, isEmi, shopId: queryShopId, allShops } = req.query;
    const ownerId = req.auth.ownerId;
    let targetShopId = req.auth.shopId ?? undefined;
    if (req.auth.isOwner) {
        if (allShops === "true") {
            targetShopId = undefined;
        }
        else if (queryShopId) {
            targetShopId = Number(queryShopId);
        }
    }
    const where = { owner_id: ownerId };
    if (targetShopId)
        where.shop_id = targetShopId;
    if (customerId)
        where.customer_id = customerId;
    if (status)
        where.status = status;
    if (isEmi !== undefined)
        where.is_emi = isEmi === "true";
    if (from || to) {
        where.invoice_date = {};
        if (from)
            where.invoice_date[sequelize_1.Op.gte] = new Date(String(from));
        if (to)
            where.invoice_date[sequelize_1.Op.lte] = new Date(String(to));
    }
    const sales = await models_1.Sale.findAll({
        where,
        include: [
            { model: models_1.Customer, as: "customer", attributes: ["id", "name", "phone"] },
            { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            { model: models_1.SaleItem, as: "items" },
        ],
        order: [["created_at", "DESC"]],
        limit: Number(req.query.limit) || 100,
    });
    return res.json({ success: true, data: sales });
}
async function getSale(req, res) {
    const param = String(req.params.saleId).trim();
    const isNumeric = /^\d+$/.test(param);
    const where = { owner_id: req.auth.ownerId };
    if (isNumeric) {
        where.id = Number(param);
    }
    else {
        where.invoice_number = param;
    }
    if (!req.auth.isOwner) {
        where.shop_id = req.auth.shopId;
    }
    const sale = await models_1.Sale.findOne({
        where,
        include: saleIncludes,
    });
    if (!sale)
        return res.status(404).json({ success: false, message: "Sale invoice not found" });
    if (sale.emiPlan?.installments) {
        await (0, emi_1.refreshInstallmentStatuses)(sale.emiPlan.installments);
    }
    return res.json({ success: true, data: sale });
}
/** Record a later (partial or final) payment against an existing sale's due balance. */
async function recordSalePayment(req, res) {
    const { amount, method, transactionId, notes, paymentDate } = req.body;
    if (!amount || Number(amount) <= 0)
        return res.status(400).json({ success: false, message: "amount must be positive" });
    if (!method || !Sale_1.PAYMENT_METHODS.includes(method)) {
        return res.status(400).json({ success: false, message: `method must be one of: ${Sale_1.PAYMENT_METHODS.join(", ")}` });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const where = { id: req.params.saleId, owner_id: ownerId };
            if (!req.auth.isOwner) {
                where.shop_id = shopId;
            }
            const sale = await models_1.Sale.findOne({
                where,
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!sale)
                throw Object.assign(new Error("Sale not found"), { status: 404 });
            if (sale.status === "cancelled")
                throw Object.assign(new Error("Cannot pay a cancelled sale"), { status: 400 });
            if (sale.is_emi) {
                throw Object.assign(new Error("This sale is on EMI — pay individual installments via /api/emi/installments/:id/pay"), { status: 400 });
            }
            const payAmount = round2(Math.min(Number(amount), Number(sale.due_amount)));
            if (payAmount <= 0)
                throw Object.assign(new Error("Sale has no outstanding due amount"), { status: 400 });
            // Always attribute payment and ledger to the actual shop of the sale
            const targetShopId = sale.shop_id;
            const payment = await models_1.Payment.create({
                owner_id: ownerId,
                shop_id: targetShopId,
                customer_id: sale.customer_id,
                sale_id: sale.id,
                type: "sale_payment",
                amount: payAmount,
                method: method,
                transaction_id: transactionId ?? null,
                payment_date: paymentDate ? new Date(paymentDate) : new Date(),
                notes: notes ?? null,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: targetShopId,
                customerId: sale.customer_id,
                entryType: "credit",
                amount: payAmount,
                referenceType: "Payment",
                referenceId: payment.id,
                description: `Payment for ${sale.invoice_number}`,
                actorType,
                actorId,
                externalTransaction: t,
            });
            sale.paid_amount = round2(Number(sale.paid_amount) + payAmount);
            sale.due_amount = round2(Number(sale.due_amount) - payAmount);
            sale.status = sale.due_amount <= 0 ? "paid" : "partially_paid";
            await sale.save({ transaction: t });
            await (0, audit_1.logAudit)({
                req,
                module: "billing",
                action: "payment",
                entityType: "Sale",
                entityId: sale.id,
                details: { amount: payAmount, method },
            });
            return payment.id;
        });
        const payment = await models_1.Payment.findByPk(result, { include: [{ model: models_1.Sale, as: "sale" }] });
        return res.status(201).json({ success: true, data: payment });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
/**
 * CANCELLATION: never deletes anything. Reverses each line's stock
 * (customer_return, net of anything already returned), closes out
 * the outstanding ledger debit, and flips status to "cancelled".
 * Payments already received stay on record — the customer ends up
 * with a shop-credit balance for that amount, which the owner can
 * settle with a separate refund Payment if cash actually changes hands.
 */
async function cancelSale(req, res) {
    const { reason } = req.body;
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        await models_1.sequelize.transaction(async (t) => {
            const where = { id: req.params.saleId, owner_id: ownerId };
            if (!req.auth.isOwner) {
                where.shop_id = shopId;
            }
            const sale = await models_1.Sale.findOne({
                where,
                include: [{ model: models_1.SaleItem, as: "items" }, { model: models_1.EMIPlan, as: "emiPlan" }],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!sale)
                throw Object.assign(new Error("Sale not found"), { status: 404 });
            if (sale.status === "cancelled")
                throw Object.assign(new Error("Sale is already cancelled"), { status: 400 });
            const targetShopId = sale.shop_id; // Stock and ledger stay with the original shop
            for (const item of sale.items) {
                const outstandingQty = item.quantity - item.returned_quantity;
                if (outstandingQty > 0) {
                    await (0, inventory_1.recordStockMovement)({
                        ownerId,
                        shopId: targetShopId,
                        productId: item.product_id,
                        type: "customer_return",
                        quantity: outstandingQty,
                        actorType,
                        actorId,
                        referenceType: "SaleCancellation",
                        referenceId: sale.id,
                        notes: `Cancelled sale ${sale.invoice_number}`,
                        externalTransaction: t,
                    });
                }
            }
            if (Number(sale.due_amount) > 0) {
                await (0, ledger_1.recordLedgerEntry)({
                    ownerId,
                    shopId: targetShopId,
                    customerId: sale.customer_id,
                    entryType: "credit",
                    amount: Number(sale.due_amount),
                    referenceType: "SaleCancellation",
                    referenceId: sale.id,
                    description: `Cancellation of ${sale.invoice_number}`,
                    actorType,
                    actorId,
                    externalTransaction: t,
                });
            }
            if (sale.emiPlan) {
                const plan = sale.emiPlan;
                plan.status = "cancelled";
                plan.cancel_reason = reason ?? "Sale cancelled";
                plan.outstanding_amount = 0;
                await plan.save({ transaction: t });
                await models_1.EMIInstallment.update({ status: "Cancelled" }, { where: { emi_plan_id: plan.id, status: ["Upcoming", "Due", "Overdue", "Partially Paid"] }, transaction: t });
            }
            sale.due_amount = 0;
            sale.status = "cancelled";
            sale.cancel_reason = reason ?? null;
            await sale.save({ transaction: t });
            await (0, audit_1.logAudit)({ req, module: "sales", action: "cancel", entityType: "Sale", entityId: sale.id, details: { reason } });
        });
        const sale = await models_1.Sale.findByPk(req.params.saleId, { include: saleIncludes });
        return res.json({ success: true, data: sale });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
/**
 * RETURNS: partial or full product return. Restocks inventory,
 * credits the customer ledger for the refund amount, and marks each
 * returned line's returned_quantity so it can't be double-returned.
 * Body: { items: [{ saleItemId, quantity, reason? }], reason? }
 */
async function returnSale(req, res) {
    const { items, reason } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "items must be a non-empty array" });
    }
    const ownerId = req.auth.ownerId;
    const shopId = req.auth.shopId;
    const { actorType, actorId } = actorFromReq(req);
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const where = { id: req.params.saleId, owner_id: ownerId };
            if (!req.auth.isOwner) {
                where.shop_id = shopId;
            }
            const sale = await models_1.Sale.findOne({
                where,
                include: [{ model: models_1.SaleItem, as: "items" }],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!sale)
                throw Object.assign(new Error("Sale not found"), { status: 404 });
            if (sale.status === "cancelled")
                throw Object.assign(new Error("Cannot return items on a cancelled sale"), { status: 400 });
            const targetShopId = sale.shop_id; // Stock and ledger stay with original shop
            const saleReturn = await models_1.SaleReturn.create({
                owner_id: ownerId,
                shop_id: targetShopId,
                sale_id: sale.id,
                customer_id: sale.customer_id,
                return_date: new Date(),
                reason: reason ?? null,
                refund_amount: 0,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            let totalRefund = 0;
            const saleItems = sale.items;
            for (const line of items) {
                const saleItem = saleItems.find((si) => si.id === Number(line.saleItemId));
                if (!saleItem)
                    throw Object.assign(new Error(`Sale item ${line.saleItemId} not found on this sale`), { status: 404 });
                const returnQty = Number(line.quantity);
                const availableQty = saleItem.quantity - saleItem.returned_quantity;
                if (!returnQty || returnQty <= 0 || returnQty > availableQty) {
                    throw Object.assign(new Error(`Invalid return quantity for ${saleItem.product_name}: available ${availableQty}`), { status: 400 });
                }
                const perUnitTotal = round2(Number(saleItem.total_amount) / saleItem.quantity);
                const refundAmount = round2(perUnitTotal * returnQty);
                totalRefund = round2(totalRefund + refundAmount);
                await models_1.SaleReturnItem.create({
                    sale_return_id: saleReturn.id,
                    sale_item_id: saleItem.id,
                    product_id: saleItem.product_id,
                    quantity: returnQty,
                    rate: saleItem.rate,
                    refund_amount: refundAmount,
                }, { transaction: t });
                saleItem.returned_quantity += returnQty;
                await saleItem.save({ transaction: t });
                await (0, inventory_1.recordStockMovement)({
                    ownerId,
                    shopId: targetShopId,
                    productId: saleItem.product_id,
                    type: "customer_return",
                    quantity: returnQty,
                    actorType,
                    actorId,
                    referenceType: "SaleReturn",
                    referenceId: saleReturn.id,
                    notes: `Return against ${sale.invoice_number}`,
                    externalTransaction: t,
                });
            }
            saleReturn.refund_amount = totalRefund;
            await saleReturn.save({ transaction: t });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: targetShopId,
                customerId: sale.customer_id,
                entryType: "credit",
                amount: totalRefund,
                referenceType: "SaleReturn",
                referenceId: saleReturn.id,
                description: `Return against ${sale.invoice_number}`,
                actorType,
                actorId,
                externalTransaction: t,
            });
            sale.total_amount = round2(Number(sale.total_amount) - totalRefund);
            sale.due_amount = Math.max(0, round2(Number(sale.due_amount) - totalRefund));
            const allReturned = saleItems.every((si) => si.returned_quantity >= si.quantity);
            sale.status = allReturned ? "returned" : "partially_returned";
            await sale.save({ transaction: t });
            await (0, audit_1.logAudit)({
                req,
                module: "sales",
                action: "return",
                entityType: "SaleReturn",
                entityId: saleReturn.id,
                details: { saleId: sale.id, refundAmount: totalRefund },
            });
            return saleReturn.id;
        });
        const saleReturn = await models_1.SaleReturn.findByPk(result, { include: [{ model: models_1.SaleReturnItem, as: "items" }] });
        return res.status(201).json({ success: true, data: saleReturn });
    }
    catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
    }
}
/** Streams a printable/downloadable PDF invoice for the given sale. */
async function downloadBillPdf(req, res) {
    const where = { id: req.params.saleId, owner_id: req.auth.ownerId };
    if (!req.auth.isOwner) {
        where.shop_id = req.auth.shopId;
    }
    const sale = await models_1.Sale.findOne({
        where,
        include: saleIncludes,
    });
    if (!sale)
        return res.status(404).json({ success: false, message: "Sale not found" });
    (0, pdf_1.streamBillPdf)(res, sale.toJSON());
}
//# sourceMappingURL=saleController.js.map