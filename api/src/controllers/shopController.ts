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
import { logAudit } from "../utils/audit";

/** Owner-only: create a new shop under their account. */
export async function createShop(req: Request, res: Response) {
  const { name, code, address, phone, email, logo } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, message: "name and code are required" });
  }

  const existingCode = await Shop.findOne({
    where: { owner_id: req.auth!.ownerId, code: String(code).trim().toUpperCase() },
  });
  if (existingCode) {
    return res.status(409).json({ success: false, message: "A shop with this code already exists under your account" });
  }

  const shop = await Shop.create({
    owner_id: req.auth!.ownerId,
    name: String(name).trim(),
    code: String(code).trim().toUpperCase(),
    address,
    phone,
    email,
    logo,
    status: "active",
  });

  await logAudit({ req, module: "shops", action: "create", entityType: "Shop", entityId: shop.id });

  return res.status(201).json({ success: true, data: shop });
}

/**
 * Lists shops visible to the current actor:
 *  - Owner sees every shop under their account.
 *  - Employee sees only shops they've been assigned to.
 */
export async function listShops(req: Request, res: Response) {
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
    shop.settings = { ...(shop.settings || {}), ...settings };
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

  // Prevent employees from switching to an inactive shop
  if (!req.auth!.isOwner && shop.status === "inactive") {
    return res.status(403).json({ success: false, message: "Cannot switch to an inactive shop. Please contact the owner." });
  }

  const accessToken = signAccessToken({
    ownerId: req.auth!.ownerId,
    isOwner: req.auth!.isOwner,
    shopId: shop.id,
    roleId: req.auth!.roleId ?? null,
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

    const { showStockQty, allowSelfRegistration, allowOrders, minOrderValue, allowCustomerCancel } = req.body;
    if (showStockQty !== undefined) settings.show_stock_qty = Boolean(showStockQty);
    if (allowSelfRegistration !== undefined) settings.allow_self_registration = Boolean(allowSelfRegistration);
    if (allowOrders !== undefined) settings.allow_orders = Boolean(allowOrders);
    if (minOrderValue !== undefined) settings.min_order_value = Math.max(0, Number(minOrderValue) || 0);
    if (allowCustomerCancel !== undefined) settings.allow_customer_cancel = Boolean(allowCustomerCancel);

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


