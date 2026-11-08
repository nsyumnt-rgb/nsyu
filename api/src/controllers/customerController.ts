import { Request, Response } from "express";
import { Op } from "sequelize";
import { Customer, Sale, CustomerLedger, EMIPlan, CustomerAccount, CustomerRefreshToken, Shop } from "../models";
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

/**
 * POST /api/customers/:customerId/portal/invite
 * Enables customer portal login and generates an invite.
 */
export async function inviteCustomerToPortal(req: Request, res: Response) {
  try {
    const customerId = Number(req.params.customerId);
    const ownerId = req.auth!.ownerId;
    let shopId = req.auth!.shopId;

    if (!shopId && req.body.shopId) {
      shopId = Number(req.body.shopId);
    }
    if (!shopId) {
      const shop = await Shop.findOne({ where: { owner_id: ownerId, status: "active" }, order: [["id", "ASC"]] });
      shopId = shop ? shop.id : 1;
    }

    const customer = await Customer.findOne({ where: { id: customerId, owner_id: ownerId } });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (!customer.phone) {
      return res.status(400).json({ success: false, message: "Customer must have a valid phone number to enable portal access" });
    }

    const cleanPhone = customer.phone.replace(/[^0-9]/g, "").slice(-10);

    let [account, created] = await CustomerAccount.findOrCreate({
      where: { customer_id: customer.id },
      defaults: {
        customer_id: customer.id,
        shop_id: shopId,
        owner_id: ownerId,
        phone: cleanPhone,
        status: "active",
        created_by: req.auth!.employeeId || req.auth!.ownerId,
      },
    });

    if (!created && account.status !== "active") {
      account.status = "active";
      account.shop_id = shopId;
      account.phone = cleanPhone;
      await account.save();
    }

    const shop = await Shop.findByPk(shopId);
    const inviteLink = `/portal/login?phone=${cleanPhone}&shop=${shop?.code || shopId}`;

    await logAudit({
      req,
      module: "customers",
      action: "portal_invite_sent",
      entityType: "CustomerAccount",
      entityId: account.id,
      details: { customerId: customer.id, phone: cleanPhone, shopId },
    });

    return res.json({
      success: true,
      message: "Customer portal login enabled successfully",
      data: {
        accountId: account.id,
        customerId: customer.id,
        phone: cleanPhone,
        status: account.status,
        inviteLink,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to invite customer to portal" });
  }
}

/**
 * POST /api/customers/:customerId/portal/disable
 */
export async function disableCustomerPortal(req: Request, res: Response) {
  try {
    const customerId = Number(req.params.customerId);
    const ownerId = req.auth!.ownerId;

    const account = await CustomerAccount.findOne({ where: { customer_id: customerId, owner_id: ownerId } });
    if (!account) {
      return res.status(404).json({ success: false, message: "Customer portal account not found" });
    }

    account.status = "disabled";
    await account.save();

    // Revoke all refresh tokens immediately
    await CustomerRefreshToken.update(
      { revoked_at: new Date() },
      { where: { account_id: account.id, revoked_at: null } }
    );

    await logAudit({
      req,
      module: "customers",
      action: "portal_disabled",
      entityType: "CustomerAccount",
      entityId: account.id,
    });

    return res.json({ success: true, message: "Customer portal access disabled" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to disable portal" });
  }
}

/**
 * POST /api/customers/:customerId/portal/enable
 */
export async function enableCustomerPortal(req: Request, res: Response) {
  try {
    const customerId = Number(req.params.customerId);
    const ownerId = req.auth!.ownerId;

    const account = await CustomerAccount.findOne({ where: { customer_id: customerId, owner_id: ownerId } });
    if (!account) {
      return res.status(404).json({ success: false, message: "Customer portal account not found" });
    }

    account.status = "active";
    await account.save();

    await logAudit({
      req,
      module: "customers",
      action: "portal_enabled",
      entityType: "CustomerAccount",
      entityId: account.id,
    });

    return res.json({ success: true, message: "Customer portal access enabled" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to enable portal" });
  }
}

/**
 * GET /api/customers/portal-requests
 */
export async function listPortalRequests(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const shopId = req.auth!.shopId;

    const where: any = { owner_id: ownerId, status: "pending_approval" };
    if (shopId) where.shop_id = shopId;

    const requests = await CustomerAccount.findAll({
      where,
      include: [
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, data: requests });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list requests" });
  }
}

/**
 * POST /api/customers/portal-requests/:id/approve
 */
export async function approvePortalRequest(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const ownerId = req.auth!.ownerId;

    const account = await CustomerAccount.findOne({ where: { id, owner_id: ownerId } });
    if (!account) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    account.status = "active";
    account.approved_by = req.auth!.employeeId || req.auth!.ownerId;
    await account.save();

    return res.json({ success: true, message: "Portal registration approved", data: account });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Approval failed" });
  }
}

/**
 * POST /api/customers/portal-requests/:id/reject
 */
export async function rejectPortalRequest(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const ownerId = req.auth!.ownerId;

    const account = await CustomerAccount.findOne({ where: { id, owner_id: ownerId } });
    if (!account) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    account.status = "disabled";
    await account.save();

    return res.json({ success: true, message: "Portal registration rejected" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Rejection failed" });
  }
}
