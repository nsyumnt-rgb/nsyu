import { Request, Response } from "express";
import { CustomerLedger, Sale, Customer, Shop, Notification, sequelize } from "../models";
import { streamReceiptPdf } from "../utils/pdf";
import { logAudit } from "../utils/audit";
import { recordLedgerEntry } from "../utils/ledger";
import { Op } from "sequelize";

function formatPaymentResponse(entry: any) {
  if (!entry) return null;
  return {
    id: entry.id,
    owner_id: entry.owner_id,
    shop_id: entry.shop_id,
    customer_id: entry.customer_id,
    sale_id: entry.reference_id,
    type: "sale_payment",
    amount: entry.amount,
    method: entry.payment_method || "cash",
    transaction_id: null,
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

  try {
    const result = await sequelize.transaction(async (t) => {
      let resolvedSaleId = saleId ? Number(saleId) : null;
      if (!resolvedSaleId && (req.body.invoiceNumber || req.body.billNumber || req.body.invoice_number)) {
        const invNum = String(req.body.invoiceNumber || req.body.billNumber || req.body.invoice_number).trim();
        const foundSale = await Sale.findOne({ where: { invoice_number: invNum, owner_id: ownerId }, transaction: t });
        if (foundSale) resolvedSaleId = foundSale.id;
      }

      let targetCustId = customerId ? Number(customerId) : null;
      if ((!targetCustId || isNaN(targetCustId)) && resolvedSaleId) {
        const saleForCust = await Sale.findOne({ where: { id: resolvedSaleId, owner_id: ownerId }, transaction: t });
        if (saleForCust) targetCustId = saleForCust.customer_id;
      }
      if (!targetCustId || isNaN(targetCustId)) {
        const firstCust = await Customer.findOne({ where: { owner_id: ownerId }, transaction: t });
        if (!firstCust) throw Object.assign(new Error("No customer found"), { status: 404 });
        targetCustId = firstCust.id;
      }

      const receiptCode = `RCP-${Date.now()}`;
      const { entry: ledgerEntry } = await recordLedgerEntry({
        ownerId,
        shopId,
        customerId: targetCustId,
        entryType: "credit",
        amount: numAmount,
        referenceType: "Payment",
        referenceId: resolvedSaleId ?? undefined,
        referenceCode: receiptCode,
        paymentMethod: cleanMethod,
        notes: notes || "Payment received",
        description: notes || `Payment received (${cleanMethod.toUpperCase()})`,
        actorType,
        actorId,
        entryDate: paymentDate ? new Date(paymentDate) : new Date(),
        externalTransaction: t,
      });

      // If saleId provided, update that sale
      if (resolvedSaleId) {
        const sale = await Sale.findOne({ where: { id: resolvedSaleId, owner_id: ownerId }, transaction: t, lock: t.LOCK.UPDATE });
        if (sale) {
          if (sale.status === "cancelled") {
            throw Object.assign(new Error("Cannot add payment to a cancelled bill"), { status: 400 });
          }
          const currentPaid = Number(sale.paid_amount || 0);
          const total = Number(sale.total_amount || 0);
          const newPaid = Math.round((currentPaid + numAmount) * 100) / 100;
          if (newPaid > total + 0.01) {
            throw Object.assign(
              new Error(`Payment amount ₹${numAmount} exceeds remaining due amount of ₹${Math.max(0, total - currentPaid)}`),
              { status: 400 }
            );
          }
          const roundedPaid = Math.min(total, newPaid);
          const remainingDue = Math.max(0, Math.round((total - roundedPaid) * 100) / 100);
          sale.paid_amount = roundedPaid;
          sale.due_amount = remainingDue <= 0.01 ? 0 : remainingDue;
          sale.status = sale.due_amount <= 0.01 ? "paid" : "partially_paid";
          await sale.save({ transaction: t });
        }
      } else {
        // Allocate to unpaid sales chronologically
        const unpaidSales = await Sale.findAll({
          where: {
            owner_id: ownerId,
            customer_id: targetCustId,
            status: ["unpaid", "partially_paid"],
          },
          order: [["created_at", "ASC"]],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        let remaining = numAmount;
        for (const s of unpaidSales) {
          if (remaining <= 0) break;
          const due = Math.max(0, Number(s.due_amount));
          const apply = Math.min(remaining, due);
          s.paid_amount = Math.round((Number(s.paid_amount) + apply) * 100) / 100;
          s.due_amount = Math.max(0, Math.round((Number(s.total_amount) - Number(s.paid_amount)) * 100) / 100);
          if (s.due_amount <= 0.01) {
            s.due_amount = 0;
            s.status = "paid";
          } else {
            s.status = "partially_paid";
          }
          await s.save({ transaction: t });
          remaining = Math.round((remaining - apply) * 100) / 100;
        }
      }

      await logAudit({
        req,
        module: "ledger",
        action: "payment",
        entityType: "CustomerLedger",
        entityId: ledgerEntry.id,
        details: { amount: numAmount, method: cleanMethod, customerId: targetCustId },
      });

      // In-app notification for payment received
      try {
        const targetCust = await Customer.findByPk(targetCustId, { transaction: t });
        const custName = targetCust ? targetCust.name : "Customer";
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "payment_received",
            title: `Payment Received: ₹${numAmount}`,
            message: `₹${numAmount} received via ${cleanMethod.toUpperCase()} from ${custName}.`,
            reference_type: "Payment",
            reference_id: ledgerEntry.id,
            is_read: false,
          },
          { transaction: t }
        );

        if (targetCustId) {
          await Notification.create(
            {
              owner_id: ownerId,
              shop_id: shopId,
              recipient_type: "customer",
              recipient_id: targetCustId,
              type: "payment_received",
              title: `Payment Received: ₹${numAmount}`,
              message: `Your payment of ₹${numAmount} via ${cleanMethod.toUpperCase()} has been recorded.`,
              reference_type: "Payment",
              reference_id: ledgerEntry.id,
              is_read: false,
            },
            { transaction: t }
          );
        }
      } catch (notifErr) {
        console.error("Failed to create payment notification:", notifErr);
      }

      return ledgerEntry;
    });

    const fullPayment = await CustomerLedger.findByPk(result.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop" },
      ],
    });

    return res.status(201).json({ success: true, data: formatPaymentResponse(fullPayment) });
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

      if (entry.reference_id && entry.reference_type !== "Customer") {
        const sale = await Sale.findOne({ where: { id: entry.reference_id }, transaction: t, lock: t.LOCK.UPDATE });
        if (sale) {
          sale.paid_amount = Math.max(0, Number(sale.paid_amount) - Number(entry.amount));
          sale.due_amount = Number(sale.total_amount) - sale.paid_amount;
          sale.status = sale.due_amount <= 0 ? "paid" : sale.paid_amount > 0 ? "partially_paid" : "unpaid";
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
