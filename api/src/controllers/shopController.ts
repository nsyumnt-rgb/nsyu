import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Shop,
  Role,
  Sale,
  InventoryTransaction,
  CustomerLedger,
  ProductStock,
  ShopPortalSettings,
} from "../models";
import { signAccessToken } from "../utils/jwt";
import { Employee } from "../models";
import { employeeAssignments, resolveEmployeeAccess } from "../utils/employeeAccess";
import { logAudit } from "../utils/audit";
import { removeImage, saveImage } from "../utils/mediaStorage";

/** Owner-only: create / register a new shop under their account. */
export async function createShop(req: Request, res: Response) {
  const { name, code, address, phone, email, logo, settings } = req.body;
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ success: false, message: "Shop name is required" });
  }

  const cleanName = String(name).trim();
  let shopCode = code ? String(code).trim().toUpperCase() : null;

  if (shopCode) {
    const existingCode = await Shop.findOne({
      where: { owner_id: req.auth!.ownerId, code: shopCode },
    });
    if (existingCode) {
      return res.status(409).json({ success: false, message: "A shop with this code already exists under your account" });
    }
  } else {
    // Generate unique shop code from shop name + random digits (e.g. NSYU-1024)
    const base = cleanName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "SHOP";
    let attempts = 0;
    while (!shopCode && attempts < 10) {
      const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
      const exists = await Shop.findOne({ where: { owner_id: req.auth!.ownerId, code: candidate } });
      if (!exists) shopCode = candidate;
      attempts++;
    }
    if (!shopCode) shopCode = `${base}-${Date.now().toString().slice(-4)}`;
  }

  const shop = await Shop.create({
    owner_id: req.auth!.ownerId,
    name: cleanName,
    code: shopCode,
    address: address ? String(address).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
    email: email ? String(email).trim() : undefined,
    logo: logo ? String(logo).trim() : undefined,
    status: "pending_approval",
    settings: settings && typeof settings === "object" ? settings : {},
  });

  // Automatically provision default portal settings for the new shop so customers can register & order
  try {
    await ShopPortalSettings.findOrCreate({
      where: { shop_id: shop.id },
      defaults: {
        shop_id: shop.id,
        allow_orders: true,
        allow_self_registration: true,
        show_stock_qty: false,
        min_order_value: 0,
        allow_customer_cancel: true,
      },
    });
  } catch (portalErr) {
    console.error("[createShop] Failed to provision default portal settings:", portalErr);
  }

  await logAudit({ req, module: "shops", action: "create", entityType: "Shop", entityId: shop.id });

  return res.status(201).json({
    success: true,
    data: shop,
    message: "Shop registered successfully and submitted for admin approval",
  });
}

/**
 * Lists shops visible to the current actor:
 *  - Owner sees every shop under their account.
 *  - Employee sees only shops they've been assigned to.
 */
export async function listShops(req: Request, res: Response) {
  if (req.auth!.employeeId) {
    const employee = await Employee.findByPk(req.auth!.employeeId);
    if (!employee) return res.json({ success: true, data: [] });
    const rows = await employeeAssignments(employee);
    return res.json({
      success: true,
      data: rows.map((r: any) => ({ ...r.shop.toJSON(), roleId: r.role_id, roleName: r.role.name })),
    });
  }
  const shops = await Shop.findAll({
    where: { owner_id: req.auth!.ownerId },
    order: [["created_at", "ASC"]],
  });
  return res.json({ success: true, data: shops });
}

/** Get a single shop by ID with access check */
export async function getShop(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  return res.json({ success: true, data: shop });
}

