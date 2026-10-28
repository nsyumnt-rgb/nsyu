import { Request } from "express";
import { AuditLog } from "../models";

interface LogParams {
  req: Request;
  module: string;
  action: string; // "create" | "update" | "delete" | "login" | ...
  entityType?: string;
  entityId?: number;
  oldValue?: Record<string, any>; // snapshot of changed field(s) before the write, e.g. { selling_price: 100 }
  newValue?: Record<string, any>; // snapshot of changed field(s) after the write, e.g. { selling_price: 120 }
  details?: Record<string, any>;
}

/**
 * Fire-and-forget audit trail. Call this from controllers after any
 * write action so there's always a record of who did what, when,
 * from which shop, and — for field-level changes — the old/new
 * values, e.g.:
 *
 *   await logAudit({ req, module: "products", action: "price_change",
 *                     entityType: "Product", entityId: product.id,
 *                     oldValue: { selling_price: 100 }, newValue: { selling_price: 120 } });
 */
export async function logAudit({ req, module, action, entityType, entityId, oldValue, newValue, details }: LogParams) {
  if (!req.auth) return;
  try {
    await AuditLog.create({
      owner_id: req.auth.ownerId,
      shop_id: req.auth.shopId ?? null,
      actor_type: req.auth.isOwner ? "owner" : "employee",
      actor_id: req.auth.isOwner ? req.auth.ownerId : (req.auth.employeeId as number),
      module,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      details: details ? JSON.stringify(details) : null,
      ip_address: req.ip,
    });
  } catch (err) {
    // Audit logging must never break the actual request
    console.error("Audit log failed:", err);
  }
}
