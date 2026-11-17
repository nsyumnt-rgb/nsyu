import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize, Supplier, Purchase, SupplierLedger, Shop } from "../models";
import { logAudit } from "../utils/audit";
import { nextEntityReferenceCode } from "../utils/referenceCode";
import { actorFromReq, postSupplierLedgerEntry, resolveShopScope, round2 } from "../utils/supplierLedger";

function cleanPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "").slice(-10);
  return digits || null;
}

function cleanEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e || null;
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function assertNoDuplicate(ownerId: number, phone: string | null, email: string | null, exceptId?: number) {
  const or: any[] = [];
  if (phone) or.push({ phone });
  if (email) or.push(sequelize.where(sequelize.fn("lower", sequelize.col("email")), email));
  if (!or.length) return;
  const where: any = { owner_id: ownerId, [Op.or]: or };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  const dup = await Supplier.findOne({ where });
  if (dup) {
    throw Object.assign(new Error(`A supplier with this ${dup.phone === phone ? "mobile number" : "email"} already exists (${dup.name})`), {
      status: 409,
    });
  }
}

/** GET /api/suppliers?search=&status= — owner-level directory with live payable balance. */
export async function listSuppliers(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const where: any = { owner_id: ownerId };
  if (req.query.status) where.status = String(req.query.status);
  const q = String(req.query.search || "").trim();
  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { phone: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } },
      { gstin: { [Op.iLike]: `%${q}%` } },
    ];
  }
  const suppliers = await Supplier.findAll({ where, order: [["name", "ASC"]] });
  return res.json({ success: true, data: suppliers });
}

/** POST /api/suppliers { name, phone?, email?, address?, gstin?, openingBalance?, notes? } */
export async function createSupplier(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ success: false, message: "Supplier name is required" });

  const phone = cleanPhone(req.body.phone);
  const email = cleanEmail(req.body.email);
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Invalid email address format" });
  }
  const opening = round2(Number(req.body.openingBalance ?? req.body.opening_balance ?? 0) || 0);

  try {
    await assertNoDuplicate(ownerId, phone, email);
    const { actorType, actorId } = actorFromReq(req);

    const supplier = await sequelize.transaction(async (t) => {
      const referenceCode = await nextEntityReferenceCode({ ownerId, prefix: "SUP", transaction: t }).catch(() => null);
      const created = await Supplier.create(
        {
          owner_id: ownerId,
          name,
          phone,
          email,
          address: String(req.body.address || "").trim() || null,
          gstin: String(req.body.gstin || "").trim().toUpperCase() || null,
          notes: String(req.body.notes || "").trim() || null,
          opening_balance: opening,
          current_balance: 0,
          reference_code: referenceCode,
        },
        { transaction: t }
      );

      // Opening balance goes through the ledger so the running balance always reconciles.
      if (opening !== 0) {
        let shopId = req.auth!.shopId;
        if (!shopId) {
          const shop = await Shop.findOne({ where: { owner_id: ownerId }, order: [["id", "ASC"]], transaction: t });
          shopId = shop?.id;
        }
        if (shopId) {
          await postSupplierLedgerEntry({
            ownerId,
            shopId,
            supplierId: created.id,
            effect: opening > 0 ? "increase" : "decrease",
            amount: Math.abs(opening),
            referenceType: "Opening",
            referenceId: created.id,
            description: opening > 0 ? "Opening balance (payable)" : "Opening balance (advance)",
            actorType,
            actorId,
            transaction: t,
          });
          await created.reload({ transaction: t });
        }
      }
      return created;
    });

    await logAudit({ req, module: "suppliers", action: "create", entityType: "Supplier", entityId: supplier.id });
    return res.status(201).json({ success: true, data: supplier });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message || "Could not create supplier" });
  }
}

/** GET /api/suppliers/:id — profile + purchases + ledger history (shop-scoped like other lists). */
export async function getSupplier(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const supplier = await Supplier.findOne({ where: { id: req.params.id, owner_id: ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

  const shopId = resolveShopScope(req);
  const scope: any = { owner_id: ownerId, supplier_id: supplier.id };
  if (shopId) scope.shop_id = shopId;

  const [purchases, ledgerEntries] = await Promise.all([
    Purchase.findAll({
      where: scope,
      include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code"] }],
      order: [["purchase_date", "DESC"]],
      limit: 200,
    }),
    SupplierLedger.findAll({ where: scope, order: [["id", "DESC"]], limit: 500 }),
  ]);

  const totals = purchases.reduce(
    (acc, p) => {
      if (p.status === "cancelled") return acc;
      acc.totalPurchased = round2(acc.totalPurchased + Number(p.total_amount) - Number(p.returned_amount));
      acc.totalPaid = round2(acc.totalPaid + Number(p.paid_amount));
      return acc;
    },
    { totalPurchased: 0, totalPaid: 0 }
  );

  return res.json({
    success: true,
    data: { ...supplier.toJSON(), purchases, ledgerEntries, summary: { ...totals, payable: Number(supplier.current_balance) } },
  });
}

/** PUT /api/suppliers/:id — contact/status edits only; balances change only through the ledger. */
export async function updateSupplier(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const supplier = await Supplier.findOne({ where: { id: req.params.id, owner_id: ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

  try {
    const phone = req.body.phone !== undefined ? cleanPhone(req.body.phone) : supplier.phone;
    const email = req.body.email !== undefined ? cleanEmail(req.body.email) : supplier.email;
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address format" });
    }
    await assertNoDuplicate(ownerId, phone, email, supplier.id);

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Supplier name cannot be empty" });
      supplier.name = name;
    }
    supplier.phone = phone;
    supplier.email = email;
    if (req.body.address !== undefined) supplier.address = String(req.body.address || "").trim() || null;
    if (req.body.gstin !== undefined) supplier.gstin = String(req.body.gstin || "").trim().toUpperCase() || null;
    if (req.body.notes !== undefined) supplier.notes = String(req.body.notes || "").trim() || null;
    if (req.body.status !== undefined) {
      if (!["active", "inactive"].includes(req.body.status)) {
        return res.status(400).json({ success: false, message: "status must be active or inactive" });
      }
      supplier.status = req.body.status;
    }
    await supplier.save();
    await logAudit({ req, module: "suppliers", action: "update", entityType: "Supplier", entityId: supplier.id });
    return res.json({ success: true, data: supplier });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message || "Could not update supplier" });
  }
}
