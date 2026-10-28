import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  sequelize,
  Purchase,
  PurchaseItem,
  Product,
  Supplier,
  Shop,
  SupplierPayment,
  PurchaseReturn,
  PurchaseReturnItem,
} from "../models";
import { PAYMENT_METHODS, PaymentMethod } from "../models/Sale";
import { recordStockMovement } from "../utils/inventory";
import { recordSupplierLedgerEntry } from "../utils/supplierLedger";
import { nextPurchaseNumber } from "../utils/purchaseNumber";
import { logAudit } from "../utils/audit";
import { streamPurchasePdf } from "../utils/pdf";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function actorFromReq(req: Request) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}

const purchaseIncludes = [
  { model: PurchaseItem, as: "items" },
  { model: Supplier, as: "supplier" },
  { model: Shop, as: "shop" },
  { model: SupplierPayment, as: "payments" },
  { model: PurchaseReturn, as: "returns", include: [{ model: PurchaseReturnItem, as: "items" }] },
];

/**
 * PURCHASE FLOW (mirrors saleController.createSale exactly, direction
 * reversed): Supplier -> Shop -> Product -> Cart -> Discount -> Tax ->
 * Payment -> Save -> INCREASE Inventory -> Supplier Ledger -> Payment
 * -> Outstanding update. All-or-nothing in one DB transaction.
 *
 * Body:
 * {
 *   supplierId, items: [{ productId, quantity, rate?, discountPercent?, taxPercent? }],
 *   billDiscount?, paymentMethod, paidAmount?, transactionId?, notes?
 * }
 */
