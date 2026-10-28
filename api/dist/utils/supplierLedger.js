"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSupplierLedgerEntry = recordSupplierLedgerEntry;
const models_1 = require("../models");
/**
 * The ONLY function allowed to change Supplier.current_balance.
 * Mirrors utils/ledger.ts (CustomerLedger) exactly, just for the
 * payable side: "credit" increases what the shop owes the supplier
 * (a Purchase), "debit" decreases it (a SupplierPayment or a
 * PurchaseReturn adjustment).
 */
async function recordSupplierLedgerEntry(params) {
    const { ownerId, shopId, supplierId, entryType, amount, referenceType, referenceId, description, actorType, actorId, entryDate, externalTransaction } = params;
    if (amount <= 0) {
        throw Object.assign(new Error("Ledger entry amount must be positive"), { status: 400 });
    }
    const run = async (t) => {
        const supplier = (await models_1.Supplier.findOne({
            where: { id: supplierId, owner_id: ownerId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        }));
        if (!supplier)
            throw Object.assign(new Error("Supplier not found"), { status: 404 });
        const signedAmount = entryType === "credit" ? amount : -amount;
        const newBalance = Number(supplier.current_balance) + signedAmount;
        supplier.current_balance = newBalance;
        await supplier.save({ transaction: t });
        const entry = await models_1.SupplierLedger.create({
            owner_id: ownerId,
            shop_id: shopId,
            supplier_id: supplierId,
            entry_type: entryType,
            amount,
            running_balance: newBalance,
            reference_type: referenceType,
            reference_id: referenceId ?? null,
            description,
            entry_date: entryDate ?? new Date(),
            actor_type: actorType,
            actor_id: actorId,
        }, { transaction: t });
        return { entry, supplier };
    };
    if (externalTransaction)
        return run(externalTransaction);
    return models_1.sequelize.transaction(run);
}
//# sourceMappingURL=supplierLedger.js.map