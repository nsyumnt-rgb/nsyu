import { Request, Response } from "express";
import { Op } from "sequelize";
import { Customer, Sale, CustomerLedger, EMIPlan } from "../models";
import { logAudit } from "../utils/audit";

export async function createCustomer(req: Request, res: Response) {
  const { name, phone, email, address, gstin, openingBalance, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name is required" });

  const customer = await Customer.create({
    owner_id: req.auth!.ownerId,
    name,
    phone: phone ?? null,
    email: email ?? null,
    address: address ?? null,
    gstin: gstin ?? null,
    opening_balance: Number(openingBalance) || 0,
    current_balance: Number(openingBalance) || 0,
    notes: notes ?? null,
  });

  await logAudit({ req, module: "customers", action: "create", entityType: "Customer", entityId: customer.id });
  return res.status(201).json({ success: true, data: customer });
}

export async function listCustomers(req: Request, res: Response) {
  const { search, status } = req.query;
  const where: any = { owner_id: req.auth!.ownerId };
  if (status) where.status = status;
  if (search) {
    where[Op.or as any] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  const customers = await Customer.findAll({ where, order: [["name", "ASC"]] });
  return res.json({ success: true, data: customers });
}

export async function getCustomer(req: Request, res: Response) {
  const param = String(req.params.customerId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where[Op.or as any] = [
      { id: Number(param) },
      { phone: param },
    ];
  } else {
    where[Op.or as any] = [
      { phone: param },
      { name: { [Op.like]: `%${param}%` } },
    ];
  }

  const customer = await Customer.findOne({
    where,
    include: [
      {
        model: Sale,
        as: "sales",
        limit: 10,
        order: [["created_at", "DESC"]],
      },
      {
        model: CustomerLedger,
        as: "ledgerEntries",
        limit: 20,
        order: [["created_at", "DESC"]],
      },
      {
        model: EMIPlan,
        as: "emiPlans",
      },
    ],
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  return res.json({ success: true, data: customer });
}

export async function updateCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ where: { id: req.params.customerId, owner_id: req.auth!.ownerId } });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

  const { name, phone, email, address, gstin, status, notes } = req.body;
  if (name !== undefined) customer.name = name;
  if (phone !== undefined) customer.phone = phone;
  if (email !== undefined) customer.email = email;
  if (address !== undefined) customer.address = address;
  if (gstin !== undefined) customer.gstin = gstin;
  if (status !== undefined) customer.status = status;
  if (notes !== undefined) customer.notes = notes;
  await customer.save();

  await logAudit({ req, module: "customers", action: "update", entityType: "Customer", entityId: customer.id });
  return res.json({ success: true, data: customer });
}
