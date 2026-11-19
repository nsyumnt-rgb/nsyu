import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { Supplier, Purchase, PurchaseItem, SupplierLedger, Shop } from "../models";
import { signAccessToken } from "../utils/jwt";

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

/**
 * POST /api/supplier-portal/auth/login
 * Supplier login via phone or email + password.
 */
export async function loginSupplier(req: Request, res: Response) {
  try {
    const { identifier, password } = req.body;
    const rawInput = String(identifier || "").trim();
    const rawPass = String(password || "").trim();

    if (!rawInput || !rawPass) {
      return res.status(400).json({ success: false, message: "Identifier (email or phone) and password are required" });
    }

    const isEmail = rawInput.includes("@");
    const where: any = isEmail
      ? { email: rawInput.toLowerCase() }
      : { phone: normalizePhone(rawInput) };

    const supplier = await Supplier.findOne({ where });
    if (!supplier) {
      return res.status(401).json({ success: false, message: "Invalid credentials or supplier account not found" });
    }

    if (supplier.status !== "active") {
      return res.status(403).json({ success: false, message: "Supplier account is disabled" });
    }

    if (!supplier.password_hash) {
      return res.status(400).json({
        success: false,
        message: "Password not set for this supplier account. Please contact the purchasing shop to set your portal access.",
      });
    }

    const valid = await bcrypt.compare(rawPass, supplier.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    supplier.last_login_at = new Date();
    await supplier.save();

    const accessToken = signAccessToken({
      ownerId: supplier.owner_id,
      isOwner: false,
      isSupplier: true,
      supplierId: supplier.id,
      phone: supplier.phone || undefined,
      roleCode: "supplier",
      roleName: "Supplier",
    });

    return res.json({
      success: true,
      message: "Supplier login successful",
      data: {
        accessToken,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          email: supplier.email,
          gstin: supplier.gstin,
          currentBalance: Number(supplier.current_balance || 0),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
}

/**
 * GET /api/supplier-portal/purchases
 * Returns all purchase orders issued to this supplier by shops.
 */
export async function listSupplierPurchases(req: Request, res: Response) {
  try {
    const supplierId = req.supplier!.supplierId;
    const purchases = await Purchase.findAll({
      where: { supplier_id: supplierId },
      include: [
        { model: PurchaseItem, as: "items" },
        { model: Shop, as: "shop", attributes: ["id", "name", "code", "phone", "address"] },
      ],
      order: [["purchase_date", "DESC"], ["id", "DESC"]],
      limit: 100,
    });

    return res.json({ success: true, data: purchases });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list purchase orders" });
  }
}

/**
 * GET /api/supplier-portal/purchases/:id
 * Purchase order detail.
 */
export async function getSupplierPurchaseDetail(req: Request, res: Response) {
  try {
    const supplierId = req.supplier!.supplierId;
    const id = Number(req.params.id);
    const purchase = await Purchase.findOne({
      where: { id, supplier_id: supplierId },
      include: [
        { model: PurchaseItem, as: "items" },
        { model: Shop, as: "shop", attributes: ["id", "name", "code", "phone", "address"] },
      ],
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    return res.json({ success: true, data: purchase });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load purchase order" });
  }
}

/**
 * GET /api/supplier-portal/ledger
 * Returns ledger statements and running payable balances for this supplier.
 */
export async function getSupplierLedger(req: Request, res: Response) {
  try {
    const supplierId = req.supplier!.supplierId;
    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    const entries = await SupplierLedger.findAll({
      where: { supplier_id: supplierId },
      include: [
        { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
        { model: Purchase, as: "purchase", attributes: ["id", "purchase_number", "total_amount"] },
      ],
      order: [["created_at", "DESC"], ["id", "DESC"]],
      limit: 200,
    });

    return res.json({
      success: true,
      data: {
        currentBalance: Number(supplier.current_balance || 0),
        openingBalance: Number(supplier.opening_balance || 0),
        entries,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load supplier ledger" });
  }
}

/**
 * POST /api/supplier-portal/auth/change-password
 * Allows logged-in supplier to update their password.
 */
export async function changeSupplierPassword(req: Request, res: Response) {
  try {
    const supplierId = req.supplier!.supplierId;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    if (supplier.password_hash && currentPassword) {
      const match = await bcrypt.compare(String(currentPassword).trim(), supplier.password_hash);
      if (!match) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    supplier.password_hash = await bcrypt.hash(String(newPassword).trim(), 10);
    await supplier.save();

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to change password" });
  }
}
