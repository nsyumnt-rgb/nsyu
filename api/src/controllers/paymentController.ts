import { Request, Response } from "express";
import { CustomerLedger, Sale, Customer, Shop, Notification, sequelize } from "../models";
import { computeBillPaymentStatus } from "../models/Sale";
import { streamReceiptPdf } from "../utils/pdf";
import { logAudit } from "../utils/audit";
import { recordCustomerPaymentTransaction, recordLedgerEntry } from "../utils/ledger";
import { Op } from "sequelize";

function formatPaymentResponse(entry: any) {
  if (!entry) return null;
  return {
    id: entry.id,
    owner_id: entry.owner_id,
    shop_id: entry.shop_id,
    customer_id: entry.customer_id,
    sale_id: entry.sale_id || entry.reference_id,
    type: "sale_payment",
    amount: entry.amount,
    method: entry.payment_method || "cash",
    transaction_id: entry.reference_code || null,
    payment_date: entry.entry_date,
    notes: entry.notes || entry.description,
    status: entry.status === "reversed" ? "cancelled" : "completed",
    actor_type: entry.actor_type,
    actor_id: entry.actor_id,
    reference_code: entry.reference_code,
    customer: entry.customer,
    sale: entry.sale,
    shop: entry.shop,
    created_at: entry.created_at,
  };
}

export async function listPayments(req: Request, res: Response) {
  const { customerId, saleId, allShops } = req.query;
  let targetShopId: number | undefined;

  if (req.auth!.isOwner) {
    if (allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId, entry_type: "credit" };
  if (targetShopId) where.shop_id = targetShopId;
  if (customerId) where.customer_id = customerId;
  if (saleId) where.reference_id = saleId;

  const entries = await CustomerLedger.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
    ],
    order: [["entry_date", "DESC"]],
    limit: Number(req.query.limit) || 100,
  });

  const payments = entries.map(formatPaymentResponse);
  return res.json({ success: true, data: payments });
}

export async function getPayment(req: Request, res: Response) {
  const param = String(req.params.paymentId).trim();
  const digitsMatch = param.match(/\d+$/);
  const numericId = digitsMatch ? Number(digitsMatch[0]) : null;

  const where: any = { owner_id: req.auth!.ownerId, entry_type: "credit" };
  if (numericId !== null && !isNaN(numericId)) {
    where.id = numericId;
  } else {
    where.reference_code = param;
  }

  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const entry = await CustomerLedger.findOne({
    where,
    include: [
      { model: Customer, as: "customer" },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
    ],
  });
  if (!entry) return res.status(404).json({ success: false, message: "Payment not found in ledger" });
  return res.json({ success: true, data: formatPaymentResponse(entry) });
}

export async function createPayment(req: Request, res: Response) {
  const { customerId, amount, type, method, transactionId, paymentDate, notes, saleId } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.body.shopId ? Number(req.body.shopId) : (req.auth!.shopId || 1);
  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || 1);

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ success: false, message: "Valid payment amount is required" });
  }

  const validMethods = ["cash", "upi", "bank_transfer", "card", "cheque", "other"];
  let cleanMethod = String(method || "cash").toLowerCase().trim();
  if (cleanMethod === "online") cleanMethod = "upi";
  if (!validMethods.includes(cleanMethod)) cleanMethod = "cash";

  const validTypes = ["sale_payment", "down_payment", "emi_payment", "refund"];
  let cleanType = String(type || "sale_payment").toLowerCase().trim();
  if (!validTypes.includes(cleanType)) cleanType = "sale_payment";

  const idempotencyKey =
    String(req.headers["x-idempotency-key"] || req.body.idempotencyKey || req.body.clientRequestId || "").trim() || null;

  try {
    const result = await recordCustomerPaymentTransaction({
      ownerId,
      shopId,
      customerId: customerId ? Number(customerId) : null,
      saleId: saleId ? Number(saleId) : null,
      invoiceNumber: req.body.invoiceNumber || req.body.billNumber || req.body.invoice_number || null,
      amount: numAmount,
      paymentMethod: cleanMethod,
      referenceCode: req.body.referenceCode || transactionId || null,
      idempotencyKey,
      notes: notes || "Payment received",
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      actorType,
      actorId,
      isOwner: req.auth!.isOwner,
      allowAdvance: Boolean(req.body.allowAdvance),
      referenceType: saleId ? "SalePayment" : "Payment",
    });

    if (!result.idempotent) {
      await logAudit({
        req,
        module: "ledger",
        action: "payment",
        entityType: "CustomerLedger",
        entityId: result.entry.id,
        details: { amount: numAmount, method: cleanMethod, customerId: result.customer.id, saleId: result.sale?.id ?? null },
      });

      try {
        const custName = result.customer ? result.customer.name : "Customer";
        await Notification.create({
          owner_id: ownerId,
          shop_id: shopId,
          recipient_type: "owner",
          recipient_id: ownerId,
          type: "payment_received",
          title: `Payment Received: ₹${numAmount}`,
          message: `₹${numAmount} received via ${cleanMethod.toUpperCase()} from ${custName}.`,
          reference_type: "Payment",
          reference_id: result.entry.id,
          is_read: false,
        });
        await Notification.create({
          owner_id: ownerId,
          shop_id: shopId,
          recipient_type: "customer",
          recipient_id: result.customer.id,
          type: "payment_received",
          title: `Payment Received: ₹${numAmount}`,
          message: `Your payment of ₹${numAmount} via ${cleanMethod.toUpperCase()} has been recorded.`,
          reference_type: "Payment",
          reference_id: result.entry.id,
          is_read: false,
        });
      } catch (notifErr) {
        console.error("Failed to create payment notification:", notifErr);
      }
    }

    const fullPayment = await CustomerLedger.findByPk(result.entry.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop" },
      ],
    });

    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      idempotent: result.idempotent,
      data: formatPaymentResponse(fullPayment),
      sale: result.sale,
      updatedSales: result.updatedSales,
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

