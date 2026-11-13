import { Request, Response } from "express";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { Customer, Sale, CustomerLedger, CustomerAccount, CustomerRefreshToken, Shop } from "../models";
import { logAudit } from "../utils/audit";
import { syncCustomerToSupabaseAuth, updateSupabaseAuthPassword } from "../utils/supabaseAuth";

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export async function createCustomer(req: Request, res: Response) {
  const {
    name,
    shopName,
    shop_name,
    phone,
    mobile,
    email,
    address,
    gstin,
    openingBalance,
    opening_balance,
    password,
    notes,
  } = req.body;

  // Validation
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    return res.status(400).json({ success: false, message: "Customer Name is required" });
  }

  const rawPhone = String(phone || mobile || "").trim();
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, message: "A valid 10-digit Mobile Number is required" });
  }

  const trimmedAddress = String(address || "").trim();
  if (!trimmedAddress) {
    return res.status(400).json({ success: false, message: "Address is required" });
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, message: "A valid Email address is required" });
  }

  const rawPassword = String(password || "").trim();
  if (!rawPassword || rawPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  const ownerId = req.auth!.ownerId;

  // Check uniqueness within owner
  const existingPhone = await Customer.findOne({
    where: { owner_id: ownerId, phone: cleanPhone },
  });
  if (existingPhone) {
    return res.status(409).json({
      success: false,
      message: `A customer with mobile number ${cleanPhone} already exists.`,
    });
  }

  const existingEmail = await Customer.findOne({
    where: { owner_id: ownerId, email: cleanEmail },
  });
  if (existingEmail) {
    return res.status(409).json({
      success: false,
      message: `A customer with email ${cleanEmail} already exists.`,
    });
  }

  const effectiveShopName = (shopName || shop_name) ? String(shopName || shop_name).trim() : null;
  const rawOpBal = openingBalance !== undefined ? openingBalance : opening_balance;
  const numOpBal = Number(rawOpBal) || 0;

  // Resolve shop for customer account
  let shopId = req.auth!.shopId;
  if (!shopId) {
    const shop = await Shop.findOne({ where: { owner_id: ownerId, status: "active" }, order: [["id", "ASC"]] });
    shopId = shop ? shop.id : 1;
  }

  // Hash password using bcrypt
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // Sync to Supabase Auth (auth.users & auth.identities)
  const supabaseUid = await syncCustomerToSupabaseAuth(cleanEmail, passwordHash, trimmedName, cleanPhone);

  const customer = await Customer.create({
    owner_id: ownerId,
    name: trimmedName,
    shop_name: effectiveShopName,
    phone: cleanPhone,
    email: cleanEmail,
    address: trimmedAddress,
    gstin: gstin ? String(gstin).trim() : null,
    opening_balance: numOpBal,
    current_balance: numOpBal,
    supabase_uid: supabaseUid || null,
    notes: notes ? String(notes).trim() : null,
  });

  // Create CustomerAccount for portal login
  await CustomerAccount.create({
    customer_id: customer.id,
    shop_id: shopId,
    owner_id: ownerId,
    phone: cleanPhone,
    email: cleanEmail,
    password_hash: passwordHash,
    supabase_uid: supabaseUid || null,
    status: "active",
    created_by: req.auth!.employeeId || req.auth!.ownerId,
  });

  // Opening balance ledger impact
  if (numOpBal !== 0) {
    const entryType = numOpBal > 0 ? "debit" : "credit";
    const absOpBal = Math.abs(numOpBal);
    await CustomerLedger.create({
      owner_id: ownerId,
      shop_id: shopId,
      customer_id: customer.id,
      entry_type: entryType,
      amount: absOpBal,
      running_balance: numOpBal,
      reference_type: "Opening_Balance",
      description: numOpBal > 0 ? "Opening Due Balance" : "Opening Advance Balance",
      entry_date: new Date(),
      actor_type: req.auth!.isOwner ? "owner" : "employee",
      actor_id: req.auth!.isOwner ? req.auth!.ownerId : (req.auth!.employeeId || 1),
    }).catch((err) => {
      console.warn("Failed to create opening balance ledger entry:", err.message);
    });
  }

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
    ],
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  return res.json({ success: true, data: customer });
}

export async function updateCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ where: { id: req.params.customerId, owner_id: req.auth!.ownerId } });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

  const { name, shopName, shop_name, phone, email, address, gstin, status, notes, password, opening_balance, openingBalance } = req.body;
  if (name !== undefined) customer.name = String(name).trim();
  if (shopName !== undefined || shop_name !== undefined) {
    customer.shop_name = String(shopName || shop_name || "").trim() || null;
  }

  if (opening_balance !== undefined || openingBalance !== undefined) {
    const rawBal = opening_balance !== undefined ? opening_balance : openingBalance;
    const numBal = parseFloat(String(rawBal));
    if (!isNaN(numBal)) {
      const diff = numBal - Number(customer.opening_balance || 0);
      customer.opening_balance = numBal;
      customer.current_balance = Number(customer.current_balance || 0) + diff;
    }
  }

  let phoneUpdated = false;
  if (phone !== undefined) {
    const cleanPhone = normalizePhone(String(phone));
    if (cleanPhone && cleanPhone !== customer.phone) {
      const conflict = await Customer.findOne({
        where: { owner_id: req.auth!.ownerId, phone: cleanPhone, id: { [Op.ne]: customer.id } },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: `Mobile number ${cleanPhone} already in use` });
      }
      customer.phone = cleanPhone;
      phoneUpdated = true;
    }
  }

  let emailUpdated = false;
  if (email !== undefined) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail && cleanEmail !== customer.email) {
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address format" });
      }
      const conflict = await Customer.findOne({
        where: { owner_id: req.auth!.ownerId, email: cleanEmail, id: { [Op.ne]: customer.id } },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: `Email ${cleanEmail} already in use` });
      }
      customer.email = cleanEmail;
      emailUpdated = true;
    }
  }

  if (address !== undefined) customer.address = address;
  if (gstin !== undefined) customer.gstin = gstin;
  if (status !== undefined) customer.status = status;
  if (notes !== undefined) customer.notes = notes;

  await customer.save();

  // If password or credentials changed, sync CustomerAccount & Supabase Auth
  if (password && String(password).trim().length >= 6) {
    const passwordHash = await bcrypt.hash(String(password).trim(), 10);
    const [acc, created] = await CustomerAccount.findOrCreate({
      where: { customer_id: customer.id },
      defaults: {
        customer_id: customer.id,
        shop_id: req.auth!.shopId || 1,
        owner_id: req.auth!.ownerId,
        phone: customer.phone,
        email: customer.email,
        password_hash: passwordHash,
        status: "active",
      },
    });
    if (!created) {
      acc.password_hash = passwordHash;
      if (customer.email) acc.email = customer.email;
      if (customer.phone) acc.phone = customer.phone;
      await acc.save();
    }
    if (customer.email) {
      await updateSupabaseAuthPassword(customer.email, passwordHash);
    }
  }

  if (emailUpdated || phoneUpdated) {
    const accountUpdates: any = {};
    if (customer.email) accountUpdates.email = customer.email;
    if (customer.phone) accountUpdates.phone = customer.phone;
    await CustomerAccount.update(accountUpdates, { where: { customer_id: customer.id } });
  }

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
