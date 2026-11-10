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
    .filter(
      (e) =>
        (e.entry_type === "debit" ||
          (e.entry_type === "reversal" && e.reference_type === "PaymentReversal")) &&
        e.status === "active"
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = entries
    .filter(
      (e) =>
        (e.entry_type === "credit" ||
          (e.entry_type === "reversal" &&
            (e.reference_type === "SaleCancellation" ||
              e.reference_type === "Return" ||
              e.reference_type === "SaleReturn"))) &&
        e.status === "active"
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const hasOpeningEntry = entries.some((e) => e.reference_type === "Opening_Balance" || e.description?.toLowerCase().includes("opening"));
  const openingOffset = hasOpeningEntry ? 0 : Number(customer.opening_balance) || 0;
  const calculatedBalance = Math.round((openingOffset + totalDebit - totalCredit) * 100) / 100;
  const shopBalance = calculatedBalance;

  // Auto-reconcile customer.current_balance if it drifts from actual active entries
  if (Math.abs(Number(customer.current_balance) - calculatedBalance) > 0.01) {
    customer.current_balance = calculatedBalance;
    await customer.save().catch(() => {});
  }

  return res.json({
    success: true,
    data: {
      customer,
      currentBalance: calculatedBalance,
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
