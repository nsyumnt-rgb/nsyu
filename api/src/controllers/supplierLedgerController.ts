import { Request, Response } from "express";
import { Supplier, SupplierLedger, SupplierPayment, Shop } from "../models";

export async function getSupplierLedger(req: Request, res: Response) {
  const supplier = await Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth!.ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

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

  const where: any = { owner_id: req.auth!.ownerId, supplier_id: supplier.id };
  if (targetShopId) where.shop_id = targetShopId;

  const entries = await SupplierLedger.findAll({
    where,
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
    order: [
      ["entry_date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const totalDebit = entries.filter((e) => e.entry_type === "debit" && e.status === "active").reduce((s, e) => s + Number(e.amount), 0);
  const totalCredit = entries.filter((e) => e.entry_type === "credit" && e.status === "active").reduce((s, e) => s + Number(e.amount), 0);

  // In supplier ledger: credit = purchase, debit = payment. Outstanding = credit - debit
  const shopBalance = Math.round((totalCredit - totalDebit) * 100) / 100;

  return res.json({
    success: true,
    data: {
      supplier,
      currentBalance: Number(supplier.current_balance),
      shopBalance,
      isShopScoped: !!targetShopId,
      scopedShopId: targetShopId ?? null,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      entries,
    },
  });
}

/** Every supplier the owner currently owes money to. */
export async function listSupplierOutstanding(req: Request, res: Response) {
  const suppliers = await Supplier.findAll({ where: { owner_id: req.auth!.ownerId }, order: [["current_balance", "DESC"]] });
  const outstanding = suppliers.filter((s) => Number(s.current_balance) !== 0);
  return res.json({ success: true, data: outstanding });
}

/** Listing of money paid out to suppliers. */
export async function listSupplierPayments(req: Request, res: Response) {
  const { supplierId, allShops } = req.query;
  let targetShopId: number | undefined;

  if (req.auth!.isOwner) {
    if (allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId };
  if (targetShopId) where.shop_id = targetShopId;
  if (supplierId) where.supplier_id = supplierId;

  const payments = await SupplierPayment.findAll({
    where,
    include: [
      { model: Supplier, as: "supplier", attributes: ["id", "name"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
    ],
    order: [["payment_date", "DESC"]],
    limit: Number(req.query.limit) || 100,
  });
  return res.json({ success: true, data: payments });
}
