import { Request, Response } from "express";
import { Customer, CustomerLedger, Shop, Sale, Notification, sequelize } from "../models";
import { recordLedgerEntry } from "../utils/ledger";
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
  const { customerId, amount, paymentMethod, method, notes, referenceCode, saleId, paymentDate, entryDate, invoiceNumber, billNumber, invoice_number } = req.body;
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
  const receiptCode = referenceCode || `RCP-${Date.now()}`;
  const resolvedDate = paymentDate || entryDate ? new Date(paymentDate || entryDate) : new Date();

  try {
    const result = await sequelize.transaction(async (t) => {
      let resolvedSaleId = saleId ? Number(saleId) : null;
      const rawInv = invoiceNumber || billNumber || invoice_number;
      if (!resolvedSaleId && rawInv) {
        const foundSale = await Sale.findOne({
          where: { invoice_number: String(rawInv).trim(), owner_id: ownerId },
          transaction: t,
        });
        if (foundSale) resolvedSaleId = foundSale.id;
      }

      let targetCustId = Number(customerId || req.params.customerId || 0);
      if ((!targetCustId || isNaN(targetCustId)) && resolvedSaleId) {
        const saleForCust = await Sale.findOne({ where: { id: resolvedSaleId, owner_id: ownerId }, transaction: t });
        if (saleForCust) targetCustId = saleForCust.customer_id;
      }

      const customer = targetCustId
        ? await Customer.findOne({ where: { id: targetCustId, owner_id: ownerId }, transaction: t })
        : await Customer.findOne({ where: { owner_id: ownerId }, transaction: t });

      if (!customer) {
        throw Object.assign(new Error("Customer not found"), { status: 404 });
      }
      targetCustId = customer.id;

      const { entry } = await recordLedgerEntry({
        ownerId,
        shopId,
        customerId: targetCustId,
        entryType: "credit",
        amount: numAmount,
        referenceType: resolvedSaleId ? "SalePayment" : "Payment",
        referenceId: resolvedSaleId ?? undefined,
        referenceCode: receiptCode,
        paymentMethod: cleanMethod,
        notes: notes || "Payment received",
        description: notes || `Payment received (${cleanMethod.toUpperCase()})`,
        actorType,
        actorId,
        entryDate: resolvedDate,
        externalTransaction: t,
      });

      // Allocate to specific sale if provided, else chronologically to unpaid sales
      if (resolvedSaleId) {
        const sale = await Sale.findOne({
          where: { id: resolvedSaleId, owner_id: ownerId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (sale) {
          if (sale.status === "cancelled") {
            throw Object.assign(new Error("Cannot add payment to a cancelled bill"), { status: 400 });
          }
          const curPaid = Number(sale.paid_amount || 0);
          const total = Number(sale.total_amount || 0);
          const newPaid = Math.min(total, round2(curPaid + numAmount));
          sale.paid_amount = newPaid;
          sale.due_amount = Math.max(0, round2(total - newPaid));
          sale.status = sale.due_amount <= 0.01 ? "paid" : "partially_paid";
          await sale.save({ transaction: t });
        }
      } else {
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
          s.paid_amount = round2(Number(s.paid_amount) + apply);
          s.due_amount = Math.max(0, round2(Number(s.total_amount) - Number(s.paid_amount)));
          if (s.due_amount <= 0.01) {
            s.due_amount = 0;
            s.status = "paid";
          } else {
            s.status = "partially_paid";
          }
          await s.save({ transaction: t });
          remaining = round2(remaining - apply);
        }
      }

      await logAudit({
        req,
        module: "ledger",
        action: "payment",
        entityType: "CustomerLedger",
        entityId: entry.id,
        details: { amount: numAmount, method: cleanMethod, customerId: targetCustId, saleId: resolvedSaleId },
      });

      try {
        await Notification.create(
          {
            owner_id: ownerId,
            shop_id: shopId,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "payment_received",
            title: `Payment Received: ₹${numAmount}`,
            message: `₹${numAmount} received via ${cleanMethod.toUpperCase()} from ${customer.name}.`,
            reference_type: "CustomerLedger",
            reference_id: entry.id,
            is_read: false,
          },
          { transaction: t }
        );
      } catch (_) {}

      return { entry, customer };
    });

    return res.status(201).json({
      success: true,
      data: result.entry,
      message: `Payment of ₹${numAmount} successfully recorded in customer ledger`,
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
