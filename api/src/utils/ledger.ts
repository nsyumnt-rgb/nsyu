import { Transaction } from "sequelize";
import { sequelize, Customer, CustomerLedger } from "../models";
import { LedgerEntryType } from "../models/CustomerLedger";

interface RecordLedgerEntryParams {
  ownerId: number;
  shopId: number;
  customerId: number;
  entryType: LedgerEntryType;
  amount: number; // always a positive magnitude — direction comes from entryType
  referenceType: string;
  referenceId?: number;
  description: string;
  actorType: "owner" | "employee";
  actorId: number;
  entryDate?: Date;
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

    const signedAmount = entryType === "debit" ? amount : -amount;
    const newBalance = Number(customer.current_balance) + signedAmount;

    customer.current_balance = newBalance;
    await customer.save({ transaction: t });

    const entry = await CustomerLedger.create(
      {
        owner_id: ownerId,
        shop_id: shopId,
        customer_id: customerId,
        entry_type: entryType,
        amount,
        running_balance: newBalance,
        reference_type: referenceType,
        reference_id: referenceId ?? null,
        description,
        entry_date: entryDate ?? new Date(),
        actor_type: actorType,
        actor_id: actorId,
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
