"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordStockMovement = recordStockMovement;
const models_1 = require("../models");
const DECREASING_TYPES = ["sale", "purchase_return", "damage", "transfer_out"];
const INCREASING_TYPES = ["opening", "purchase", "customer_return", "transfer_in"];
/**
 * The ONLY function in the codebase allowed to change
 * ProductStock.current_stock. It:
 *
 *  1. Row-locks the ProductStock record (SELECT ... FOR UPDATE) so
 *     concurrent sales/transfers on the same product+shop can't race
 *     each other into an inconsistent balance.
 *  2. Computes the new balance from the current one.
 *  3. Refuses to let stock go negative UNLESS allowNegative is
 *     explicitly passed (reserved for owner-initiated corrective
 *     adjustments — never for sale/transfer/damage).
 *  4. Writes the ProductStock update AND the InventoryTransaction
 *     ledger row in the same DB transaction, so they can never
 *     drift apart.
 *
 * `type: "adjustment"` can move stock in either direction — pass a
 * negative `quantity` for a downward adjustment, positive for upward.
 * All other types have a fixed direction (see DECREASING/INCREASING
 * arrays above) and `quantity` must be given as a positive magnitude.
 */
async function recordStockMovement(params) {
    const { ownerId, shopId, productId, type, quantity, actorType, actorId, referenceType, referenceId, notes, allowNegative = false, externalTransaction, } = params;
    const run = async (t) => {
        await models_1.ProductStock.findOrCreate({
            where: { product_id: productId, shop_id: shopId },
            defaults: { owner_id: ownerId, product_id: productId, shop_id: shopId, current_stock: 0 },
            transaction: t,
        });
        // Re-select with an explicit row lock (findOrCreate's lock
        // guarantee isn't reliable across dialects on the SELECT branch).
        const stock = (await models_1.ProductStock.findOne({
            where: { product_id: productId, shop_id: shopId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        }));
        let signedQuantity;
        if (type === "adjustment") {
            signedQuantity = quantity; // caller supplies sign directly for adjustments
        }
        else if (DECREASING_TYPES.includes(type)) {
            signedQuantity = -Math.abs(quantity);
        }
        else if (INCREASING_TYPES.includes(type)) {
            signedQuantity = Math.abs(quantity);
        }
        else {
            throw Object.assign(new Error(`Unknown movement type: ${type}`), { status: 400 });
        }
        const newBalance = stock.current_stock + signedQuantity;
        if (newBalance < 0 && !allowNegative) {
            throw Object.assign(new Error(`Insufficient stock: current ${stock.current_stock}, attempted change ${signedQuantity}. Negative stock is not allowed.`), { status: 400 });
        }
        stock.current_stock = newBalance;
        await stock.save({ transaction: t });
        const txn = await models_1.InventoryTransaction.create({
            owner_id: ownerId,
            shop_id: shopId,
            product_id: productId,
            type,
            signed_quantity: signedQuantity,
            balance_after: newBalance,
            reference_type: referenceType ?? null,
            reference_id: referenceId ?? null,
            notes: notes ?? null,
            actor_type: actorType,
            actor_id: actorId,
        }, { transaction: t });
        return { stock, transaction: txn };
    };
    if (externalTransaction) {
        return run(externalTransaction);
    }
    return models_1.sequelize.transaction(run);
}
//# sourceMappingURL=inventory.js.map