/**
 * Voids a payment: flips status to "reversed" and
 * posts a reversing debit on the customer ledger, then re-syncs the
 * owning Sale's paid/due amounts.
 */
export async function cancelPayment(req: Request, res: Response) {
  const { reason } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  try {
    await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.paymentId, owner_id: ownerId, entry_type: "credit" };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const entry = await CustomerLedger.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!entry) throw Object.assign(new Error("Payment entry not found in ledger"), { status: 404 });
      if (entry.status === "reversed") throw Object.assign(new Error("Payment already cancelled/reversed"), { status: 400 });

      await recordLedgerEntry({
        ownerId,
        shopId: entry.shop_id,
        customerId: entry.customer_id,
        entryType: "debit",
        amount: Number(entry.amount),
        referenceType: "PaymentCancellation",
        referenceId: entry.id,
        description: `Reversal of payment #${entry.id}${reason ? `: ${reason}` : ""}`,
        actorType: actorType as "owner" | "employee",
        actorId: actorId as number,
        externalTransaction: t,
      });

      entry.status = "reversed";
      entry.notes = [entry.notes, reason ? `Cancelled: ${reason}` : "Cancelled"].filter(Boolean).join(" | ");
      await entry.save({ transaction: t });

      const targetSaleId = entry.sale_id || (entry.reference_type !== "Customer" ? entry.reference_id : null);
      if (targetSaleId) {
        const sale = await Sale.findOne({ where: { id: targetSaleId }, transaction: t, lock: t.LOCK.UPDATE });
        if (sale) {
          sale.paid_amount = Math.max(0, Number(sale.paid_amount) - Number(entry.amount));
          sale.due_amount = Math.max(0, Number(sale.total_amount) - sale.paid_amount);
          sale.status = sale.due_amount <= 0.01 ? "paid" : sale.paid_amount > 0.01 ? "partially_paid" : "unpaid";
          sale.payment_status = computeBillPaymentStatus(sale.total_amount, sale.paid_amount, sale.status);
          await sale.save({ transaction: t });
        }
      }

      await logAudit({ req, module: "ledger", action: "cancel_payment", entityType: "CustomerLedger", entityId: entry.id, details: { reason } });
    });

    const entry = await CustomerLedger.findByPk(req.params.paymentId, {
      include: [
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop" },
      ],
    });
    return res.json({ success: true, data: formatPaymentResponse(entry) });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function downloadReceiptPdf(req: Request, res: Response) {
  const where: any = { id: req.params.paymentId, owner_id: req.auth!.ownerId, entry_type: "credit" };
  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const entry = await CustomerLedger.findOne({
    where,
    include: [
      { model: Customer, as: "customer" },
      { model: Shop, as: "shop" },
    ],
  });
  if (!entry) return res.status(404).json({ success: false, message: "Payment receipt not found" });

  const paymentData = formatPaymentResponse(entry);
  streamReceiptPdf(res, paymentData);
}
