import { randomUUID } from "crypto";
import { Op, Transaction } from "sequelize";
import { sequelize, Customer, CustomerLedger, Sale } from "../models";
import { LedgerEntryType } from "../models/CustomerLedger";
import { computeBillPaymentStatus, computeSaleStatus } from "../models/Sale";

export function generateUniqueReceiptCode(prefix = "RCP"): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface RecordLedgerEntryParams {
  ownerId: number;
  shopId: number;
  customerId: number;
  saleId?: number | null;
  entryType: LedgerEntryType;
  reversalDirection?: "credit" | "debit"; // for 'reversal': 'credit' reduces customer owed (reversing debit), 'debit' increases (reversing credit)
  amount: number; // always a positive magnitude — direction comes from entryType
  referenceType: string;
  referenceId?: number;
  description: string;
  actorType: "owner" | "employee";
  actorId: number;
  entryDate?: Date;
  referenceCode?: string;
  idempotencyKey?: string;
  paymentMethod?: string;
  notes?: string;
  externalTransaction?: Transaction; // pass in to make this atomic with the sale/payment/EMI write
}

/**
 * The ONLY function in the codebase allowed to change
 * Customer.current_balance. Mirrors utils/inventory.ts::recordStockMovement:
 *
 *  1. Row-locks the Customer record (SELECT ... FOR UPDATE) so
 *     concurrent sales/payments for the same customer can't race
 *     each other into an inconsistent balance.
 *  2. Computes the new running balance (debit = +amount, credit = -amount).
 *  3. Writes the Customer update AND the CustomerLedger row in the
 *     same DB transaction, so they can never drift apart.
 */
