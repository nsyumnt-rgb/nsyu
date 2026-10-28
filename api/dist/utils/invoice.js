"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextInvoiceNumber = nextInvoiceNumber;
const models_1 = require("../models");
/**
 * Generates the next sequential invoice number for a shop, e.g.
 * "INV-MAIN-000042". MUST be called with the same transaction as the
 * Sale.create() it belongs to (externalTransaction), and the caller's
 * transaction must be the one that eventually commits — the row lock
 * here is what prevents two concurrent sales at the same shop from
 * getting the same number.
 */
async function nextInvoiceNumber(params) {
    const { ownerId, shopId, transaction: t } = params;
    await models_1.InvoiceCounter.findOrCreate({
        where: { owner_id: ownerId, shop_id: shopId },
        defaults: { owner_id: ownerId, shop_id: shopId, last_number: 0 },
        transaction: t,
    });
    const counter = (await models_1.InvoiceCounter.findOne({
        where: { owner_id: ownerId, shop_id: shopId },
        transaction: t,
        lock: t.LOCK.UPDATE,
    }));
    counter.last_number += 1;
    await counter.save({ transaction: t });
    const shop = await models_1.Shop.findByPk(shopId, { transaction: t });
    const prefix = (shop?.code || "SHOP").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `INV-${prefix}-${String(counter.last_number).padStart(6, "0")}`;
}
//# sourceMappingURL=invoice.js.map