export async function createPurchase(req: Request, res: Response) {
  const { supplierId, items, billDiscount, paymentMethod, paidAmount, transactionId, notes } = req.body;

  if (!supplierId) return res.status(400).json({ success: false, message: "supplierId is required" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "items must be a non-empty array" });
  }
  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: `paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const result = await sequelize.transaction(async (t) => {
      const supplier = await Supplier.findOne({ where: { id: supplierId, owner_id: ownerId }, transaction: t });
      if (!supplier) throw Object.assign(new Error("Supplier not found"), { status: 404 });

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let grandTotal = 0;
      const pricedItems: any[] = [];

      for (const raw of items) {
        const { productId, quantity } = raw;
        if (!productId || !quantity || Number(quantity) <= 0) {
          throw Object.assign(new Error("Each item needs a valid productId and positive quantity"), { status: 400 });
        }
        const product = await Product.findOne({ where: { id: productId, owner_id: ownerId }, transaction: t });
        if (!product) throw Object.assign(new Error(`Product ${productId} not found`), { status: 404 });

        const qty = Number(quantity);
        const rate = raw.rate !== undefined ? Number(raw.rate) : Number(product.purchase_price);
        const discountPercent = Number(raw.discountPercent) || 0;
        const taxPercent = raw.taxPercent !== undefined ? Number(raw.taxPercent) : Number(product.tax_percent);

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

      const extraDiscount = round2(Number(billDiscount) || 0);
      totalDiscount = round2(totalDiscount + extraDiscount);
      const totalAmount = Math.max(0, round2(grandTotal - extraDiscount));
      const initialPaid = round2(Math.min(Number(paidAmount) || 0, totalAmount));
      const dueAmount = round2(totalAmount - initialPaid);

      let status: Purchase["status"] = "unpaid";
      if (initialPaid >= totalAmount && totalAmount > 0) status = "paid";
      else if (initialPaid > 0) status = "partially_paid";

      const purchaseNumber = await nextPurchaseNumber({ ownerId, shopId, transaction: t });

      const purchase = await Purchase.create(
        {
          owner_id: ownerId,
          shop_id: shopId,
          supplier_id: supplier.id,
          purchase_number: purchaseNumber,
          purchase_date: new Date(),
          subtotal,
          discount_amount: totalDiscount,
          tax_amount: totalTax,
          total_amount: totalAmount,
          paid_amount: initialPaid,
          due_amount: dueAmount,
          payment_method: paymentMethod as PaymentMethod,
          status,
          notes: notes ?? null,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      for (const pi of pricedItems) {
        await PurchaseItem.create(
          {
            purchase_id: purchase.id,
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
          },
          { transaction: t }
        );

        await recordStockMovement({
          ownerId,
          shopId,
          productId: pi.product.id,
          type: "purchase",
          quantity: pi.quantity,
          actorType,
          actorId,
          referenceType: "Purchase",
          referenceId: purchase.id,
          notes: `Purchase ${purchaseNumber}`,
          externalTransaction: t,
        });
      }

      await recordSupplierLedgerEntry({
        ownerId,
        shopId,
        supplierId: supplier.id,
        entryType: "credit",
        amount: totalAmount,
        referenceType: "Purchase",
        referenceId: purchase.id,
        description: `Purchase ${purchaseNumber}`,
        actorType,
        actorId,
        entryDate: purchase.purchase_date,
        externalTransaction: t,
      });

      if (initialPaid > 0) {
        const payment = await SupplierPayment.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            supplier_id: supplier.id,
            purchase_id: purchase.id,
            type: "purchase_payment",
            amount: initialPaid,
            method: paymentMethod as PaymentMethod,
            transaction_id: transactionId ?? null,
            payment_date: new Date(),
            actor_type: actorType,
            actor_id: actorId,
          },
          { transaction: t }
        );

        await recordSupplierLedgerEntry({
          ownerId,
          shopId,
          supplierId: supplier.id,
          entryType: "debit",
          amount: initialPaid,
          referenceType: "SupplierPayment",
          referenceId: payment.id,
          description: `Payment for ${purchaseNumber}`,
          actorType,
          actorId,
          externalTransaction: t,
        });
      }

      await logAudit({
        req,
        module: "purchase",
        action: "create",
        entityType: "Purchase",
        entityId: purchase.id,
        details: { purchaseNumber, totalAmount, paidAmount: initialPaid },
      });

      return purchase.id;
    });

    const purchase = await Purchase.findByPk(result, { include: purchaseIncludes });
    return res.status(201).json({ success: true, data: purchase });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function listPurchases(req: Request, res: Response) {
  const { supplierId, status, from, to, shopId: queryShopId, allShops } = req.query;
  const ownerId = req.auth!.ownerId;
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
  if (supplierId) where.supplier_id = supplierId;
  if (status) where.status = status;
  if (from || to) {
    where.purchase_date = {};
    if (from) where.purchase_date[Op.gte] = new Date(String(from));
    if (to) where.purchase_date[Op.lte] = new Date(String(to));
  }

  const purchases = await Purchase.findAll({
    where,
    include: [
      { model: Supplier, as: "supplier", attributes: ["id", "name", "phone"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: PurchaseItem, as: "items" },
    ],
    order: [["created_at", "DESC"]],
    limit: Number(req.query.limit) || 100,
  });

  return res.json({ success: true, data: purchases });
}

export async function getPurchase(req: Request, res: Response) {
  const param = String(req.params.purchaseId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where.id = Number(param);
  } else {
    where.purchase_number = param;
  }

  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }
  const purchase = await Purchase.findOne({
    where,
    include: purchaseIncludes,
  });
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase bill not found" });
  return res.json({ success: true, data: purchase });
}

/** Record a later (partial or final) payment against a purchase's due balance. */
export async function recordPurchasePayment(req: Request, res: Response) {
  const { amount, method, transactionId, notes, paymentDate } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "amount must be positive" });
  if (!method || !PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ success: false, message: `method must be one of: ${PAYMENT_METHODS.join(", ")}` });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const result = await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.purchaseId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const purchase = await Purchase.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("Cannot pay a cancelled purchase"), { status: 400 });

      const payAmount = round2(Math.min(Number(amount), Number(purchase.due_amount)));
      if (payAmount <= 0) throw Object.assign(new Error("Purchase has no outstanding due amount"), { status: 400 });

      const targetShopId = purchase.shop_id; // Keep payment linked to original purchase shop

      const payment = await SupplierPayment.create(
        {
          owner_id: ownerId,
          shop_id: targetShopId,
          supplier_id: purchase.supplier_id,
          purchase_id: purchase.id,
          type: "purchase_payment",
          amount: payAmount,
          method: method as PaymentMethod,
          transaction_id: transactionId ?? null,
          payment_date: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes ?? null,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      await recordSupplierLedgerEntry({
        ownerId,
        shopId: targetShopId,
        supplierId: purchase.supplier_id,
        entryType: "debit",
        amount: payAmount,
        referenceType: "SupplierPayment",
        referenceId: payment.id,
        description: `Payment for ${purchase.purchase_number}`,
        actorType,
        actorId,
        externalTransaction: t,
      });

      purchase.paid_amount = round2(Number(purchase.paid_amount) + payAmount);
      purchase.due_amount = round2(Number(purchase.due_amount) - payAmount);
      purchase.status = purchase.due_amount <= 0 ? "paid" : "partially_paid";
      await purchase.save({ transaction: t });

      await logAudit({
        req,
        module: "purchase",
        action: "payment",
        entityType: "Purchase",
        entityId: purchase.id,
        details: { amount: payAmount, method },
      });

      return payment.id;
    });

    const payment = await SupplierPayment.findByPk(result, { include: [{ model: Purchase, as: "purchase" }] });
    return res.status(201).json({ success: true, data: payment });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/** CANCELLATION: never deletes. Reverses stock (net of returns) and closes out the outstanding ledger credit. */
export async function cancelPurchase(req: Request, res: Response) {
  const { reason } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.purchaseId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const purchase = await Purchase.findOne({
        where,
        include: [{ model: PurchaseItem, as: "items" }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("Purchase is already cancelled"), { status: 400 });

      for (const item of (purchase as any).items as PurchaseItem[]) {
        const outstandingQty = item.quantity - item.returned_quantity;
        if (outstandingQty > 0) {
          await recordStockMovement({
            ownerId,
            shopId: purchase.shop_id,
            productId: item.product_id,
            type: "purchase_return",
            quantity: outstandingQty,
            actorType,
            actorId,
            referenceType: "PurchaseCancellation",
            referenceId: purchase.id,
            notes: `Reversal of cancelled purchase ${purchase.purchase_number}`,
            externalTransaction: t,
          });
        }
      }

      if (Number(purchase.due_amount) > 0) {
        await recordSupplierLedgerEntry({
          ownerId,
          shopId: purchase.shop_id,
          supplierId: purchase.supplier_id,
          entryType: "debit",
          amount: Number(purchase.due_amount),
          referenceType: "PurchaseCancellation",
          referenceId: purchase.id,
          description: `Cancellation of ${purchase.purchase_number}`,
          actorType,
          actorId,
          externalTransaction: t,
        });
      }

      purchase.due_amount = 0;
      purchase.status = "cancelled";
      purchase.cancel_reason = reason ?? null;
      await purchase.save({ transaction: t });

      await logAudit({ req, module: "purchase", action: "cancel", entityType: "Purchase", entityId: purchase.id, details: { reason } });
    });

    const purchase = await Purchase.findByPk(req.params.purchaseId, { include: purchaseIncludes });
    return res.json({ success: true, data: purchase });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/** RETURNS: partial or full return of goods to the supplier. Deducts inventory and debits the supplier ledger (reduces what's owed). */
export async function returnPurchase(req: Request, res: Response) {
  const { items, reason } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "items must be a non-empty array" });
  }

  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const { actorType, actorId } = actorFromReq(req);

  try {
    const result = await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.purchaseId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const purchase = await Purchase.findOne({
        where,
        include: [{ model: PurchaseItem, as: "items" }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("Cannot return items on a cancelled purchase"), { status: 400 });

      const purchaseReturn = await PurchaseReturn.create(
        {
          owner_id: ownerId,
          shop_id: purchase.shop_id,
          purchase_id: purchase.id,
          supplier_id: purchase.supplier_id,
          return_date: new Date(),
          reason: reason ?? null,
          refund_amount: 0,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      let totalRefund = 0;
      const purchaseItems = (purchase as any).items as PurchaseItem[];

      for (const line of items) {
        const purchaseItem = purchaseItems.find((pi) => pi.id === Number(line.purchaseItemId));
        if (!purchaseItem) throw Object.assign(new Error(`Purchase item ${line.purchaseItemId} not found on this purchase`), { status: 404 });

        const returnQty = Number(line.quantity);
        const availableQty = purchaseItem.quantity - purchaseItem.returned_quantity;
        if (!returnQty || returnQty <= 0 || returnQty > availableQty) {
          throw Object.assign(new Error(`Invalid return quantity for ${purchaseItem.product_name}: available ${availableQty}`), { status: 400 });
        }

        const perUnitTotal = round2(Number(purchaseItem.total_amount) / purchaseItem.quantity);
        const refundAmount = round2(perUnitTotal * returnQty);
        totalRefund = round2(totalRefund + refundAmount);

        await PurchaseReturnItem.create(
          {
            purchase_return_id: purchaseReturn.id,
            purchase_item_id: purchaseItem.id,
            product_id: purchaseItem.product_id,
            quantity: returnQty,
            rate: purchaseItem.rate,
            refund_amount: refundAmount,
          },
          { transaction: t }
        );

        purchaseItem.returned_quantity += returnQty;
        await purchaseItem.save({ transaction: t });

        await recordStockMovement({
          ownerId,
          shopId: purchase.shop_id,
          productId: purchaseItem.product_id,
          type: "purchase_return",
          quantity: returnQty,
          actorType,
          actorId,
          referenceType: "PurchaseReturn",
          referenceId: purchaseReturn.id,
          notes: `Return against ${purchase.purchase_number}`,
          externalTransaction: t,
        });
      }

      purchaseReturn.refund_amount = totalRefund;
      await purchaseReturn.save({ transaction: t });

      await recordSupplierLedgerEntry({
        ownerId,
        shopId: purchase.shop_id,
        supplierId: purchase.supplier_id,
        entryType: "debit",
        amount: totalRefund,
        referenceType: "PurchaseReturn",
        referenceId: purchaseReturn.id,
        description: `Return against ${purchase.purchase_number}`,
        actorType,
        actorId,
        externalTransaction: t,
      });

      purchase.total_amount = round2(Number(purchase.total_amount) - totalRefund);
      purchase.due_amount = Math.max(0, round2(Number(purchase.due_amount) - totalRefund));
      const allReturned = purchaseItems.every((pi) => pi.returned_quantity >= pi.quantity);
      purchase.status = allReturned ? "returned" : "partially_returned";
      await purchase.save({ transaction: t });

      await logAudit({
        req,
        module: "purchase",
        action: "return",
        entityType: "PurchaseReturn",
        entityId: purchaseReturn.id,
        details: { purchaseId: purchase.id, refundAmount: totalRefund },
      });

      return purchaseReturn.id;
    });

    const purchaseReturn = await PurchaseReturn.findByPk(result, { include: [{ model: PurchaseReturnItem, as: "items" }] });
    return res.status(201).json({ success: true, data: purchaseReturn });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function downloadPurchasePdf(req: Request, res: Response) {
  const where: any = { id: req.params.purchaseId, owner_id: req.auth!.ownerId };
  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }
  const purchase = await Purchase.findOne({
    where,
    include: purchaseIncludes,
  });
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });

  streamPurchasePdf(res, purchase.toJSON());
}