export async function recordLedgerEntry(params: RecordLedgerEntryParams) {
  const {
    ownerId,
    shopId,
    customerId,
    entryType,
    amount,
    referenceType,
    referenceId,
    description,
    actorType,
    actorId,
    entryDate,
    externalTransaction,
  } = params;

  if (amount <= 0) {
    throw Object.assign(new Error("Ledger entry amount must be positive"), { status: 400 });
  }

  const run = async (t: Transaction) => {
    const customer = (await Customer.findOne({
      where: { id: customerId, owner_id: ownerId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    }))!;

    if (!customer) {
      throw Object.assign(new Error("Customer not found"), { status: 404 });
    }

    let signedAmount = entryType === "debit" ? amount : -amount;
    if (entryType === "reversal") {
      signedAmount = params.reversalDirection === "debit" ? amount : -amount;
    }
    const newBalance = Math.round(((Number(customer.current_balance) || 0) + signedAmount) * 100) / 100;

    customer.current_balance = newBalance;
    await customer.save({ transaction: t });

    const entry = await CustomerLedger.create(
      {
        owner_id: ownerId,
        shop_id: shopId,
        customer_id: customerId,
        sale_id: params.saleId ?? (referenceType.startsWith("Sale") && referenceId ? referenceId : null),
        entry_type: entryType,
        amount,
        running_balance: newBalance,
        reference_type: referenceType,
        reference_id: referenceId ?? null,
        description,
        entry_date: entryDate ?? new Date(),
        actor_type: actorType,
        actor_id: actorId,
        reference_code: params.referenceCode ?? null,
        idempotency_key: params.idempotencyKey ?? null,
        payment_method: params.paymentMethod ?? (entryType === "credit" ? "cash" : null),
        notes: params.notes ?? null,
      },
      { transaction: t }
    );

    return { entry, customer };
  };

  if (externalTransaction) {
    return run(externalTransaction);
  }
  return sequelize.transaction(run);
}

/**
 * Posts a reversal for a previously-posted ledger entry: a new,
 * opposite-direction entry (so the running balance history stays a
 * simple forward replay), AND flips the original row's status to
 * "reversed" as a read-time annotation. Neither row is ever deleted.
 */
export async function reverseLedgerEntry(params: {
  originalEntryId: number;
  description: string;
  actorType: "owner" | "employee";
  actorId: number;
  externalTransaction?: Transaction;
}) {
  const { originalEntryId, description, actorType, actorId, externalTransaction } = params;

  const run = async (t: Transaction) => {
    const original = await CustomerLedger.findOne({ where: { id: originalEntryId }, transaction: t });
    if (!original) {
      throw Object.assign(new Error("Ledger entry not found"), { status: 404 });
    }
    if (original.status === "reversed") {
      throw Object.assign(new Error("Ledger entry already reversed"), { status: 400 });
    }

    const reversedType: LedgerEntryType = original.entry_type === "debit" ? "credit" : "debit";

    const { entry } = await recordLedgerEntry({
      ownerId: original.owner_id,
      shopId: original.shop_id,
      customerId: original.customer_id,
      entryType: reversedType,
      amount: Number(original.amount),
      referenceType: original.reference_type,
      referenceId: original.reference_id ?? undefined,
      description,
      actorType,
      actorId,
      externalTransaction: t,
    });

    original.status = "reversed";
    await original.save({ transaction: t });

    return entry;
  };

  if (externalTransaction) {
    return run(externalTransaction);
  }
  return sequelize.transaction(run);
}

export interface ProcessPaymentParams {
  ownerId: number;
  shopId: number;
  customerId?: number | null;
  saleId?: number | null;
  invoiceNumber?: string | null;
  amount: number;
  paymentMethod: string;
  referenceCode?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  paymentDate?: Date;
  actorType: "owner" | "employee";
  actorId: number;
  isOwner?: boolean;
  allowAdvance?: boolean;
  referenceType?: string;
}

/**
 * Single source-of-truth atomic payment processor for bill & ledger payments:
 * - Prevents duplicate entries via idempotencyKey and unique reference_code
 * - Locks customer and sale row(s) with SELECT FOR UPDATE
 * - Rejects overpayments exceeding remaining due unless allowAdvance=true
 * - Records single-ledger credit transaction (customer_ledger)
 * - Automatically recalculates bill paid_amount, due_amount, status, and payment_status
 */
export async function recordCustomerPaymentTransaction(params: ProcessPaymentParams) {
  const numAmount = round2(Number(params.amount));
  if (!numAmount || numAmount <= 0) {
    throw Object.assign(new Error("Payment amount must be positive"), { status: 400 });
  }

  const cleanIdempotencyKey = params.idempotencyKey ? String(params.idempotencyKey).trim() : null;
  const explicitRefCode = params.referenceCode ? String(params.referenceCode).trim() : null;
  const receiptCode = explicitRefCode || generateUniqueReceiptCode();

  const findDuplicateEntry = async (t?: Transaction) => {
    if (cleanIdempotencyKey) {
      const byKey = await CustomerLedger.findOne({
        where: { owner_id: params.ownerId, idempotency_key: cleanIdempotencyKey },
        transaction: t,
      });
      if (byKey) return byKey;
    }
    if (explicitRefCode) {
      const byRef = await CustomerLedger.findOne({
        where: {
          owner_id: params.ownerId,
          reference_code: explicitRefCode,
          entry_type: "credit",
          status: "active",
        },
        transaction: t,
      });
      if (byRef) return byRef;
    }
    return null;
  };

  try {
    return await sequelize.transaction(async (t) => {
      // 1. Check idempotency / duplicate transaction reference first inside transaction
      const duplicate = await findDuplicateEntry(t);
      if (duplicate) {
        const linkedSaleId = duplicate.sale_id || duplicate.reference_id || params.saleId || null;
        const linkedSale = linkedSaleId ? await Sale.findByPk(linkedSaleId, { transaction: t }) : null;
        const customer = await Customer.findByPk(duplicate.customer_id, { transaction: t });
        return {
          idempotent: true,
          entry: duplicate,
          customer: customer!,
          sale: linkedSale,
          updatedSales: linkedSale ? [linkedSale] : [],
          receiptCode: duplicate.reference_code || receiptCode,
        };
      }

      // 2. Resolve target Sale if saleId or invoiceNumber was passed
      let targetSale: Sale | null = null;
      if (params.saleId) {
        const where: any = { id: Number(params.saleId), owner_id: params.ownerId };
        if (params.isOwner === false) {
          where.shop_id = params.shopId;
        }
        targetSale = await Sale.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
        if (!targetSale) {
          throw Object.assign(new Error("Sale not found"), { status: 404 });
        }
      } else if (params.invoiceNumber) {
        const cleanInv = String(params.invoiceNumber).trim();
        targetSale = await Sale.findOne({
          where: {
            owner_id: params.ownerId,
            [Op.or]: [{ invoice_number: cleanInv }, { invoice_number: { [Op.iLike]: cleanInv } }],
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
      }

      // 3. Resolve & lock Customer
      let targetCustomerId = params.customerId ? Number(params.customerId) : null;
      if ((!targetCustomerId || isNaN(targetCustomerId)) && targetSale) {
        targetCustomerId = targetSale.customer_id;
      }
      const customer = targetCustomerId
        ? await Customer.findOne({ where: { id: targetCustomerId, owner_id: params.ownerId }, transaction: t, lock: t.LOCK.UPDATE })
        : null;
      if (!customer) {
        throw Object.assign(new Error("Customer not found"), { status: 404 });
      }
      targetCustomerId = customer.id;

      if (targetSale && targetSale.customer_id !== targetCustomerId) {
        throw Object.assign(new Error("Sale does not belong to this customer"), { status: 400 });
      }

      const effectiveShopId = targetSale ? targetSale.shop_id : params.shopId;
      const updatedSales: Sale[] = [];

      // 4. Validate targeted bill payment or general bill allocation
      if (targetSale) {
        if (targetSale.status === "cancelled") {
          throw Object.assign(new Error("Cannot pay a cancelled bill"), { status: 400 });
        }
        if (targetSale.is_emi) {
          throw Object.assign(
            new Error("This bill is on EMI — pay individual installments via /api/emi/installments/:id/pay"),
            { status: 400 }
          );
        }

        const total = round2(Number(targetSale.total_amount || 0));
        const curPaid = round2(Number(targetSale.paid_amount || 0));
        const remainingDue = Math.max(0, round2(total - curPaid));
        if (remainingDue <= 0.01) {
          throw Object.assign(new Error("Bill is already fully paid (₹0 due)"), { status: 400 });
        }
        if (!params.allowAdvance && numAmount > remainingDue + 0.01) {
          throw Object.assign(
            new Error(`Payment amount ₹${numAmount} exceeds remaining due amount of ₹${remainingDue}`),
            { status: 400 }
          );
        }

        const applyAmount = params.allowAdvance ? numAmount : Math.min(numAmount, remainingDue);
        const newPaid = Math.min(total, round2(curPaid + applyAmount));
        const newDue = Math.max(0, round2(total - newPaid));
        targetSale.paid_amount = newPaid;
        targetSale.due_amount = newDue <= 0.01 ? 0 : newDue;
        targetSale.status = computeSaleStatus(total, targetSale.paid_amount);
        targetSale.payment_status = computeBillPaymentStatus(total, targetSale.paid_amount, targetSale.status);
        await targetSale.save({ transaction: t });
        updatedSales.push(targetSale);
      } else {
        const unpaidSales = await Sale.findAll({
          where: {
            owner_id: params.ownerId,
            customer_id: targetCustomerId,
            status: ["unpaid", "partially_paid"],
            is_emi: false,
          },
          order: [["created_at", "ASC"], ["id", "ASC"]],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        const totalUnpaidDue = round2(unpaidSales.reduce((acc, s) => acc + Math.max(0, Number(s.due_amount || 0)), 0));
        const maxCollectible = Math.max(totalUnpaidDue, Math.max(0, Number(customer.current_balance || 0)));
        if (!params.allowAdvance && totalUnpaidDue > 0 && numAmount > maxCollectible + 0.01) {
          throw Object.assign(
            new Error(`Payment amount ₹${numAmount} exceeds total outstanding due of ₹${round2(maxCollectible)}`),
            { status: 400 }
          );
        }

        let remaining = numAmount;
        for (const s of unpaidSales) {
          if (remaining <= 0.01) break;
          const total = round2(Number(s.total_amount || 0));
          const curPaid = round2(Number(s.paid_amount || 0));
          const due = Math.max(0, round2(total - curPaid));
          if (due <= 0.01) continue;

          const apply = Math.min(remaining, due);
          s.paid_amount = Math.min(total, round2(curPaid + apply));
          const newDue = Math.max(0, round2(total - s.paid_amount));
          s.due_amount = newDue <= 0.01 ? 0 : newDue;
          s.status = computeSaleStatus(total, s.paid_amount);
          s.payment_status = computeBillPaymentStatus(total, s.paid_amount, s.status);
          await s.save({ transaction: t });
          updatedSales.push(s);
          remaining = round2(remaining - apply);
        }
      }

      // 5. Record single-ledger credit entry atomically
      const { entry, customer: updatedCustomer } = await recordLedgerEntry({
        ownerId: params.ownerId,
        shopId: effectiveShopId,
        customerId: targetCustomerId,
        saleId: targetSale ? targetSale.id : (updatedSales.length === 1 ? updatedSales[0].id : null),
        entryType: "credit",
        amount: numAmount,
        referenceType: params.referenceType || (targetSale ? "SalePayment" : "Payment"),
        referenceId: targetSale ? targetSale.id : (updatedSales.length === 1 ? updatedSales[0].id : undefined),
        referenceCode: receiptCode,
        idempotencyKey: cleanIdempotencyKey ?? undefined,
        paymentMethod: params.paymentMethod,
        notes: params.notes ?? (targetSale ? `Payment for ${targetSale.invoice_number}` : "Payment received"),
        description: targetSale
          ? `Payment for ${targetSale.invoice_number}`
          : (params.notes || `Payment received (${params.paymentMethod.toUpperCase()})`),
        actorType: params.actorType,
        actorId: params.actorId,
        entryDate: params.paymentDate || new Date(),
        externalTransaction: t,
      });

      return {
        idempotent: false,
        entry,
        customer: updatedCustomer,
        sale: targetSale,
        updatedSales,
        receiptCode,
      };
    });
  } catch (err: any) {
    // Handle concurrent unique constraint violation on idempotency_key or reference_code safely
    const pgCode = err?.original?.code || err?.parent?.code || err?.code;
    if (pgCode === "23505" || err?.name === "SequelizeUniqueConstraintError") {
      const duplicate = await findDuplicateEntry();
      if (duplicate) {
        const linkedSaleId = duplicate.sale_id || duplicate.reference_id || params.saleId || null;
        const linkedSale = linkedSaleId ? await Sale.findByPk(linkedSaleId) : null;
        const customer = await Customer.findByPk(duplicate.customer_id);
        return {
          idempotent: true,
          entry: duplicate,
          customer: customer!,
          sale: linkedSale,
          updatedSales: linkedSale ? [linkedSale] : [],
          receiptCode: duplicate.reference_code || receiptCode,
        };
      }
    }
    throw err;
  }
}