/** Owner-only: Update shop details */
export async function updateShop(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  const { name, phone, email, address, logo, code, settings } = req.body;
  if (name !== undefined) shop.name = String(name).trim();
  if (phone !== undefined) shop.phone = phone;
  if (email !== undefined) shop.email = email;
  if (address !== undefined) shop.address = address;
  if (logo !== undefined) shop.logo = logo;
  if (settings !== undefined && typeof settings === "object") {
    // The banner is only set through the upload endpoint (stored file, validated image).
    const { bannerUrl: _ignored, ...rest } = settings as Record<string, any>;
    shop.settings = { ...(shop.settings || {}), ...rest };
  }

  if (code !== undefined && String(code).trim().toUpperCase() !== shop.code) {
    const newCode = String(code).trim().toUpperCase();
    const existing = await Shop.findOne({
      where: { owner_id: req.auth!.ownerId, code: newCode, id: { [Op.ne]: shopId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Another shop already has this code" });
    }
    shop.code = newCode;
  }

  await shop.save();
  await logAudit({ req, module: "shops", action: "update", entityType: "Shop", entityId: shop.id });

  return res.json({ success: true, data: shop });
}

/** Owner-only: Toggle active/inactive status */
export async function toggleShopStatus(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  const newStatus = shop.status === "active" ? "inactive" : "active";
  shop.status = newStatus;
  await shop.save();

  await logAudit({
    req,
    module: "shops",
    action: newStatus === "active" ? "activate" : "deactivate",
    entityType: "Shop",
    entityId: shop.id,
    details: { status: newStatus },
  });

  return res.json({
    success: true,
    message: `Shop successfully ${newStatus === "active" ? "activated" : "deactivated"}`,
    data: shop,
  });
}

/**
 * Owner-only: Delete shop with integrity guard.
 * Prevents accidental deletion of shops with existing historical or financial transactions.
 */
export async function deleteShop(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  // Count existing transactions in all related modules
  const [
    salesCount,
    inventoryCount,
    customerLedgerCount,
  ] = await Promise.all([
    Sale.count({ where: { shop_id: shopId } }),
    InventoryTransaction.count({ where: { shop_id: shopId } }),
    CustomerLedger.count({ where: { shop_id: shopId } }),
  ]);

  const totalHistoricalRecords =
    salesCount +
    inventoryCount +
    customerLedgerCount;

  if (totalHistoricalRecords > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete shop with existing financial or historical records (${totalHistoricalRecords} records found: ${salesCount} sales, ${inventoryCount} inventory entries, ${customerLedgerCount} ledger entries). Please deactivate the shop instead to preserve transaction history.`,
    });
  }

  // Clean up any zero-stock rows
  await ProductStock.destroy({ where: { shop_id: shopId, current_stock: 0 } });
  await shop.destroy();

  await logAudit({ req, module: "shops", action: "delete", entityType: "Shop", entityId: shopId });

  return res.json({ success: true, message: "Shop deleted successfully" });
}

/**
 * Switches the active shop context. Issues a NEW access token with
 * shopId + roleId embedded, so every subsequent request is scoped
 * to that shop without extra DB lookups.
 */
export async function switchShop(req: Request, res: Response) {
  const { shopId } = req.body;
  if (!shopId) {
    return res.status(400).json({ success: false, message: "shopId is required" });
  }

  const shop = await Shop.findByPk(shopId);
  if (!shop || shop.owner_id !== req.auth!.ownerId) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  // Employees may only enter shops they are assigned to, with that shop's role.
  let roleId: number | null = req.auth!.roleId ?? null;
  if (req.auth!.employeeId) {
    const access = await resolveEmployeeAccess(req.auth!.employeeId, req.auth!.ownerId, shop.id);
    if (!access.ok) return res.status(404).json({ success: false, message: "Shop not found" });
    if (shop.status === "suspended") return res.status(403).json({ success: false, message: "Shop is suspended" });
    roleId = access.roleId;
  }

  // Prevent employees from switching to an inactive shop
  if (!req.auth!.isOwner && shop.status === "inactive") {
    return res.status(403).json({ success: false, message: "Cannot switch to an inactive shop. Please contact the owner." });
  }

  const accessToken = signAccessToken({
    ownerId: req.auth!.ownerId,
    isOwner: req.auth!.isOwner,
    employeeId: req.auth!.employeeId,
    shopId: shop.id,
    roleId: req.auth!.isOwner ? null : roleId,
  });

  await logAudit({ req, module: "shops", action: "switch", entityType: "Shop", entityId: shop.id });

  return res.json({ success: true, data: { accessToken, shop } });
}

export async function getShopPortalSettings(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId || req.params.id);
    const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    let [settings] = await ShopPortalSettings.findOrCreate({
      where: { shop_id: shop.id },
      defaults: {
        shop_id: shop.id,
        show_stock_qty: false,
        allow_self_registration: false,
        allow_orders: true,
        min_order_value: 0,
        allow_customer_cancel: true,
      },
    });

    return res.json({ success: true, data: settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load portal settings" });
  }
}

export async function updateShopPortalSettings(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId || req.params.id);
    const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    let [settings] = await ShopPortalSettings.findOrCreate({
      where: { shop_id: shop.id },
      defaults: {
        shop_id: shop.id,
        show_stock_qty: false,
        allow_self_registration: false,
        allow_orders: true,
        min_order_value: 0,
        allow_customer_cancel: true,
      },
    });

    const showStock = req.body.showStockQty !== undefined ? req.body.showStockQty : req.body.show_stock_qty;
    const allowSelfReg = req.body.allowSelfRegistration !== undefined ? req.body.allowSelfRegistration : req.body.allow_self_registration;
    const allowOrd = req.body.allowOrders !== undefined ? req.body.allowOrders : req.body.allow_orders;
    const minVal = req.body.minOrderValue !== undefined ? req.body.minOrderValue : req.body.min_order_value;
    const allowCancel = req.body.allowCustomerCancel !== undefined ? req.body.allowCustomerCancel : req.body.allow_customer_cancel;
    const privPol = req.body.privacyPolicy !== undefined ? req.body.privacyPolicy : req.body.privacy_policy;
    const terms = req.body.termsConditions !== undefined ? req.body.termsConditions : req.body.terms_conditions;
    const retPol = req.body.returnPolicy !== undefined ? req.body.returnPolicy : req.body.return_policy;

    if (showStock !== undefined) settings.show_stock_qty = Boolean(showStock);
    if (allowSelfReg !== undefined) settings.allow_self_registration = Boolean(allowSelfReg);
    if (allowOrd !== undefined) settings.allow_orders = Boolean(allowOrd);
    if (minVal !== undefined) settings.min_order_value = Math.max(0, Number(minVal) || 0);
    if (allowCancel !== undefined) settings.allow_customer_cancel = Boolean(allowCancel);
    if (privPol !== undefined) settings.privacy_policy = privPol ? String(privPol).trim() : null;
    if (terms !== undefined) settings.terms_conditions = terms ? String(terms).trim() : null;
    if (retPol !== undefined) settings.return_policy = retPol ? String(retPol).trim() : null;

    await settings.save();
    return res.json({ success: true, message: "Portal settings updated", data: settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update portal settings" });
  }
}

export async function getShopSettings(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId || req.params.id || req.auth!.shopId);
    const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    const settings = {
      currency: "INR (₹)",
      timezone: "Asia/Kolkata",
      defaultMargin: 20,
      pricesIncludeTax: false,
      defaultGstRate: 0,
      gstin: "",
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      allowNegativeStock: true,
      autoDeductStockOnBill: true,
      enableCash: true,
      enableUpi: true,
      enableBank: true,
      enableCredit: true,
      allowStaffDiscount: true,
      maxStaffDiscountPercent: 10,
      invoiceTerms: "1. Warranty as per manufacturer terms.\n2. Goods once sold are subject to standard return policy.\n3. Original invoice required for all claims.",
      ...(shop.settings || {}),
    };

    return res.json({ success: true, data: settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load shop settings" });
  }
}

export async function updateShopSettings(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId || req.params.id || req.auth!.shopId);
    const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    const incoming = req.body.settings || req.body;
    shop.settings = { ...(shop.settings || {}), ...incoming };
    await shop.save();

    await logAudit({
      req,
      module: "shops",
      action: "update_settings",
      entityType: "Shop",
      entityId: shop.id,
      details: { shopId, updatedKeys: Object.keys(incoming) },
    });

    return res.json({ success: true, message: "Shop settings updated successfully", data: shop.settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update shop settings" });
  }
}



/* ---------------- Storefront banner ---------------- */

/** Owner-only: upload (or replace) the shop's storefront banner image. */
export async function uploadShopBanner(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "Choose a banner image to upload" });

  let url: string;
  try {
    url = await saveImage(file, `owners/${req.auth!.ownerId}/shops/${shop.id}`);
  } catch (err: any) {
    return res.status(err?.status || 500).json({ success: false, message: err?.message || "Could not store the banner" });
  }

  const oldUrl = (shop.settings || {}).bannerUrl as string | undefined;
  shop.settings = { ...(shop.settings || {}), bannerUrl: url };
  shop.changed("settings", true);
  await shop.save();
  await removeImage(oldUrl);

  await logAudit({ req, module: "shops", action: "upload_banner", entityType: "Shop", entityId: shop.id });
  return res.json({ success: true, data: { bannerUrl: url, shop } });
}

/** Owner-only: remove the shop's banner (the storefront falls back to its default header). */
export async function deleteShopBanner(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

  const { bannerUrl: oldUrl, ...rest } = (shop.settings || {}) as Record<string, any>;
  shop.settings = rest;
  shop.changed("settings", true);
  await shop.save();
  await removeImage(oldUrl);

  await logAudit({ req, module: "shops", action: "delete_banner", entityType: "Shop", entityId: shop.id });
  return res.json({ success: true, data: { bannerUrl: null, shop } });
}
