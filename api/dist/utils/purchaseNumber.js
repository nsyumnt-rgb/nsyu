"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextPurchaseNumber = nextPurchaseNumber;
const models_1 = require("../models");
/** Mirrors utils/invoice.ts::nextInvoiceNumber exactly, for Purchase numbers, e.g. "PUR-MAIN-000012". */
async function nextPurchaseNumber(params) {
    const { ownerId, shopId, transaction: t } = params;
    await models_1.PurchaseCounter.findOrCreate({
        where: { owner_id: ownerId, shop_id: shopId },
        defaults: { owner_id: ownerId, shop_id: shopId, last_number: 0 },
        transaction: t,
    });
    const counter = (await models_1.PurchaseCounter.findOne({
        where: { owner_id: ownerId, shop_id: shopId },
        transaction: t,
        lock: t.LOCK.UPDATE,
    }));
    counter.last_number += 1;
    await counter.save({ transaction: t });
    const shop = await models_1.Shop.findByPk(shopId, { transaction: t });
    const prefix = (shop?.code || "SHOP").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `PUR-${prefix}-${String(counter.last_number).padStart(6, "0")}`;
}
//# sourceMappingURL=purchaseNumber.js.map