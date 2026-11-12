import { Request, Response } from "express";
import { Customer, CustomerLedger, Shop, Notification } from "../models";
import { recordCustomerPaymentTransaction } from "../utils/ledger";
import { logAudit } from "../utils/audit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Full transaction history + running balance for one customer. */
export async function getCustomerLedger(req: Request, res: Response) {
  const customer = await Customer.findOne({
    where: { id: req.params.customerId, owner_id: req.auth!.ownerId },
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

  let targetShopId: number | undefined;
  if (req.auth!.isOwner) {
    if (req.query.allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId, customer_id: customer.id };
  if (targetShopId) where.shop_id = targetShopId;

  const entries = await CustomerLedger.findAll({
    where,
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
    order: [
      ["entry_date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const totalDebit = entries
    .filter(
      (e) =>
        (e.entry_type === "debit" ||
          (e.entry_type === "reversal" && e.reference_type === "PaymentReversal")) &&
        e.status === "active"
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = entries
    .filter(
      (e) =>
        (e.entry_type === "credit" ||
          (e.entry_type === "reversal" &&
            (e.reference_type === "SaleCancellation" ||
              e.reference_type === "Return" ||
              e.reference_type === "SaleReturn"))) &&
        e.status === "active"
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const hasOpeningEntry = entries.some((e) => e.reference_type === "Opening_Balance" || e.description?.toLowerCase().includes("opening"));
  const openingOffset = hasOpeningEntry ? 0 : Number(customer.opening_balance) || 0;
  const calculatedBalance = Math.round((openingOffset + totalDebit - totalCredit) * 100) / 100;
  const shopBalance = calculatedBalance;

  // Auto-reconcile customer.current_balance if it drifts from actual active entries
  if (Math.abs(Number(customer.current_balance) - calculatedBalance) > 0.01) {
    customer.current_balance = calculatedBalance;
    await customer.save().catch(() => {});
  }

  return res.json({
    success: true,
    data: {
      customer,
      currentBalance: calculatedBalance,
      shopBalance,
      isShopScoped: !!targetShopId,
      scopedShopId: targetShopId ?? null,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      entries,
    },
  });
}

/** Overview: every customer with an outstanding balance, for a collections view. */
export async function listOutstandingBalances(req: Request, res: Response) {
  const customers = await Customer.findAll({
    where: { owner_id: req.auth!.ownerId },
    order: [["current_balance", "DESC"]],
  });

  const outstanding = customers.filter((c) => Number(c.current_balance) !== 0);
  return res.json({ success: true, data: outstanding });
}

/**
 * Record a payment (credit entry) directly on the customer's ledger.
 * This is the primary single-ledger payment entry point.
 */
export async function recordLedgerPayment(req: Request, res: Response) {
  const {
    customerId,
    amount,
    paymentMethod,
    method,
    notes,
    referenceCode,
    transactionId,
    saleId,
    paymentDate,
    entryDate,
    invoiceNumber,
    billNumber,
    invoice_number,
    allowAdvance,
  } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.body.shopId ? Number(req.body.shopId) : (req.auth!.shopId || 1);
  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || 1);

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ success: false, message: "Valid payment amount is required" });
  }

  let cleanMethod = String(paymentMethod || method || "cash").toLowerCase().trim();
  if (cleanMethod === "online") cleanMethod = "upi";
  const idempotencyKey =
    String(req.headers["x-idempotency-key"] || req.body.idempotencyKey || req.body.clientRequestId || "").trim() || null;
  const resolvedDate = paymentDate || entryDate ? new Date(paymentDate || entryDate) : new Date();

  try {
    const result = await recordCustomerPaymentTransaction({
      ownerId,
      shopId,
      customerId: customerId || req.params.customerId ? Number(customerId || req.params.customerId) : null,
      saleId: saleId ? Number(saleId) : null,
      invoiceNumber: invoiceNumber || billNumber || invoice_number || null,
      amount: numAmount,
      paymentMethod: cleanMethod,
      referenceCode: referenceCode || transactionId || null,
      idempotencyKey,
      notes: notes || "Payment received",
      paymentDate: resolvedDate,
      actorType,
      actorId,
      isOwner: req.auth!.isOwner,
      allowAdvance: Boolean(allowAdvance),
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
        await Notification.create({
          owner_id: ownerId,
          shop_id: shopId,
          recipient_type: "owner",
          recipient_id: ownerId,
          type: "payment_received",
          title: `Payment Received: ₹${numAmount}`,
          message: `₹${numAmount} received via ${cleanMethod.toUpperCase()} from ${result.customer.name}.`,
          reference_type: "CustomerLedger",
          reference_id: result.entry.id,
          is_read: false,
        });
      } catch (_) {}
    }

    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      idempotent: result.idempotent,
      data: result.entry,
      sale: result.sale,
      updatedSales: result.updatedSales,
      currentBalance: Number(result.customer.current_balance),
      message: result.idempotent
        ? "Payment already recorded (idempotent)"
        : `Payment of ₹${numAmount} successfully recorded in customer ledger`,
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
