import { Request, Response } from "express";
import { Op } from "sequelize";
import { Supplier, Purchase, SupplierLedger, SupplierPayment } from "../models";
import { logAudit } from "../utils/audit";

export async function createSupplier(req: Request, res: Response) {
  const { name, phone, email, address, gstin } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name is required" });

  const supplier = await Supplier.create({ owner_id: req.auth!.ownerId, name, phone, email, address, gstin: gstin ?? null });
  await logAudit({ req, module: "suppliers", action: "create", entityType: "Supplier", entityId: supplier.id });
  return res.status(201).json({ success: true, data: supplier });
}

export async function listSuppliers(req: Request, res: Response) {
  const { search, status } = req.query;
  const where: any = { owner_id: req.auth!.ownerId };
  where.status = status || "active";
  if (search) {
    where[Op.or as any] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }
  const suppliers = await Supplier.findAll({ where, order: [["name", "ASC"]] });
  return res.json({ success: true, data: suppliers });
}

export async function getSupplier(req: Request, res: Response) {
  const param = String(req.params.supplierId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where.id = Number(param);
  } else {
    where.name = { [Op.iLike]: param };
  }

  const supplier = await Supplier.findOne({
    where,
    include: [
      {
        model: Purchase,
        as: "purchases",
        limit: 15,
        order: [["created_at", "DESC"]],
      },
      {
        model: SupplierLedger,
        as: "ledgerEntries",
        limit: 25,
        order: [["created_at", "DESC"]],
      },
    ],
  });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
  return res.json({ success: true, data: supplier });
}

export async function updateSupplier(req: Request, res: Response) {
  const supplier = await Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth!.ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

  const { name, phone, email, address, gstin } = req.body;
  if (name !== undefined) supplier.name = name;
  if (phone !== undefined) supplier.phone = phone;
  if (email !== undefined) supplier.email = email;
  if (address !== undefined) supplier.address = address;
  if (gstin !== undefined) supplier.gstin = gstin;
  await supplier.save();

  await logAudit({ req, module: "suppliers", action: "update", entityType: "Supplier", entityId: supplier.id });
  return res.json({ success: true, data: supplier });
}

/** Activate/deactivate — never a hard delete, since a supplier may be referenced by historical Products/Purchases. */
export async function setSupplierStatus(req: Request, res: Response) {
  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be 'active' or 'inactive'" });
  }
  const supplier = await Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth!.ownerId } });
  if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

  supplier.status = status;
  await supplier.save();

  await logAudit({ req, module: "suppliers", action: "set_status", entityType: "Supplier", entityId: supplier.id, details: { status } });
  return res.json({ success: true, data: supplier });
}
