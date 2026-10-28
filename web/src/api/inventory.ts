import { api } from "./client";
import type { ApiEnvelope, InventoryTransaction, MovementType, ProductStockEntry, StockTransfer } from "../types";

export type DirectMovementType = Exclude<MovementType, "opening" | "transfer_in" | "transfer_out">;

export function recordMovement(payload: { productId: number; type: DirectMovementType; quantity: number; notes?: string }) {
  return api.post<ApiEnvelope<{ currentStock: number; transaction: InventoryTransaction }>>("/inventory/movement", payload);
}

export function transferStock(payload: { productId: number; fromShopId: number; toShopId: number; quantity: number; notes?: string }) {
  return api.post<
    ApiEnvelope<{ transfer: StockTransfer; fromShopStock: number; toShopStock: number }>
  >("/inventory/transfer", payload);
}

export function getInventoryHistory(params?: { productId?: number; shopId?: number; type?: MovementType; limit?: number }) {
  return api.get<ApiEnvelope<InventoryTransaction[]>>("/inventory/history", { params });
}

export function getProductStockOverview(productId: number | string) {
  return api.get<ApiEnvelope<ProductStockEntry[]>>(`/inventory/stock/${productId}`);
}

export function getTransfer(transferId: number | string) {
  return api.get<ApiEnvelope<StockTransfer & { transactions?: any[] }>>(`/inventory/transfers/${transferId}`);
}

export function getMovement(movementId: number | string) {
  return api.get<ApiEnvelope<InventoryTransaction>>(`/inventory/movement/${movementId}`);
}

