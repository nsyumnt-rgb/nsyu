import { Transaction } from "sequelize";
import { InvoiceCounter, Shop, Sale } from "../models";

/**
 * Generates the next sequential invoice number for a shop, e.g.
 * "INV-MAIN-000042". Self-healing: if historical sales exist with higher
 * numbers, it automatically finds the next truly unique sequence number.
 */
export async function nextInvoiceNumber(params: {
  ownerId: number;
  shopId: number;
  transaction: Transaction;
}): Promise<string> {
  const { ownerId, shopId, transaction: t } = params;

  await InvoiceCounter.findOrCreate({
    where: { owner_id: ownerId, shop_id: shopId },
    defaults: { owner_id: ownerId, shop_id: shopId, last_number: 0 },
    transaction: t,
  });

  const counter = (await InvoiceCounter.findOne({
    where: { owner_id: ownerId, shop_id: shopId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  }))!;

  const shop = await Shop.findByPk(shopId, { transaction: t });
  const rawPrefix = (shop?.settings?.invoicePrefix || "INV-").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const codePrefix = (shop?.code || "SHOP").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanPrefix = rawPrefix.endsWith("-") ? rawPrefix : `${rawPrefix}-`;

  let candidateNum = counter.last_number + 1;
  while (true) {
    const candidateStr = `${cleanPrefix}${codePrefix}-${String(candidateNum).padStart(6, "0")}`;
    const exists = await Sale.findOne({
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
