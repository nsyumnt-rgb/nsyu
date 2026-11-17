import { QueryTypes, Transaction } from "sequelize";
import { sequelize, Supplier, SupplierLedger, Purchase } from "../models";

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * The ONLY function allowed to change Supplier.current_balance.
 *
 * Inside the caller's transaction it row-locks the supplier
 * (SELECT … FOR UPDATE) so concurrent purchases/payments can't race,
 * appends one supplier_ledger row with the resulting balance, and
 * updates the cached Supplier.current_balance — so ledger and cache can
 * never drift apart.
 *
 * Callers state the business effect; the legacy accounting sign is
 * applied here in ONE place:
 *   effect "increase" → payable goes UP   → entry_type "credit" (purchase, opening payable)
 *   effect "decrease" → payable goes DOWN → entry_type "debit"  (payment, return, cancellation)
 */
export async function postSupplierLedgerEntry(params: {
  ownerId: number;
  shopId: number;
  supplierId: number;
  purchaseId?: number | null;
  effect: "increase" | "decrease";
  amount: number;
  referenceType: string;
  referenceId?: number | null;
  referenceCode?: string | null;
  description: string;
  paymentMethod?: string | null;
  transactionId?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  entryDate?: Date;
  actorType: "owner" | "employee";
  actorId: number;
  transaction: Transaction;
}) {
  const t = params.transaction;
  const amount = round2(params.amount);
  if (!(amount > 0)) {
    throw Object.assign(new Error("Ledger amount must be greater than zero"), { status: 400 });
  }

  const supplier = await Supplier.findOne({
    where: { id: params.supplierId, owner_id: params.ownerId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!supplier) throw Object.assign(new Error("Supplier not found"), { status: 404 });

  const current = Number(supplier.current_balance) || 0;
  const next = round2(params.effect === "increase" ? current + amount : current - amount);

  const entry = await SupplierLedger.create(
    {
      owner_id: params.ownerId,
      shop_id: params.shopId,
      supplier_id: params.supplierId,
      purchase_id: params.purchaseId ?? null,
      entry_type: params.effect === "increase" ? "credit" : "debit",
      amount,
      running_balance: next,
      reference_type: params.referenceType,
      reference_id: params.referenceId ?? null,
      reference_code: params.referenceCode ?? null,
      description: params.description,
      payment_method: params.paymentMethod ?? null,
      transaction_id: params.transactionId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      notes: params.notes ?? null,
      entry_date: params.entryDate ?? new Date(),
      actor_type: params.actorType,
      actor_id: params.actorId,
    },
    { transaction: t }
  );

  supplier.current_balance = next;
  await supplier.save({ transaction: t });
  return entry;
}

/** Per-shop sequential purchase number, e.g. PUR000012 (atomic, concurrency-safe). */
export async function nextPurchaseNumber(ownerId: number, shopId: number, t: Transaction): Promise<string> {
  const replacements = { ownerId, scope: `PURCHASE_S${shopId}` };
  // Upsert first (takes the row lock until the transaction commits), then read — portable across Postgres & SQLite tests.
  await sequelize.query(
    `INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
     VALUES (:ownerId, :scope, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (owner_id, scope)
     DO UPDATE SET last_number = reference_counters.last_number + 1, updated_at = CURRENT_TIMESTAMP;`,
    { replacements, transaction: t }
  );
  const rows: any[] = await sequelize.query(
    `SELECT last_number FROM reference_counters WHERE owner_id = :ownerId AND scope = :scope;`,
    { replacements, type: QueryTypes.SELECT, transaction: t }
  );
  let n = Number(rows[0]?.last_number ?? 1);
  // Self-heal against any existing number (e.g. legacy rows) — same approach as utils/invoice.ts.
  for (;;) {
    const candidate = `PUR${String(n).padStart(6, "0")}`;
    const taken = await Purchase.findOne({ where: { owner_id: ownerId, shop_id: shopId, purchase_number: candidate }, transaction: t });
    if (!taken) {
      if (n !== Number(rows[0]?.last_number ?? 1)) {
        await sequelize.query(`UPDATE reference_counters SET last_number = :n WHERE owner_id = :ownerId AND scope = :scope;`, {
          replacements: { ...replacements, n },
          transaction: t,
        });
      }
      return candidate;
    }
    n++;
  }
}

const METHOD_ALIASES: Record<string, string> = {
  bank: "bank_transfer",
  neft: "bank_transfer",
  rtgs: "bank_transfer",
  imps: "bank_transfer",
  gpay: "upi",
  phonepe: "upi",
  paytm: "upi",
};
const METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"];

export function normalizePaymentMethod(raw: unknown): string {
  const m = String(raw || "cash").trim().toLowerCase();
  if (METHODS.includes(m)) return m;
  return METHOD_ALIASES[m] || "other";
}

/** Resolves the shop a request is scoped to (owner may pick a shop or all shops; staff are pinned to theirs). */
export function resolveShopScope(req: { auth?: any; query: any }): number | undefined {
  const auth = req.auth!;
  if (!auth.isOwner) return auth.shopId ?? undefined;
  if (String(req.query.allShops) === "true") return undefined;
  return req.query.shopId ? Number(req.query.shopId) : auth.shopId ?? undefined;
}

export function actorFromReq(req: { auth?: any }) {
  return {
    actorType: (req.auth!.isOwner ? "owner" : "employee") as "owner" | "employee",
    actorId: req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!,
  };
}
