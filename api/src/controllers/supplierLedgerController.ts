import { Request, Response } from "express";
import { Op } from "sequelize";
import { Supplier, SupplierLedger, Purchase, Shop } from "../models";
import { resolveShopScope, round2 } from "../utils/supplierLedger";

/**
 * GET /api/supplier-ledger/:supplierId?shopId&allShops
 * Full statement for one supplier. `balance` is the overall payable
 * (supplier-level); `shopBalance` is credits − debits in the scoped shop.
 */
export async function getSupplierLedger(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const supplier = await Supplier.findOne({ where: { id: req.params.supplierId, owner_id: ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

  const where: any = { owner_id: ownerId, supplier_id: supplier.id };
  const shopId = resolveShopScope(req);
  if (shopId) where.shop_id = shopId;

  const entries = await SupplierLedger.findAll({
    where,
    include: [
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: Purchase, as: "purchase", attributes: ["id", "purchase_number"] },
    ],
    order: [["id", "ASC"]],
  });

  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries) {
    if (e.entry_type === "debit") totalDebit = round2(totalDebit + Number(e.amount));
    else totalCredit = round2(totalCredit + Number(e.amount));
  }

  return res.json({
    success: true,
    data: {
      supplier,
      entries,
      totalDebit,
      totalCredit,
      shopBalance: round2(totalCredit - totalDebit), // legacy convention: credit raises the payable
      balance: Number(supplier.current_balance),
    },
  });
}

/** GET /api/supplier-ledger/outstanding — suppliers we still owe, highest first. */
export async function listSupplierOutstanding(req: Request, res: Response) {
  const suppliers = await Supplier.findAll({
    where: { owner_id: req.auth!.ownerId, current_balance: { [Op.gt]: 0 } },
    order: [["current_balance", "DESC"]],
  });
  return res.json({ success: true, data: suppliers });
}

/** GET /api/supplier-ledger/payments?supplierId&shopId&allShops — payments made to suppliers. */
export async function listSupplierPayments(req: Request, res: Response) {
  // "SupplierPayment" is used by both legacy rows and new payments.
  const where: any = { owner_id: req.auth!.ownerId, reference_type: "SupplierPayment" };
  const shopId = resolveShopScope(req);
  if (shopId) where.shop_id = shopId;
  if (req.query.supplierId) where.supplier_id = Number(req.query.supplierId);

  const rows = await SupplierLedger.findAll({
    where,
    include: [
      { model: Supplier, as: "supplier", attributes: ["id", "name", "phone"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: Purchase, as: "purchase", attributes: ["id", "purchase_number"] },
    ],
    order: [["entry_date", "DESC"], ["id", "DESC"]],
    limit: Math.min(Number(req.query.limit) || 200, 500),
  });

  const data = rows.map((r: any) => ({
    id: r.id,
    type: "supplier",
    amount: Number(r.amount),
    method: r.payment_method,
    transaction_id: r.transaction_id,
    payment_date: r.entry_date,
    created_at: r.created_at,
    notes: r.notes,
    purchase_id: r.purchase_id,
    purchase_number: r.purchase?.purchase_number ?? r.reference_code,
    shop_id: r.shop_id,
    shop: r.shop,
    supplier: r.supplier,
  }));
  return res.json({ success: true, data });
}
