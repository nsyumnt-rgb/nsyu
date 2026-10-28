import { Request, Response } from "express";
import { Customer, CustomerLedger, Shop } from "../models";

/** Full transaction history + running balance for one customer. */
export async function getCustomerLedger(req: Request, res: Response) {
  const customer = await Customer.findOne({
    where: { id: req.params.customerId, owner_id: req.auth!.ownerId },
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

  let targetShopId: number | undefined;
  if (req.auth!.isOwner) {
    if (req.query.allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId, customer_id: customer.id };
  if (targetShopId) where.shop_id = targetShopId;

  const entries = await CustomerLedger.findAll({
    where,
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
    order: [
      ["entry_date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const totalDebit = entries
    .filter((e) => e.entry_type === "debit" && e.status === "active")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = entries
    .filter((e) => e.entry_type === "credit" && e.status === "active")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const shopBalance = Math.round((totalDebit - totalCredit) * 100) / 100;

  return res.json({
    success: true,
    data: {
      customer,
      currentBalance: Number(customer.current_balance),
      shopBalance,
      isShopScoped: !!targetShopId,
      scopedShopId: targetShopId ?? null,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      entries,
    },
  });
}

/** Overview: every customer with an outstanding balance, for a collections view. */
export async function listOutstandingBalances(req: Request, res: Response) {
  const customers = await Customer.findAll({
    where: { owner_id: req.auth!.ownerId },
    order: [["current_balance", "DESC"]],
  });

  const outstanding = customers.filter((c) => Number(c.current_balance) !== 0);
  return res.json({ success: true, data: outstanding });
}
