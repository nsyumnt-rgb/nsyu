"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextInvoiceNumber = nextInvoiceNumber;
const models_1 = require("../models");
/**
 * Generates the next sequential invoice number for a shop, e.g.
 * "INV-MAIN-000042". Self-healing: if historical sales exist with higher
 * numbers, it automatically finds the next truly unique sequence number.
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
    const shop = await models_1.Shop.findByPk(shopId, { transaction: t });
    const rawPrefix = (shop?.settings?.invoicePrefix || "INV-").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const codePrefix = (shop?.code || "SHOP").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cleanPrefix = rawPrefix.endsWith("-") ? rawPrefix : `${rawPrefix}-`;
    let candidateNum = counter.last_number + 1;
    while (true) {
        const candidateStr = `${cleanPrefix}${codePrefix}-${String(candidateNum).padStart(6, "0")}`;
        const exists = await models_1.Sale.findOne({
            where: { owner_id: ownerId, shop_id: shopId, invoice_number: candidateStr },
            transaction: t,
        });
        if (!exists) {
            counter.last_number = candidateNum;
            await counter.save({ transaction: t });
            return candidateStr;
        }
        candidateNum++;
    }
}
//# sourceMappingURL=invoice.js.map