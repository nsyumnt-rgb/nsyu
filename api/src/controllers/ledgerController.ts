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

  // Each active entry moves the balance up (+1, customer owes more) or down (-1).
  // Reversed entries stay visible for audit but no longer affect the balance.
  const effect = (e: CustomerLedger): 1 | -1 | 0 => {
    if (e.status !== "active") return 0;
    if (e.entry_type === "debit") return 1;
    if (e.entry_type === "credit") return -1;
    if (e.entry_type === "reversal") {
      if (e.reference_type === "PaymentReversal") return 1;
      if (e.reference_type === "SaleCancellation" || e.reference_type === "Return" || e.reference_type === "SaleReturn") return -1;
    }
    return 0;
  };
  const isOpeningEntry = (e: CustomerLedger) =>
    e.reference_type === "Opening_Balance" || Boolean(e.description?.toLowerCase().includes("opening"));

  const totalDebit = entries.filter((e) => effect(e) === 1).reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = entries.filter((e) => effect(e) === -1).reduce((sum, e) => sum + Number(e.amount), 0);

  const hasOpeningEntry = entries.some(isOpeningEntry);
  const openingOffset = hasOpeningEntry ? 0 : Number(customer.opening_balance) || 0;
  const calculatedBalance = round2(openingOffset + totalDebit - totalCredit);
  const shopBalance = calculatedBalance;

  // Statement summary: opening balance shown separately from bills/payments so the
  // four figures always satisfy  opening + debit - credit = current.
  const openingFromEntries = entries
    .filter((e) => isOpeningEntry(e) && effect(e) !== 0)
    .reduce((sum, e) => sum + effect(e) * Number(e.amount), 0);
  const openingBalance = round2(openingOffset + openingFromEntries);
  const summary = {
    openingBalance,
    totalDebit: round2(entries.filter((e) => effect(e) === 1 && !isOpeningEntry(e)).reduce((sum, e) => sum + Number(e.amount), 0)),
    totalCredit: round2(entries.filter((e) => effect(e) === -1 && !isOpeningEntry(e)).reduce((sum, e) => sum + Number(e.amount), 0)),
    currentBalance: calculatedBalance,
  };

  // Running balance recomputed from the entries in this view (chronological order).
  let running = openingOffset;
  const entriesWithBalance = entries.map((e) => {
    running = round2(running + effect(e) * Number(e.amount));
    return { ...e.toJSON(), running_balance: running, affects_balance: effect(e) !== 0 };
  });

  // Auto-reconcile customer.current_balance only from the complete (all-shop) ledger.
  // A shop-scoped view sees just part of the history and must never overwrite it.
  if (!targetShopId && Math.abs(Number(customer.current_balance) - calculatedBalance) > 0.01) {
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
      totalDebit: round2(totalDebit),
      totalCredit: round2(totalCredit),
      summary,
      entries: entriesWithBalance,
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
