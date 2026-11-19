import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { Shop, CustomerAccount, Supplier } from "../models";
import { resolveEmployeeAccess } from "../utils/employeeAccess";

/**
 * Verifies the access token and attaches req.auth.
 * Does NOT check shop selection or permissions — see requireShop()
 * and requirePermission() for that. Keeping these separate means
 * routes can require "logged in" without requiring "shop selected"
 * (e.g. GET /shops, POST /shops/switch).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    if (payload.isCustomer) {
      return res.status(403).json({ success: false, message: "Customer tokens cannot access staff endpoints" });
    }
    if (payload.isSupplier) {
      return res.status(403).json({ success: false, message: "Supplier tokens cannot access staff endpoints" });
    }
    req.auth = payload;
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  // Staff tokens: the account must still be active and assigned to the token's shop, and the
  // role used is the one assigned NOW (deactivation / role changes apply on the next request).
  if (req.auth.employeeId && !req.auth.isOwner) {
    try {
      const access = await resolveEmployeeAccess(req.auth.employeeId, req.auth.ownerId, req.auth.shopId);
      if (!access.ok) return res.status(401).json({ success: false, message: "Staff access revoked or account inactive" });
      req.auth.roleId = access.roleId;
      req.auth.roleName = access.roleName;
    } catch {
      return res.status(503).json({ success: false, message: "Could not verify staff access" });
    }
  }
  return next();
}

/**
 * Verifies customer access token, verifies account is Active in DB,
 * and attaches req.customer.
 * Rejects staff tokens with 403, and deactivated accounts with 401.
 * Suspended shop blocks customer access.
 */
export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;

    if (!payload.isCustomer || !payload.customerId || !payload.accountId) {
      return res.status(403).json({ success: false, message: "Staff tokens cannot access customer portal" });
    }

    const account = await CustomerAccount.findByPk(payload.accountId);
    if (!account || account.status !== "active") {
      return res.status(401).json({ success: false, message: "Customer account is disabled or inactive" });
    }

    // Check if shop is suspended
    const shop = await Shop.findByPk(account.shop_id);
    if (!shop || shop.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Shop is suspended. Access blocked. Contact system administrator.",
      });
    }

    req.customer = {
      customerId: account.customer_id,
      shopId: account.shop_id,
      ownerId: account.owner_id,
      accountId: account.id,
      phone: account.phone,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Verifies supplier access token, verifies supplier record is Active in DB,
 * and attaches req.supplier. Rejects other token types with 403.
 */
export async function requireSupplier(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    if (!payload.isSupplier || !payload.supplierId) {
      return res.status(403).json({ success: false, message: "Supplier authentication required" });
    }

    const supplier = await Supplier.findByPk(payload.supplierId);
    if (!supplier || supplier.status !== "active") {
      return res.status(401).json({ success: false, message: "Supplier account not found or inactive" });
    }

    req.supplier = {
      supplierId: supplier.id,
      ownerId: supplier.owner_id,
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || null,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Every module route (products, sales, billing...) needs an active
 * shop context. This guarantees req.auth.shopId is present before
 * the controller runs, so controllers never have to null-check it.
 * If shop is suspended, rejects with 403.
 */
export async function requireShop(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.isSuperAdmin) {
    return next();
  }

  if (!req.auth?.shopId) {
    if (req.auth?.isOwner) {
      try {
        const firstShop = await Shop.findOne({ where: { owner_id: req.auth.ownerId }, order: [["id", "ASC"]] });
        if (firstShop) {
          req.auth.shopId = firstShop.id;
        }
      } catch {
        // Proceed to rejection
      }
    }
  }

  if (!req.auth?.shopId) {
    return res.status(400).json({
      success: false,
      message: "No shop selected. Call /api/shops/switch first.",
    });
  }

  try {
    const shop = await Shop.findByPk(req.auth.shopId);
    if (!shop || shop.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Shop is suspended. Access blocked. Contact system administrator.",
      });
    }
  } catch (err) {
    console.error("Error checking shop status:", err);
  }

  return next();
}

/**
 * Shortcut for routes only the Owner account itself may call
 * (e.g. creating shops, creating roles, deleting employees).
 */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.isSuperAdmin) {
    return next();
  }
  if (!req.auth?.isOwner) {
    return res.status(403).json({ success: false, message: "Owner access required" });
  }
  return next();
}

/**
 * Middleware strictly for Super Admin endpoints (/api/admin/*)
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isSuperAdmin) {
    return res.status(403).json({ success: false, message: "Super Admin access required" });
  }
  return next();
}
