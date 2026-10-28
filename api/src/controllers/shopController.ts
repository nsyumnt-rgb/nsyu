import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Shop,
  Role,
  EmployeeShop,
  Sale,
  Purchase,
  InventoryTransaction,
  CustomerLedger,
  SupplierLedger,
  Attendance,
  Payroll,
  EMIPlan,
  ProductStock,
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
  if (req.auth!.isOwner) {
    const shops = await Shop.findAll({
      where: { owner_id: req.auth!.ownerId },
      order: [["created_at", "ASC"]],
    });
    return res.json({ success: true, data: shops });
  }

  const assignments = await EmployeeShop.findAll({
    where: { employee_id: req.auth!.employeeId },
    include: [{ model: Shop, as: "shop" }, { model: Role, as: "role" }],
  });

  const shops = assignments
    .filter((a: any) => a.shop && a.shop.owner_id === req.auth!.ownerId)
    .map((a: any) => ({
      ...a.shop.toJSON(),
      roleId: a.role_id,
      roleName: a.role?.name,
    }));

  return res.json({ success: true, data: shops });
}

/** Get a single shop by ID with access check */
export async function getShop(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const shop = await Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  if (!req.auth!.isOwner) {
    const assigned = await EmployeeShop.findOne({
      where: { employee_id: req.auth!.employeeId, shop_id: shopId },
    });
    if (!assigned) {
      return res.status(403).json({ success: false, message: "You are not assigned to this shop" });
    }
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

  const { name, phone, email, address, logo, code } = req.body;
  if (name !== undefined) shop.name = String(name).trim();
  if (phone !== undefined) shop.phone = phone;
  if (email !== undefined) shop.email = email;
  if (address !== undefined) shop.address = address;
  if (logo !== undefined) shop.logo = logo;

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
    purchasesCount,
    inventoryCount,
    customerLedgerCount,
    supplierLedgerCount,
    attendanceCount,
    payrollCount,
    emiCount,
  ] = await Promise.all([
    Sale.count({ where: { shop_id: shopId } }),
    Purchase.count({ where: { shop_id: shopId } }),
    InventoryTransaction.count({ where: { shop_id: shopId } }),
    CustomerLedger.count({ where: { shop_id: shopId } }),
    SupplierLedger.count({ where: { shop_id: shopId } }),
    Attendance.count({ where: { shop_id: shopId } }),
    Payroll.count({ where: { shop_id: shopId } }),
    EMIPlan.count({ where: { shop_id: shopId } }),
  ]);

  const totalHistoricalRecords =
    salesCount +
    purchasesCount +
    inventoryCount +
    customerLedgerCount +
    supplierLedgerCount +
    attendanceCount +
    payrollCount +
    emiCount;

  if (totalHistoricalRecords > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete shop with existing financial or historical records (${totalHistoricalRecords} records found: ${salesCount} sales, ${purchasesCount} purchases, ${inventoryCount} inventory entries, ${attendanceCount} attendance records, ${payrollCount} payroll runs). Please deactivate the shop instead to preserve transaction history.`,
    });
  }

  // Clean up any zero-stock rows and employee assignments
  await ProductStock.destroy({ where: { shop_id: shopId, current_stock: 0 } });
  await EmployeeShop.destroy({ where: { shop_id: shopId } });
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

  if (req.auth!.isOwner) {
    const accessToken = signAccessToken({
      ownerId: req.auth!.ownerId,
      isOwner: true,
      shopId: shop.id,
      roleId: null, // owner has no role row — bypasses permission checks entirely
    });
    return res.json({ success: true, data: { accessToken, shop } });
  }

  // Employee must be explicitly assigned to this shop
  const assignment = await EmployeeShop.findOne({
    where: { employee_id: req.auth!.employeeId, shop_id: shop.id },
    include: [{ model: Role, as: "role" }],
  });

  if (!assignment) {
    return res.status(403).json({ success: false, message: "You are not assigned to this shop" });
  }

  const accessToken = signAccessToken({
    ownerId: req.auth!.ownerId,
    isOwner: false,
    employeeId: req.auth!.employeeId,
    shopId: shop.id,
    roleId: assignment.role_id,
    roleName: (assignment as any).role?.name ?? null,
  });

  await logAudit({ req, module: "shops", action: "switch", entityType: "Shop", entityId: shop.id });

  return res.json({ success: true, data: { accessToken, shop } });
}

