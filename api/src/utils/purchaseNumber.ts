import { Transaction } from "sequelize";
import { PurchaseCounter, Shop } from "../models";

/** Mirrors utils/invoice.ts::nextInvoiceNumber exactly, for Purchase numbers, e.g. "PUR-MAIN-000012". */
export async function nextPurchaseNumber(params: { ownerId: number; shopId: number; transaction: Transaction }): Promise<string> {
  const { ownerId, shopId, transaction: t } = params;

  await PurchaseCounter.findOrCreate({
    where: { owner_id: ownerId, shop_id: shopId },
    defaults: { owner_id: ownerId, shop_id: shopId, last_number: 0 },
    transaction: t,
  });

  const counter = (await PurchaseCounter.findOne({
    where: { owner_id: ownerId, shop_id: shopId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  }))!;

  counter.last_number += 1;
  await counter.save({ transaction: t });

  const shop = await Shop.findByPk(shopId, { transaction: t });
  const prefix = (shop?.code || "SHOP").toUpperCase().replace(/[^A-Z0-9]/g, "");

  return `PUR-${prefix}-${String(counter.last_number).padStart(6, "0")}`;
}
