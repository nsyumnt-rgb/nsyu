import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { Shop, CustomerAccount } from "../models";

/**
 * Verifies the access token and attaches req.auth.
 * Does NOT check shop selection or permissions — see requireShop()
 * and requirePermission() for that. Keeping these separate means
 * routes can require "logged in" without requiring "shop selected"
 * (e.g. GET /shops, POST /shops/switch).
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
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
    req.auth = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Verifies customer access token, verifies account is Active in DB,
 * and attaches req.customer.
 * Rejects staff tokens with 403, and deactivated accounts with 401.
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
 * Every module route (products, sales, billing...) needs an active
 * shop context. This guarantees req.auth.shopId is present before
 * the controller runs, so controllers never have to null-check it.
 */
export async function requireShop(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.shopId) {
    if (req.auth?.isOwner) {
      try {
        const firstShop = await Shop.findOne({ where: { owner_id: req.auth.ownerId }, order: [["id", "ASC"]] });
        if (firstShop) {
          req.auth.shopId = firstShop.id;
          return next();
        }
      } catch {
        // Proceed to rejection
      }
    }
    return res.status(400).json({
      success: false,
      message: "No shop selected. Call /api/shops/switch first.",
    });
  }
  return next();
}

/**
 * Shortcut for routes only the Owner account itself may call
 * (e.g. creating shops, creating roles, deleting employees).
 */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isOwner) {
    return res.status(403).json({ success: false, message: "Owner access required" });
  }
  return next();
}
