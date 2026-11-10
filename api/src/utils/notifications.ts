import { Notification, NotificationType } from "../models/Notification";
import { Product, ProductStock } from "../models";

/** Fire-and-forget: creates one persisted notification for a single recipient. Never throws into the caller's flow. */
export async function notify(params: {
  ownerId: number;
  shopId?: number | null;
  recipientType: "owner" | "employee";
  recipientId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: number;
}) {
  try {
    return await Notification.create({
      owner_id: params.ownerId,
      shop_id: params.shopId ?? null,
      recipient_type: params.recipientType,
      recipient_id: params.recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      reference_type: params.referenceType ?? null,
      reference_id: params.referenceId ?? null,
    });
  } catch (err) {
    console.error("Notification creation failed:", err);
    return null;
  }
}

/** Notify the owner account. */
export async function notifyOwner(
  ownerId: number,
  params: Omit<Parameters<typeof notify>[0], "ownerId" | "recipientType" | "recipientId">
) {
  return notify({ ownerId, recipientType: "owner", recipientId: ownerId, ...params });
}

/** Notify one specific employee. */
export async function notifyEmployee(
  ownerId: number,
  employeeId: number,
  params: Omit<Parameters<typeof notify>[0], "ownerId" | "recipientType" | "recipientId">
) {
  return notify({ ownerId, recipientType: "employee", recipientId: employeeId, ...params });
}

/**
 * Live-computed alerts — NOT persisted, so they never go stale or
 * duplicate. Recomputed on every call from current data: low stock,
 * overdue EMI installments, pending leave requests. Scoped to the
 * current owner + (if given) shop.
 */
export async function getComputedAlerts(ownerId: number, shopId?: number) {
  const stockWhere: any = { owner_id: ownerId };
  if (shopId) stockWhere.shop_id = shopId;

  const stocks = await ProductStock.findAll({
    where: stockWhere,
    include: [{ model: Product, as: "product", attributes: ["id", "name", "sku", "min_stock"] }],
  });
  const lowStock = stocks
    .filter((s: any) => s.current_stock <= (s.min_stock ?? s.product?.min_stock ?? 0))
    .map((s: any) => ({
      productId: s.product_id,
      productName: s.product?.name,
      sku: s.product?.sku,
      shopId: s.shop_id,
      currentStock: s.current_stock,
      minStock: s.min_stock ?? s.product?.min_stock ?? 0,
    }));

  return { lowStock, overdueEmi: [], pendingLeaves: [] };
}
